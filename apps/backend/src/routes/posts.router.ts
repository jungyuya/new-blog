// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { cookieAuthMiddleware, adminOnlyMiddleware, tryCookieAuthMiddleware } from '../middlewares/auth.middleware'; import type { AppEnv } from '../lib/types';
import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { Post } from '../lib/types';


const CreatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용은 필수 항목입니다.'),
  // [추가] 태그: 문자열 배열, 필수는 아님
  tags: z.array(z.string()).optional(),
  // [추가] 발행 상태: 'published' 또는 'draft' 중 하나, 필수는 아님 (기본값 처리)
  status: z.enum(['published', 'draft']).optional(),
  // [추가] 공개 여부: 'public' 또는 'private' 중 하나, 필수는 아님 (기본값 처리)
  visibility: z.enum(['public', 'private']).optional(),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['published', 'draft']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  thumbnailUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '수정할 내용을 하나 이상 제공해야 합니다.' }
);

const postsRouter = new Hono<AppEnv>();

// --- [1] GET / - 모든 게시물 조회 (v2.1 - 아바타 및 댓글 수 추가) ---
postsRouter.get('/', tryCookieAuthMiddleware, async (c) => {
  const TABLE_NAME = process.env.TABLE_NAME!;
  const userGroups = c.get('userGroups');
  const isAdmin = userGroups?.includes('Admins');

  try {
    // 1. 기존 로직: GSI를 사용하여 모든 게시물의 기본 정보를 가져옵니다.
    const commandParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST#ALL' },
      ScanIndexForward: false,
    };

    if (!isAdmin) {
      commandParams.FilterExpression = '#status = :published AND #visibility = :public';
      commandParams.ExpressionAttributeNames = {
        '#status': 'status',
        '#visibility': 'visibility',
      };
      commandParams.ExpressionAttributeValues![':published'] = 'published';
      commandParams.ExpressionAttributeValues![':public'] = 'public';
    }

    const command = new QueryCommand(commandParams);
    const { Items } = await ddbDocClient.send(command);
    const activePosts = Items?.filter((i) => !i.isDeleted) || [];

    // --- [핵심 수정] 각 게시물에 대한 추가 정보(아바타, 댓글 수)를 병렬로 조회합니다. ---
    const enrichedPosts = await Promise.all(
      activePosts.map(async (post) => {
        // 2. authorAvatarUrl 조회
        // 게시물 데이터에 authorAvatarUrl이 이미 있다면 그것을 사용하고, 없다면 DB에서 조회합니다.
        // (참고: Post 생성/수정 시 authorAvatarUrl을 이미 비정규화했으므로, 대부분의 경우 추가 조회가 필요 없습니다.)
        let authorAvatarUrl = post.authorAvatarUrl;
        if (!authorAvatarUrl && post.authorId) {
          const profileCommand = new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${post.authorId}`, SK: 'PROFILE' },
          });
          const { Item: profile } = await ddbDocClient.send(profileCommand);
          authorAvatarUrl = profile?.avatarUrl || '';
        }

        // 3. commentCount 조회
        const commentCountCommand = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `POST#${post.postId}`,
            ':sk': 'COMMENT#',
          },
          // [성능 최적화] 실제 아이템은 필요 없고, 개수만 필요합니다.
          Select: 'COUNT',
        });
        const { Count: commentCount } = await ddbDocClient.send(commentCountCommand);

        // 4. 기존 post 객체에 새로운 정보를 합쳐서 반환합니다.
        return {
          ...post,
          authorAvatarUrl,
          commentCount: commentCount || 0,
        };
      })
    );

    return c.json({ posts: enrichedPosts });

  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

// --- [2] GET /:postId - 단일 게시물 조회 (v1.1 - 이전/다음 글 추가) ---
postsRouter.get('/:postId', tryCookieAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const TABLE_NAME = process.env.TABLE_NAME!;
  const currentUserId = c.get('userId');
  const userGroups = c.get('userGroups'); // [신규] 관리자 여부 확인
  const isAdmin = userGroups?.includes('Admins');

  try {
    // 1. (기존 로직) 현재 게시물 정보를 가져옵니다.
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    }));

    if (!Item || Item.isDeleted) {
      return c.json({ message: 'Post not found.' }, 404);
    }

    // 2. (기존 로직) 비밀글 접근 권한을 검사합니다.
    if (Item.visibility === 'private') {
      if (!currentUserId || Item.authorId !== currentUserId) {
        return c.json({ message: 'Forbidden: You do not have permission to view this post.' }, 403);
      }
    }

    // --- [핵심 수정] 이전 글 / 다음 글 정보를 조회합니다. ---
    // 3. GSI3를 사용해 모든 게시물 목록을 시간순으로 가져옵니다. (GET / 와 유사)
    const listCommandParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST#ALL' },
      ScanIndexForward: false, // 최신순 정렬
      // [성능 최적화] postId와 title만 가져옵니다.
      ProjectionExpression: 'postId, title',
    };

    // 관리자가 아닐 경우, 공개된 글만 목록에 포함시킵니다.
    if (!isAdmin) {
      listCommandParams.FilterExpression = '#status = :published AND #visibility = :public';
      listCommandParams.ExpressionAttributeNames = {
        '#status': 'status',
        '#visibility': 'visibility',
      };
      listCommandParams.ExpressionAttributeValues![':published'] = 'published';
      listCommandParams.ExpressionAttributeValues![':public'] = 'public';
    }

    const listCommand = new QueryCommand(listCommandParams);
    const { Items: allPosts } = await ddbDocClient.send(listCommand);
    const activePosts = allPosts?.filter((p: any) => p.postId) || [];

    // 4. 현재 게시물의 인덱스를 찾습니다.
    const currentIndex = activePosts.findIndex(p => p.postId === postId);

    let prevPost = null;
    let nextPost = null;

    if (currentIndex !== -1) {
      // 이전 글: 현재 인덱스보다 1 큰 항목 (최신순 정렬이므로)
      if (currentIndex + 1 < activePosts.length) {
        prevPost = activePosts[currentIndex + 1];
      }
      // 다음 글: 현재 인덱스보다 1 작은 항목
      if (currentIndex - 1 >= 0) {
        nextPost = activePosts[currentIndex - 1];
      }
    }
    // ---------------------------------------------------------

    // 5. (기존 로직) 조회수를 1 증가시킵니다. (Fire and Forget)
    ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression: 'SET viewCount = if_not_exists(viewCount, :start) + :inc',
      ExpressionAttributeValues: { ':inc': 1, ':start': 0 },
    }));

    // 6. 최종적으로, 모든 정보를 합쳐서 응답을 보냅니다.
    return c.json({
      post: Item,
      prevPost, // 이전 글 정보 (없으면 null)
      nextPost, // 다음 글 정보 (없으면 null)
    });

  } catch (error: any) {
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

// --- [3] POST / - 새 게시물 생성 (v2.2 - 작성자 프로필 연동) ---
postsRouter.post(
  '/',
  cookieAuthMiddleware,
  adminOnlyMiddleware,
  zValidator('json', CreatePostSchema),
  async (c) => {
    try {
      const { title, content, tags = [], status = 'published', visibility = 'public' } = c.req.valid('json');
      const userId = c.get('userId');
      const userEmail = c.get('userEmail');
      const postId = uuidv4();
      const now = new Date().toISOString();
      const TABLE_NAME = process.env.TABLE_NAME!;
      const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;

      // 1. [핵심 추가] 글 작성자의 최신 프로필 정보를 DB에서 조회합니다.
      const { Item: authorProfile } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));

      // 2. [핵심 수정] 조회한 프로필을 기반으로 최종 닉네임을 결정합니다.
      const authorNickname = authorProfile?.nickname || userEmail?.split('@')[0] || '익명';
      const authorBio = authorProfile?.bio || '';
      const authorAvatarUrl = authorProfile?.avatarUrl || '';

      // 3. content에서 첫 번째 이미지 URL을 찾아 thumbnailUrl과 imageUrl을 설정합니다.
      const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
      const firstImageMatch = content.match(imageUrlRegex);
      let thumbnailUrl = '';
      let imageUrl = '';
      if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
        imageUrl = firstImageMatch[1];
        thumbnailUrl = imageUrl.replace('/images/', '/thumbnails/');
      }

      // 4. content를 기반으로 summary를 생성합니다.
      const summary = (content ?? '')
        .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/[#*`_~=\->|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150) + ((content?.length ?? 0) > 150 ? '...' : '');

      // 5. Post 아이템 객체를 완전한 형태로 정의합니다.
      const postItem = {
        PK: `POST#${postId}`, SK: 'METADATA', data_type: 'Post',
        postId, title, content, summary, authorId: userId, authorEmail: userEmail,
        createdAt: now, updatedAt: now, isDeleted: false, viewCount: 0,
        status: status, visibility: visibility,
        authorNickname: authorNickname, // [수정] 조회한 최신 닉네임 사용
        authorBio: authorBio, // <-- 신규 추가
        authorAvatarUrl: authorAvatarUrl,
        tags: tags, thumbnailUrl: thumbnailUrl, imageUrl: imageUrl,
        GSI1_PK: `USER#${userId}`, GSI1_SK: `POST#${now}#${postId}`,
        GSI3_PK: 'POST#ALL', GSI3_SK: `${now}#${postId}`
      };

      const writeRequests: { PutRequest: { Item: Record<string, any> } }[] = [];
      writeRequests.push({ PutRequest: { Item: postItem } });

      // 6. Tag 아이템을 생성할 때, PostCard가 필요한 모든 데이터를 postItem에서 복제합니다.
      for (const tagName of tags) {
        const normalizedTagName = tagName.trim().toLowerCase();
        if (normalizedTagName) {
          const tagItem = {
            PK: `TAG#${normalizedTagName}`, SK: `POST#${postId}`,
            postId: postItem.postId, title: postItem.title, summary: postItem.summary,
            authorNickname: postItem.authorNickname, // [수정] 최신 닉네임 반영
            authorBio: postItem.authorBio, // <-- 신규 추가
            authorAvatarUrl: postItem.authorAvatarUrl,
            createdAt: postItem.createdAt, status: postItem.status,
            visibility: postItem.visibility, thumbnailUrl: postItem.thumbnailUrl,
            viewCount: postItem.viewCount, tags: postItem.tags,
          };
          writeRequests.push({ PutRequest: { Item: tagItem } });
        }
      }

      if (writeRequests.length > 0) {
        await ddbDocClient.send(new BatchWriteCommand({
          RequestItems: { [TABLE_NAME]: writeRequests },
        }));
      }

      return c.json({ message: 'Post created successfully!', post: postItem }, 201);
    } catch (error: any) {
      console.error('Create Post Error:', error.stack || error);
      return c.json({ message: 'Internal Server Error creating post.', error: error.message }, 500);
    }
  }
);

// --- [4] PUT /:postId - 게시물 수정 (v2.3 - 타입 안정성 및 로직 강화 최종본) ---
postsRouter.put(
  '/:postId',
  cookieAuthMiddleware,
  adminOnlyMiddleware,
  zValidator('json', UpdatePostSchema),
  async (c) => {
    const postId = c.req.param('postId');
    const updateData = c.req.valid('json');
    const userId = c.get('userId');
    const now = new Date().toISOString();
    const TABLE_NAME = process.env.TABLE_NAME!;
    const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;

    try {
      // 1. [타입 수정] GetCommand의 결과를 Post 타입으로 명시적으로 다룹니다.
      const { Item } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      }));

      if (!Item || Item.isDeleted) return c.json({ message: 'Post not found.' }, 404);
      if (Item.authorId !== userId) return c.json({ message: 'Forbidden.' }, 403);

      const existingPost = Item as Post; // 이제 TypeScript는 existingPost의 모든 속성을 압니다.

      // 2. 작성자의 최신 프로필 정보를 조회합니다.
      const { Item: authorProfile } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${existingPost.authorId}`, SK: 'PROFILE' },
      }));
      const authorNickname = authorProfile?.nickname || existingPost.authorEmail?.split('@')[0] || '익명';
      const authorBio = authorProfile?.bio || existingPost.authorBio || '';
      const authorAvatarUrl = authorProfile?.avatarUrl || existingPost.authorAvatarUrl || '';

      // 3. 수정될 최종 게시물 상태를 미리 계산합니다.
      const finalPostState: Partial<Post> = { ...updateData, updatedAt: now, authorNickname };

      if (updateData.content) {
        finalPostState.summary = updateData.content.replace(/!\[[^\]]*\]\(([^)]+)\)/g, '').replace(/<[^>]*>?/gm, ' ').replace(/[#*`_~=\->|]/g, '').replace(/\s+/g, ' ').trim().substring(0, 150) + (updateData.content.length > 150 ? '...' : '');
        const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
        const firstImageMatch = updateData.content.match(imageUrlRegex);
        if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
          finalPostState.imageUrl = firstImageMatch[1];
          finalPostState.thumbnailUrl = firstImageMatch[1].replace('/images/', '/thumbnails/');
        } else {
          finalPostState.imageUrl = '';
          finalPostState.thumbnailUrl = '';
        }
      }

      // 4. 태그 동기화 로직
      if (finalPostState.tags) {
        const oldTags: string[] = existingPost.tags || [];
        const newTags: string[] = finalPostState.tags;
        const tagsToDelete = oldTags.filter(t => !newTags.includes(t));
        const tagsToAdd = newTags.filter(t => !oldTags.includes(t));
        const writeRequests: any[] = [];

        tagsToDelete.forEach(tagName => writeRequests.push({ DeleteRequest: { Key: { PK: `TAG#${tagName.trim().toLowerCase()}`, SK: `POST#${postId}` } } }));

        // [핵심] 새로 추가되거나 내용이 변경될 수 있는 모든 Tag 아이템을 다시 씁니다.
        newTags.forEach(tagName => {
          const tagItem = {
            PK: `TAG#${tagName.trim().toLowerCase()}`, SK: `POST#${postId}`,
            postId,
            title: finalPostState.title || existingPost.title,
            summary: finalPostState.summary || existingPost.summary,
            authorNickname: authorNickname,
            authorBio: authorBio,
            authorAvatarUrl: authorAvatarUrl,
            createdAt: existingPost.createdAt,
            status: finalPostState.status || existingPost.status,
            visibility: finalPostState.visibility || existingPost.visibility,
            thumbnailUrl: finalPostState.thumbnailUrl === undefined ? existingPost.thumbnailUrl : finalPostState.thumbnailUrl,
            viewCount: existingPost.viewCount,
            tags: newTags,
          };
          writeRequests.push({ PutRequest: { Item: tagItem } });
        });

        if (writeRequests.length > 0) {
          await ddbDocClient.send(new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: writeRequests } }));
        }
      }

      // 5. Post 아이템을 업데이트합니다.
      const updateExpressionParts: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};   // <-- ':u' 제거
      const expressionAttributeNames: Record<string, string> = {};
      for (const [key, value] of Object.entries(finalPostState)) {
        if (value !== undefined) {
          updateExpressionParts.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      }
      if (updateExpressionParts.length > 0) {
        const updateExpression = `SET ${updateExpressionParts.join(', ')}`;
        const { Attributes } = await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: ReturnValue.ALL_NEW,
        }));
        return c.json({ message: 'Post updated successfully!', post: Attributes }, 200);
      } else {
        return c.json({ message: 'No changes detected.', post: existingPost }, 200);
      }
    } catch (error: any) {
      console.error('Update Post Error:', error);
      return c.json({ message: 'Internal Server Error updating post.', error: error.message }, 500);
    }
  }
);

// --- [5] DELETE /:postId - 게시물 삭제 (v2.0 - S3 이미지 동시 삭제) (인증필요)---
postsRouter.delete(
  '/:postId',
  cookieAuthMiddleware,
  adminOnlyMiddleware,
  async (c) => {
    const postId = c.req.param('postId');
    const userId = c.get('userId');
    const TABLE_NAME = process.env.TABLE_NAME!;
    const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;
    const s3 = new S3Client({ region: process.env.REGION });

    try {
      // 1. 삭제 전 원본 게시물을 가져와 소유권 및 content를 확인합니다.
      const { Item: existingPost } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      }));

      if (!existingPost || existingPost.isDeleted) {
        return c.json({ message: 'Post not found for deletion.' }, 404);
      }
      if (existingPost.authorId !== userId) {
        return c.json({ message: 'Forbidden: You are not the author.' }, 403);
      }

      // 2. [핵심] 게시물 content에서 S3 이미지 URL들을 추출합니다.
      const content = existingPost.content || '';
      // 정규표현식을 사용하여 마크다운 이미지 태그에서 S3 객체 키를 추출합니다.
      const imageUrlRegex = new RegExp(`https://${BUCKET_NAME}.s3.[^/]+/(images|thumbnails)/([^)]+)`, 'g');
      const keysToDelete = new Set<string>();

      let match;
      while ((match = imageUrlRegex.exec(content)) !== null) {
        // match[1] = 'images' or 'thumbnails', match[2] = 'uuid.webp'
        const key = `${match[1]}/${match[2]}`;
        keysToDelete.add(key);
        // 섬네일이 있다면, 원본 이미지도 함께 삭제 목록에 추가 (또는 그 반대)
        if (match[1] === 'images') {
          keysToDelete.add(`thumbnails/${match[2]}`);
        } else {
          keysToDelete.add(`images/${match[2]}`);
        }
      }

      // 3. [핵심] S3에서 추출된 이미지 객체들을 삭제합니다.
      if (keysToDelete.size > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: Array.from(keysToDelete).map(key => ({ Key: key })),
            Quiet: true, // 성공한 객체에 대한 정보를 응답에서 생략
          },
        });
        await s3.send(deleteCommand);
        console.log(`Deleted ${keysToDelete.size} objects from S3 for post ${postId}`);
      }

      // 4. DynamoDB에서 게시물을 soft-delete 합니다.
      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        UpdateExpression: 'set isDeleted = :d, updatedAt = :u',
        ExpressionAttributeValues: { ':d': true, ':u': now },
      }));

      return c.json({ message: 'Post and associated images soft-deleted successfully!' }, 200);

    } catch (error: any) {
      console.error('Delete Post Error:', error);
      return c.json({ message: 'Internal Server Error deleting post.', error: error.message }, 500);
    }
  }
);

export default postsRouter;
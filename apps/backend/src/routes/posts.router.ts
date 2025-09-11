// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { marked } from 'marked';
import { sanitizeContent } from '../lib/sanitizer'; // [신규] 정제기 import
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

// --- [2] GET /:postId - 단일 게시물 조회 (v1.2 - isDeleted 필터링 추가) ---
postsRouter.get('/:postId', tryCookieAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const TABLE_NAME = process.env.TABLE_NAME!;
  const currentUserId = c.get('userId');
  const userGroups = c.get('userGroups');
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
    // 3. GSI3를 사용해 모든 게시물 목록을 시간순으로 가져옵니다.
    const listCommandParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST#ALL' },
      ScanIndexForward: false, // 최신순 정렬
      // [성능 최적화] isDeleted도 확인해야 하므로 ProjectionExpression에 추가합니다.
      ProjectionExpression: 'postId, title, isDeleted',
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

    // --- [핵심 수정] isDeleted가 true인 게시물을 필터링합니다. ---
    const activePosts = allPosts?.filter((p: any) => !p.isDeleted && p.postId) || [];

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

// --- [3] POST / - 새 게시물 생성 (v2.3 - 콘텐츠 정제 적용) ---
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

      // --- [핵심 수정 1] 마크다운을 HTML로 변환 후 정제합니다. ---
      // 1. 마크다운을 HTML로 변환 (비동기 처리)
      const convertedHtml = await marked.parse(content);
      // 2. 변환된 HTML을 정제
      const sanitizedContent = sanitizeContent(convertedHtml);

      // 1. (기존 로직) 작성자 프로필 정보를 조회합니다.
      const { Item: authorProfile } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));

      // 2. (기존 로직) 최종 닉네임을 결정합니다.
      const authorNickname = authorProfile?.nickname || userEmail?.split('@')[0] || '익명';
      const authorBio = authorProfile?.bio || '';
      const authorAvatarUrl = authorProfile?.avatarUrl || '';

      // 3. [수정] 정제된 콘텐츠(sanitizedContent)에서 첫 번째 이미지 URL을 찾습니다.
      const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
      const firstImageMatch = sanitizedContent.match(imageUrlRegex); // [수정] content -> sanitizedContent
      let thumbnailUrl = '';
      let imageUrl = '';
      if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
        imageUrl = firstImageMatch[1];
        thumbnailUrl = imageUrl.replace('/images/', '/thumbnails/');
      }

      // 4. [수정] 정제된 콘텐츠(sanitizedContent)를 기반으로 summary를 생성합니다.
      const summary = (sanitizedContent ?? '') // [수정] content -> sanitizedContent
        .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/[#*`_~=\->|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150) + ((sanitizedContent?.length ?? 0) > 150 ? '...' : '');

      // 5. Post 아이템 객체를 정의할 때, 정제된 content를 사용합니다.
      const postItem = {
        PK: `POST#${postId}`, SK: 'METADATA', data_type: 'Post',
        postId, title,
        content: sanitizedContent, // [수정] content -> sanitizedContent
        summary, authorId: userId, authorEmail: userEmail,
        createdAt: now, updatedAt: now, isDeleted: false, viewCount: 0,
        status: status, visibility: visibility,
        authorNickname: authorNickname,
        authorBio: authorBio,
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

      // --- [핵심 수정] content가 수정된 경우에만 변환, 정제 및 관련 속성 재계산 ---
      if (updateData.content) {
        // 3.1 마크다운을 HTML로 변환 (비동기 처리)
        const convertedHtml = await marked.parse(updateData.content);
        // 3.2 변환된 HTML을 정제합니다.
        const sanitizedContent = sanitizeContent(convertedHtml);
        finalPostState.content = sanitizedContent;

        // 3.2 정제된 content를 기반으로 summary를 재생성합니다.
        finalPostState.summary = sanitizedContent.replace(/!\[[^\]]*\]\(([^)]+)\)/g, '').replace(/<[^>]*>?/gm, ' ').replace(/[#*`_~=\->|]/g, '').replace(/\s+/g, ' ').trim().substring(0, 150) + (sanitizedContent.length > 150 ? '...' : '');

        // 3.3 정제된 content를 기반으로 썸네일을 재추출합니다.
        const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
        const firstImageMatch = sanitizedContent.match(imageUrlRegex);
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

// --- [5] DELETE /:postId - 게시물 삭제 (v2.2 - TAG 아이템 TTL 적용) ---
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
      // 1. (기존 로직) 삭제 전 원본 게시물을 가져옵니다.
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

      // 2. (기존 로직) S3 이미지 URL들을 추출하고 삭제합니다.
      const content = existingPost.content || '';
      // ... (S3 키 추출 및 삭제 로직은 변경 없음)
      const imageUrlRegex = new RegExp(`https://${BUCKET_NAME}.s3.[^/]+/(images|thumbnails)/([^)]+)`, 'g');
      const keysToDelete = new Set<string>();
      let match;
      while ((match = imageUrlRegex.exec(content)) !== null) {
        const key = `${match[1]}/${match[2]}`;
        keysToDelete.add(key);
        if (match[1] === 'images') {
          keysToDelete.add(`thumbnails/${match[2]}`);
        } else {
          keysToDelete.add(`images/${match[2]}`);
        }
      }
      if (keysToDelete.size > 0) {
        await s3.send(new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: { Objects: Array.from(keysToDelete).map(key => ({ Key: key })), Quiet: true },
        }));
        console.log(`Deleted ${keysToDelete.size} objects from S3 for post ${postId}`);
      }

      const now = new Date();
      const ttlInSeconds = Math.floor(now.getTime() / 1000) + (7 * 24 * 60 * 60);

      const updatePromises: Promise<any>[] = [];

      // 3.1 POST 아이템 업데이트 약속(Promise) 추가
      const postUpdatePromise = ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        // [수정] 'ttl'을 별명 '#ttl'으로 변경
        UpdateExpression: 'set isDeleted = :d, updatedAt = :u, #ttl = :ttl',
        // [신규] '#ttl'이 실제로는 'ttl' 속성임을 알려줍니다.
        ExpressionAttributeNames: {
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':d': true,
          ':u': now.toISOString(),
          ':ttl': ttlInSeconds,
        },
      }));
      updatePromises.push(postUpdatePromise);

      // 3.2 TAG 아이템 업데이트 약속(Promise)들 추가
      if (existingPost.tags && existingPost.tags.length > 0) {
        for (const tagName of existingPost.tags) {
          const normalizedTagName = tagName.trim().toLowerCase();
          if (normalizedTagName) {
            const tagUpdatePromise = ddbDocClient.send(new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { PK: `TAG#${normalizedTagName}`, SK: `POST#${postId}` },
              // [수정] 'ttl'을 별명 '#ttl'으로 변경
              UpdateExpression: 'set isDeleted = :d, #ttl = :ttl',
              // [신규] '#ttl'이 실제로는 'ttl' 속성임을 알려줍니다.
              ExpressionAttributeNames: {
                '#ttl': 'ttl',
              },
              ExpressionAttributeValues: {
                ':d': true,
                ':ttl': ttlInSeconds,
              },
            }));
            updatePromises.push(tagUpdatePromise);
          }
        }
      }

      // 4. 모든 업데이트 작업을 병렬로 실행합니다.
      await Promise.all(updatePromises);

      return c.json({ message: 'Post and associated items soft-deleted successfully! TTL set for 7 days.' }, 200);

    } catch (error: any) {
      console.error('Delete Post Error:', error);
      return c.json({ message: 'Internal Server Error deleting post.', error: error.message }, 500);
    }
  }
);

export default postsRouter;
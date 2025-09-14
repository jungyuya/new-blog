// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { cookieAuthMiddleware, adminOnlyMiddleware, tryCookieAuthMiddleware, tryAnonymousAuthMiddleware } from '../middlewares/auth.middleware';
import { togglePostLike, checkUserLikeStatus } from '../services/likes.service';
import type { AppEnv } from '../lib/types';
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

// --- [1] GET / - 모든 게시물 조회 (v2.2 - 페이지네이션 적용) ---
postsRouter.get('/', tryCookieAuthMiddleware, async (c) => {
  const TABLE_NAME = process.env.TABLE_NAME!;
  const userGroups = c.get('userGroups');
  const isAdmin = userGroups?.includes('Admins');

  // [핵심 수정] Zod 스키마에 .default()를 추가하여, 값이 없을 때의 기본값을 명시합니다.
  const { limit, cursor } = z.object({
    limit: z.coerce.number().int().positive().default(12),
    cursor: z.string().optional(),
  }).parse(c.req.query());

  try {
    // 1. 기존 로직: GSI를 사용하여 모든 게시물의 기본 정보를 가져옵니다.
    const commandParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST#ALL' },
      ScanIndexForward: false,
      Limit: limit,
    };

    // [신규] cursor가 있으면, ExclusiveStartKey를 설정합니다.
    if (cursor) {
      try {
        const decodedKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        commandParams.ExclusiveStartKey = decodedKey;
      } catch (e) {
        // 잘못된 형식의 커서는 400 에러를 반환하여 비정상적인 요청을 차단합니다.
        return c.json({ message: 'Invalid cursor format.' }, 400);
      }
    }

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
    const { Items, LastEvaluatedKey } = await ddbDocClient.send(command);
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
          // GSI3 조회 시 이미 'post' 객체에 포함되어 있지만,
          // 만약 값이 없는 경우(오래된 데이터 등)를 대비하여 기본값 0을 설정해줍니다.
          // 이를 통해 프론트엔드는 항상 number 타입의 likeCount를 보장받을 수 있습니다.
          likeCount: post.likeCount || 0,
        };
      })
    );

    // [신규] 다음 페이지를 위한 cursor를 생성합니다.
    const nextCursor = LastEvaluatedKey
      ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64')
      : null;

    return c.json({ posts: enrichedPosts, nextCursor: nextCursor, });

  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

// --- [2] GET /:postId - 단일 게시물 조회 (v3.1 - '좋아요' 상태 포함) ---
postsRouter.get('/:postId', tryCookieAuthMiddleware, tryAnonymousAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const TABLE_NAME = process.env.TABLE_NAME!;
  const currentUserId = c.get('userId');
  const userGroups = c.get('userGroups');
  const isAdmin = userGroups?.includes('Admins');
  const anonymousId = c.get('anonymousId');

  try {
    // 1. 현재 게시물 정보를 가져옵니다.
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    }));

    if (!Item || Item.isDeleted) {
      return c.json({ message: 'Post not found.' }, 404);
    }

    // 2.  비밀글 접근 권한을 검사합니다.
    if (Item.visibility === 'private') {
      if (!currentUserId || Item.authorId !== currentUserId) {
        return c.json({ message: 'Forbidden: You do not have permission to view this post.' }, 403);
      }
    }

    // --- [핵심 수정 1] 현재 사용자가 이 게시물에 '좋아요'를 눌렀는지 확인합니다. ---
    // anonymousId가 존재할 경우에만 서비스 함수를 호출하여 DB를 조회합니다.
    const isLiked = anonymousId ? await checkUserLikeStatus(postId, anonymousId) : false;

    // --- [핵심 수정 2] 이전 글 / 다음 글 정보를 조회합니다. (기존 로직과 동일) ---
    const listCommandParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: { ':pk': 'POST#ALL' },
      ScanIndexForward: false,
      ProjectionExpression: 'postId, title, isDeleted',
    };

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
    const activePosts = allPosts?.filter((p: any) => !p.isDeleted && p.postId) || [];

    const currentIndex = activePosts.findIndex(p => p.postId === postId);
    let prevPost = null;
    let nextPost = null;
    if (currentIndex !== -1) {
      if (currentIndex + 1 < activePosts.length) {
        prevPost = activePosts[currentIndex + 1];
      }
      if (currentIndex - 1 >= 0) {
        nextPost = activePosts[currentIndex - 1];
      }
    }

    // --- [핵심 수정 3] 조회수를 1 증가시킵니다. (기존 로직과 동일) ---
    ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression: 'SET viewCount = if_not_exists(viewCount, :start) + :inc',
      ExpressionAttributeValues: { ':inc': 1, ':start': 0 },
    }));

    // --- [핵심 수정 4] 최종 응답 객체에 isLiked와 likeCount를 포함시킵니다. ---
    const postWithLikeStatus = {
      ...Item,
      isLiked: isLiked,
      likeCount: Item.likeCount || 0, // DB에 likeCount가 없을 경우(초기 상태)를 대비해 기본값 0을 설정
    };

    return c.json({
      post: postWithLikeStatus,
      prevPost,
      nextPost,
    });

  } catch (error: any) {
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

// --- [2.5 좋아요 기능] POST /:postId/like - '좋아요' 토글 ---
postsRouter.post('/:postId/like', tryAnonymousAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const anonymousId = c.get('anonymousId');

  // 방어적 코딩: anonymousId가 없으면 요청을 처리할 수 없으므로 에러를 반환합니다.
  // 프론트엔드에서는 항상 anonymousId를 생성하여 보내주므로, 이 에러는 비정상적인 접근일 가능성이 높습니다.
  if (!anonymousId) {
    return c.json({ message: 'Bad Request: Anonymous ID is missing.' }, 400);
  }

  try {
    // 모든 복잡한 로직은 서비스 레이어에 위임하고, 결과만 받아서 전달합니다.
    const result = await togglePostLike(postId, anonymousId);
    return c.json(result);
  } catch (error: any) {
    console.error('Toggle Like Error:', error);
    // 서비스 레이어에서 발생할 수 있는 특정 에러에 대해 구체적인 응답을 보냅니다.
    if (error.message === 'Post not found') {
      return c.json({ message: 'Post not found.' }, 404);
    }
    // 그 외의 모든 예상치 못한 에러는 500 Internal Server Error로 처리합니다.
    return c.json({ message: 'Internal Server Error processing like.', error: error.message }, 500);
  }
});

// --- [3] POST / - 새 게시물 생성 (v3.0 - 백엔드 정제 로직 제거) ---
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

      // --- [핵심 수정] 백엔드에서 content를 정제하거나 변환하는 로직을 모두 제거합니다. ---
      // const sanitizedContent = sanitizeContent(content); // <- 이 라인을 완전히 삭제했습니다.

      // 1. (기존 로직) 작성자 프로필 정보를 조회합니다.
      const { Item: authorProfile } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));

      // 2. (기존 로직) 최종 닉네임을 결정합니다.
      const authorNickname = authorProfile?.nickname || userEmail?.split('@')[0] || '익명';
      const authorBio = authorProfile?.bio || '';
      const authorAvatarUrl = authorProfile?.avatarUrl || '';

      // 3. [수정] 원본 마크다운(content)에서 첫 번째 이미지 URL을 찾습니다.
      const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
      const firstImageMatch = content.match(imageUrlRegex); // 'sanitizedContent'를 'content'로 변경
      let thumbnailUrl = '';
      let imageUrl = '';
      if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
        imageUrl = firstImageMatch[1];
        thumbnailUrl = imageUrl.replace('/images/', '/thumbnails/');
      }

      // 4. [수정] 원본 마크다운(content)을 기반으로 summary를 생성합니다.
      const summary = (content ?? '') // 'sanitizedContent'를 'content'로 변경
        .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '') // 이미지 태그 제거
        .replace(/<[^>]*>?/gm, ' ') // HTML 태그 제거
        .replace(/[#*`_~=\->|]/g, '') // 마크다운 특수문자 제거
        .replace(/\s+/g, ' ') // 연속된 공백을 하나로
        .trim()
        .substring(0, 150) + ((content?.length ?? 0) > 150 ? '...' : ''); // 'sanitizedContent'를 'content'로 변경

      // 5. Post 아이템 객체를 정의할 때, 원본 마크다운(content)을 저장합니다.
      const postItem = {
        PK: `POST#${postId}`, SK: 'METADATA', data_type: 'Post',
        postId, title,
        content: content, // 'sanitizedContent'를 'content'로 변경하여 원본 저장
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

      // 6. (기존 로직) Tag 아이템을 생성합니다.
      for (const tagName of tags) {
        const normalizedTagName = tagName.trim().toLowerCase();
        if (normalizedTagName) {
          const tagItem = {
            PK: `TAG#${normalizedTagName}`, SK: `POST#${postId}`,
            postId: postItem.postId, title: postItem.title, summary: postItem.summary,
            authorNickname: postItem.authorNickname,
            authorBio: postItem.authorBio,
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

// --- [4] PUT /:postId - 게시물 수정 (v3.0 - 백엔드 정제 로직 제거) ---
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
      // 1. (기존 로직) 수정할 게시물의 원본 데이터를 가져옵니다.
      const { Item } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      }));

      if (!Item || Item.isDeleted) return c.json({ message: 'Post not found.' }, 404);
      if (Item.authorId !== userId) return c.json({ message: 'Forbidden.' }, 403);

      const existingPost = Item as Post;

      // 2. (기존 로직) 작성자의 최신 프로필 정보를 조회합니다.
      const { Item: authorProfile } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${existingPost.authorId}`, SK: 'PROFILE' },
      }));
      const authorNickname = authorProfile?.nickname || existingPost.authorEmail?.split('@')[0] || '익명';
      const authorBio = authorProfile?.bio || existingPost.authorBio || '';
      const authorAvatarUrl = authorProfile?.avatarUrl || existingPost.authorAvatarUrl || '';

      // 3. (기존 로직) 수정될 최종 게시물 상태를 미리 계산합니다.
      const finalPostState: Partial<Post> = { ...updateData, updatedAt: now, authorNickname };

      // --- [핵심 수정] content가 수정된 경우, 원본 마크다운을 기반으로 관련 속성을 재계산합니다. ---
      if (updateData.content) {
        // [삭제] content 정제 로직을 완전히 제거합니다.
        // const sanitizedContent = sanitizeContent(updateData.content);
        // finalPostState.content = sanitizedContent; // <- 이 라인도 필요 없습니다. finalPostState에 이미 updateData.content가 포함되어 있습니다.

        // 3.1 [수정] 원본 마크다운(updateData.content)을 기반으로 summary를 재생성합니다.
        finalPostState.summary = updateData.content
          .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/[#*`_~=\->|]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 150) + (updateData.content.length > 150 ? '...' : '');

        // 3.2 [수정] 원본 마크다운(updateData.content)을 기반으로 썸네일을 재추출합니다.
        const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
        const firstImageMatch = updateData.content.match(imageUrlRegex); // 'sanitizedContent'를 'updateData.content'로 변경
        if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
          finalPostState.imageUrl = firstImageMatch[1];
          finalPostState.thumbnailUrl = firstImageMatch[1].replace('/images/', '/thumbnails/');
        } else {
          finalPostState.imageUrl = '';
          finalPostState.thumbnailUrl = '';
        }
      }

      // 4. (기존 로직) 태그 동기화 로직
      if (finalPostState.tags) {
        const oldTags: string[] = existingPost.tags || [];
        const newTags: string[] = finalPostState.tags;
        const tagsToDelete = oldTags.filter(t => !newTags.includes(t));
        const writeRequests: any[] = [];

        tagsToDelete.forEach(tagName => writeRequests.push({ DeleteRequest: { Key: { PK: `TAG#${tagName.trim().toLowerCase()}`, SK: `POST#${postId}` } } }));

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

      // 5. (기존 로직) Post 아이템을 업데이트합니다.
      const updateExpressionParts: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
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

// --- [요약 기능] GET /:postId/summary - AI 요약 조회/생성 ---
// --- 안전한 JSON 추출 헬퍼 함수 ---
function extractJsonObject(text: string): any {
  // AI 응답에 포함될 수 있는 ```json ... ``` 코드 블록을 제거합니다.
  const cleanedText = text.replace(/^```json\s*|```$/g, '');

  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    // 응답에서 유효한 JSON 객체를 찾지 못한 경우 에러를 발생시킵니다.
    throw new Error('No valid JSON object found in AI response.');
  }

  const jsonText = cleanedText.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonText);
}

postsRouter.get(
  '/:postId/summary',
  async (c) => {
    const postId = c.req.param('postId');
    const TABLE_NAME = process.env.TABLE_NAME!;
    const REGION = process.env.REGION!;

    try {
      // 1. DB에서 게시물 원본을 가져옵니다.
      const getCommand = new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        ProjectionExpression: 'content, aiSummary, aiKeywords', // aiKeywords도 함께 조회
      });
      const { Item: post } = await ddbDocClient.send(getCommand);

      if (!post) {
        return c.json({ message: 'Post not found.' }, 404);
      }

      // 2. 캐시 확인: aiSummary가 이미 존재하는지 확인합니다.
      if (post.aiSummary) {
        console.log(`[AI Summary] Cache hit for postId: ${postId}`);
        return c.json({
          summary: post.aiSummary,
          keywords: post.aiKeywords || [], // keywords가 없을 경우를 대비
          source: 'cache'
        });
      }

      console.log(`[AI Summary] Cache miss for postId: ${postId}. Invoking Bedrock...`);
      // 3. 캐시 없음 (Cache Miss): Bedrock을 호출하여 새로 생성합니다.
      const bedrockClient = new BedrockRuntimeClient({ region: REGION });

      // Bedrock에 보낼 순수 텍스트를 추출합니다.
      const textOnlyContent = (post.content || '')
        .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '') // 이미지 태그 제거
        .replace(/<[^>]*>?/gm, ' ') // HTML 태그 제거
        .replace(/[#*`_~=\->|]/g, '') // 마크다운 특수문자 제거
        .replace(/\s+/g, ' ')
        .trim();

      // [방어 코드] 본문 내용이 너무 짧으면 AI 호출을 건너뜁니다.
      if (textOnlyContent.length < 50) {
        return c.json({ summary: '요약하기에는 글의 내용이 너무 짧습니다.', keywords: [], source: 'error' });
      }

      // Claude 3 Haiku를 위한 프롬프트
      // Claude 3 Haiku를 위한 개선된 프롬프트
// Claude 3 Haiku를 위한 최종 프롬프트 (번호 추가)
  const prompt = `
    Human: 당신은 IT 기술 블로그의 전문 에디터입니다. 모든 답변은 반드시 한국어 존댓말로, 그리고 지정된 JSON 형식으로만 응답해야 합니다. 당신의 임무는 주어진 기술 게시물을 분석하여, 독자들이 글의 핵심 내용을 30초 안에 파악할 수 있도록 **매우 간결하고 명확한** 요약문을 생성하는 것입니다.

    다음 <article> 태그 안의 내용을 분석하여, 아래 <output_format> 형식과 **제약 조건**에 맞춰 결과를 JSON 객체로 출력해주세요.

    <article>
    ${textOnlyContent.substring(0, 10000)}
    </article>

    <output_format>
    {
      "summary": [
        "1. 첫 번째 핵심 요약 문장 (60자 내외)",
        "2. 두 번째 핵심 요약 문장 (60자 내외)",
        "3. 세 번째 핵심 요약 문장 (60자 내외)"
      ],
      "keywords": ["핵심 키워드 1", "핵심 키워드 2", "핵심 키워드 3"]
    }
    </output_format>

    **제약 조건:**
    - **요약:** 각 문장은 **숫자와 점(예: "1. ")으로 시작**하고, **반드시 50자 내외**로 작성해주세요.
    - **키워드:** 가장 핵심적인 키워드 3개만 추출합니다.
    - **출력:** 다른 설명 없이, 오직 유효한 JSON 객체만 출력해야 합니다.

    Assistant:
    `;

      const bedrockCommand = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 500, // JSON 구조와 내용을 포함해야 하므로 토큰을 조금 더 넉넉하게 설정
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const apiResponse = await bedrockClient.send(bedrockCommand);
      const decodedBody = new TextDecoder().decode(apiResponse.body);
      const responseBody = JSON.parse(decodedBody);

      const aiResultText = responseBody.content?.[0]?.text ?? '';
      //  안전한 JSON 추출 함수를 사용합니다.
      const aiResultJson = extractJsonObject(aiResultText);

      //  기본값을 보장하여 안정성을 높입니다.
      const newSummary = Array.isArray(aiResultJson.summary) ? aiResultJson.summary.join('\n') : String(aiResultJson.summary || '');
      const keywords = Array.isArray(aiResultJson.keywords) ? aiResultJson.keywords : [];

      // 4. 생성된 요약을 DB에 저장(캐싱)합니다. - await 추가
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        UpdateExpression: 'SET aiSummary = :summary, aiKeywords = :keywords',
        ExpressionAttributeValues: {
          ':summary': newSummary,
          ':keywords': keywords, // 이제 keywords는 항상 배열이므로 안전합니다.
        },
      }));

      // 5. 생성된 요약을 사용자에게 반환합니다. - return 추가
      return c.json({ summary: newSummary, keywords, source: 'live' });

    } catch (error: any) {
      console.error('AI Summary Error:', error);
      return c.json({ message: 'Failed to generate AI summary.', error: error.message }, 500);
    }
  }
);

export default postsRouter;
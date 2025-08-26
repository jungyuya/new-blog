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
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '수정할 내용을 하나 이상 제공해야 합니다.' }
);

const postsRouter = new Hono<AppEnv>();

// --- [1] GET / - 모든 게시물 조회 (v2.0 - 역할 기반 동적 필터링) ---
postsRouter.get('/', tryCookieAuthMiddleware, async (c) => {
  const TABLE_NAME = process.env.TABLE_NAME!;

  // 1. 선택적 인증을 통해 사용자 정보를 가져옵니다.
  const userGroups = c.get('userGroups');
  const isAdmin = userGroups?.includes('Admins');

  try {
    const commandParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3_PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'POST#ALL',
      },
      ScanIndexForward: false,
    };

    // 2. [핵심] 관리자가 아닐 경우에만 필터를 적용합니다.
    if (!isAdmin) {
      commandParams.FilterExpression = '#status = :published AND #visibility = :public';
      commandParams.ExpressionAttributeNames = {
        '#status': 'status',
        '#visibility': 'visibility',
      };
      commandParams.ExpressionAttributeValues![':published'] = 'published';
      commandParams.ExpressionAttributeValues![':public'] = 'public';
    }
    // 관리자일 경우, FilterExpression이 없으므로 모든 글(isDeleted=false 제외)을 가져옵니다.

    const command = new QueryCommand(commandParams);
    const { Items } = await ddbDocClient.send(command);

    const activePosts = Items?.filter((i) => !i.isDeleted) || [];

    return c.json({ posts: activePosts });
  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

// --- [2] GET /:postId - 단일 게시물 조회 ---
postsRouter.get('/:postId', tryCookieAuthMiddleware, async (c) => {
  // 1. URL 경로에서 'postId'를 가져옵니다.
  const postId = c.req.param('postId');
  const TABLE_NAME = process.env.TABLE_NAME!;

  // 2. [핵심] 'tryCookieAuthMiddleware' 덕분에,
  //    로그인 상태이면 userId가 있고, 비로그인 상태이면 undefined가 됩니다.
  const currentUserId = c.get('userId');

  try {
    // 3. 먼저 데이터베이스에서 해당 postId의 게시물 정보를 가져옵니다.
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    }));

    // 4. 게시물이 존재하지 않거나, 이미 삭제된 상태이면 404 에러를 반환합니다.
    if (!Item || Item.isDeleted) {
      return c.json({ message: 'Post not found.' }, 404);
    }

    // 5. [핵심] '비밀글'에 대한 접근 권한을 검사합니다.
    if (Item.visibility === 'private') {
      // 5-1. 글이 '비밀글'인데,
      // 5-2. 현재 사용자가 비로그인 상태(currentUserId가 없음)이거나,
      // 5-3. 로그인했지만 글의 작성자(Item.authorId)가 아니라면,
      if (!currentUserId || Item.authorId !== currentUserId) {
        // "권한 없음" 에러를 반환하고 즉시 처리를 중단합니다.
        return c.json({ message: 'Forbidden: You do not have permission to view this post.' }, 403);
      }
    }

    // 6. [핵심] 위 관문을 모두 통과했다면, 조회수를 1 증가시킵니다.
    //    사용자에게 응답을 빨리 보내주기 위해, 이 작업은 백그라운드에서 실행되도록
    //    'await'를 붙이지 않습니다. (Fire and Forget)
    ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      UpdateExpression: 'SET viewCount = if_not_exists(viewCount, :start) + :inc',
      ExpressionAttributeValues: { ':inc': 1, ':start': 0 },
    }));

    // 7. 최종적으로, 사용자에게 게시물 정보를 담아 200 OK 응답을 보냅니다.
    return c.json({ post: Item });

  } catch (error: any) {
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

// --- [3] POST / - 새 게시물 생성 (인증 필요) ---
postsRouter.post('/', cookieAuthMiddleware, adminOnlyMiddleware, zValidator('json', CreatePostSchema), async (c) => {
  try {
    // 1. 유효성 검사를 통과한 데이터를 가져옵니다.
    //    기본값을 설정하여, 클라이언트가 값을 보내지 않아도 안전하게 처리합니다.
    const {
      title,
      content,
      tags = [],
      status = 'published',
      visibility = 'public'
    } = c.req.valid('json');

    const userId = c.get('userId');
    const userEmail = c.get('userEmail');
    const postId = uuidv4();
    const now = new Date().toISOString();
    const TABLE_NAME = process.env.TABLE_NAME!;

    // 2. [수정] 확장된 속성을 포함하여 Post 아이템 객체를 정의합니다.
    const postItem = {
      PK: `POST#${postId}`,
      SK: 'METADATA',
      data_type: 'Post',
      postId,
      title,
      content,
      authorId: userId,
      authorEmail: userEmail,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      viewCount: 0,
      // --- [반영된 속성들] ---
      status: status,
      visibility: visibility,
      authorNickname: userEmail?.split('@')[0] || '익명', // 임시 닉네임
      tags: tags,
      thumbnailUrl: '', // 아직 기능이 없으므로 빈 값
      // ---
      GSI1_PK: `USER#${userId}`,
      GSI1_SK: `POST#${now}#${postId}`,
      GSI3_PK: 'POST#ALL',
      GSI3_SK: `${now}#${postId}`
    };

    // 3. DynamoDB에 보낼 모든 쓰기 요청을 담을 배열을 준비합니다.
    const writeRequests: { PutRequest: { Item: Record<string, any> } }[] = [];

    // 4. Post 아이템 생성 요청을 배열에 추가합니다.
    writeRequests.push({
      PutRequest: { Item: postItem },
    });

    // 5. 각 Tag에 대한 아이템 생성 요청을 배열에 추가합니다.
    for (const tagName of tags) {
      // 태그 이름에 공백이나 특수문자가 있을 수 있으므로 정규화(normalize)합니다.
      const normalizedTagName = tagName.trim().toLowerCase();
      if (normalizedTagName) { // 빈 태그는 저장하지 않습니다.
        const tagItem = {
          PK: `TAG#${normalizedTagName}`,
          SK: `POST#${postId}`,
          postId: postId,
          title: title,
          createdAt: now,
          authorNickname: postItem.authorNickname,
          status: postItem.status,
          visibility: postItem.visibility,
        };
        writeRequests.push({
          PutRequest: { Item: tagItem },
        });
      }
    }

    // 6. BatchWriteCommand를 사용하여 모든 아이템을 한 번에 생성합니다.
    if (writeRequests.length > 0) {
      const command = new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: writeRequests,
        },
      });
      await ddbDocClient.send(command);
    }

    // 7. 성공 응답을 반환합니다.
    return c.json({ message: 'Post created successfully!', post: postItem }, 201);

  } catch (error: any) {
    console.error('Create Post Error:', error.stack || error);
    return c.json({ message: 'Internal Server Error creating post.', error: error.message }, 500);
  }
});

// --- [4] PUT /:postId - 게시물 수정 (인증 필요) ---
postsRouter.put(
  '/:postId',
  cookieAuthMiddleware,
  adminOnlyMiddleware, // [추가] 권한 검사
  zValidator('json', UpdatePostSchema),
  async (c) => {
    const postId = c.req.param('postId');
    const updateData = c.req.valid('json');
    const userId = c.get('userId');
    const now = new Date().toISOString();
    const TABLE_NAME = process.env.TABLE_NAME!;

    try {
      // 1. 수정 전 원본 게시물을 가져와 소유권을 확인합니다.
      const { Item: existingPost } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
      }));

      if (!existingPost || existingPost.isDeleted) {
        return c.json({ message: 'Post not found for update.' }, 404);
      }
      if (existingPost.authorId !== userId) {
        return c.json({ message: 'Forbidden: You are not the author.' }, 403);
      }

      // 2. [핵심] 태그(tags)가 변경된 경우, 기존 태그 아이템을 삭제하고 새로 생성합니다.
      //    (DynamoDB TransactWriteItems를 사용하면 더 안전하게 처리할 수 있습니다.)
      if (updateData.tags) {
        const oldTags = existingPost.tags || [];
        const newTags = updateData.tags;

        // 삭제할 태그: (기존 태그) - (새 태그)
        const tagsToDelete = oldTags.filter((t: string) => !newTags.includes(t));
        // 추가할 태그: (새 태그) - (기존 태그)
        const tagsToAdd = newTags.filter((t: string) => !oldTags.includes(t));

        const writeRequests: any[] = [];

        // 삭제 요청 추가
        tagsToDelete.forEach((tagName: string) => {
          writeRequests.push({
            DeleteRequest: { Key: { PK: `TAG#${tagName.trim().toLowerCase()}`, SK: `POST#${postId}` } },
          });
        });

        // 추가 요청 추가
        tagsToAdd.forEach((tagName: string) => {
          writeRequests.push({
            PutRequest: {
              Item: {
                PK: `TAG#${tagName.trim().toLowerCase()}`,
                SK: `POST#${postId}`,
                postId: postId,
                title: updateData.title || existingPost.title, // 제목이 바뀌면 새 제목으로
                createdAt: existingPost.createdAt,
                authorNickname: existingPost.authorNickname,
                status: updateData.status || existingPost.status,
                visibility: updateData.visibility || existingPost.visibility,
              }
            },
          });
        });

        if (writeRequests.length > 0) {
          await ddbDocClient.send(new BatchWriteCommand({
            RequestItems: { [TABLE_NAME]: writeRequests },
          }));
        }
      }

      // 3. [핵심] DynamoDB UpdateExpression을 동적으로 생성합니다.
      //    클라이언트가 보낸 데이터만 선택적으로 업데이트합니다.
      const updateExpressionParts: string[] = [];
      const expressionAttributeValues: Record<string, any> = { ':u': now };
      const expressionAttributeNames: Record<string, string> = {};

      // updateData의 각 키에 대해 UpdateExpression을 구성합니다.
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          const attrName = `#${key}`;
          const attrValue = `:${key}`;
          updateExpressionParts.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        }
      }

      // 업데이트할 내용이 있을 경우에만 실행
      if (updateExpressionParts.length > 0) {
        const updateExpression = `SET updatedAt = :u, ${updateExpressionParts.join(', ')}`;

        const { Attributes } = await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `POST#${postId}`, SK: 'METADATA' },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: ReturnValue.ALL_NEW,
        }));
        return c.json({ message: 'Post updated successfully!', post: Attributes }, 200);
      } else {
        // 업데이트할 내용이 없으면 기존 게시물을 그대로 반환
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
// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { cookieAuthMiddleware, adminOnlyMiddleware } from '../middlewares/auth.middleware';
import type { AppEnv } from '../lib/types';

const CreatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용은 필수 항목입니다.'),
  tags: z.array(z.string()).optional(),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
}).refine(data => data.title !== undefined || data.content !== undefined, {
  message: '제목 또는 내용은 최소 하나 이상 제공되어야 합니다.',
});

const postsRouter = new Hono<AppEnv>();

// [1] GET / - 모든 게시물 조회
postsRouter.get('/', async (c) => {
  const TABLE_NAME = process.env.TABLE_NAME!;
  try {
    const { Items } = await ddbDocClient.send(new QueryCommand({ TableName: TABLE_NAME, IndexName: 'GSI3', KeyConditionExpression: 'GSI3_PK = :pk', ExpressionAttributeValues: { ':pk': 'POST#ALL' }, ScanIndexForward: false }));
    const activePosts = Items?.filter((i) => i.data_type === 'Post' && !i.isDeleted) || [];
    return c.json({ posts: activePosts });
  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

// [2] GET /:postId - 단일 게시물 조회
postsRouter.get('/:postId', async (c) => {
  const postId = c.req.param('postId');
  const TABLE_NAME = process.env.TABLE_NAME!;
  try {
    const { Item } = await ddbDocClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' } }));
    if (!Item || Item.isDeleted) return c.json({ message: 'Post not found.' }, 404);
    return c.json({ post: Item });
  } catch (error: any) {
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

// --- [3] POST / - 새 게시물 생성 (인증 필요) ---
postsRouter.post('/', cookieAuthMiddleware, adminOnlyMiddleware, zValidator('json', CreatePostSchema), async (c) => {  try {
    const { title, content, tags = [] } = c.req.valid('json'); // tags가 없으면 빈 배열([])을 기본값으로 사용
    const userId = c.get('userId');
    const userEmail = c.get('userEmail');
    const postId = uuidv4();
    const now = new Date().toISOString();
    const TABLE_NAME = process.env.TABLE_NAME!;

    // 1. 게시물(Post) 아이템 객체를 먼저 정의합니다.
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
      isPublished: true, // 기본값: 발행 상태
      authorNickname: userEmail?.split('@')[0] || '익명',
      tags: tags, // 클라이언트로부터 받은 태그
      thumbnailUrl: '',
      GSI1_PK: `USER#${userId}`,
      GSI1_SK: `POST#${now}#${postId}`,
      GSI3_PK: 'POST#ALL',
      GSI3_SK: `${now}#${postId}`
    };

    // 2. DynamoDB에 보낼 모든 쓰기 요청을 담을 배열을 준비합니다.
    //    타입을 명시하여 안정성을 높입니다.
    const writeRequests: { PutRequest: { Item: Record<string, any> } }[] = [];

    // 3. 게시물(Post) 아이템 생성 요청을 배열에 추가합니다.
    writeRequests.push({
      PutRequest: {
        Item: postItem,
      },
    });

    // 4. 각 태그(Tag)에 대한 아이템 생성 요청을 배열에 추가합니다.
    for (const tagName of tags) {
      const tagItem = {
        PK: `TAG#${tagName.trim()}`, // 태그 앞뒤 공백 제거
        SK: `POST#${postId}`,
        // 검색 결과 페이지에서 사용할 데이터를 비정규화하여 저장 (읽기 성능 최적화)
        postId: postId,
        title: title,
        createdAt: now,
        authorNickname: postItem.authorNickname,
        isPublished: postItem.isPublished,
      };
      writeRequests.push({
        PutRequest: {
          Item: tagItem,
        },
      });
    }

    // 5. BatchWriteCommand를 사용하여 모든 아이템을 한 번의 API 호출로 생성합니다.
    //    RequestItems의 테이블 이름은 반드시 process.env.TABLE_NAME을 사용해야 합니다.
    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: writeRequests,
      },
    });
    await ddbDocClient.send(command);

    // 6. 성공 시, 생성된 게시물 정보를 클라이언트에 반환합니다.
    return c.json({ message: 'Post created successfully!', post: postItem }, 201);

  } catch (error: any) {
    console.error('Create Post Error:', error.stack || error);
    return c.json({ message: 'Internal Server Error creating post.', error: error.message }, 500);
  }
});

// [4] PUT /:postId - 게시물 수정 (인증 필요)
postsRouter.put('/:postId', cookieAuthMiddleware, adminOnlyMiddleware, zValidator('json', UpdatePostSchema), async (c) => {
  const postId = c.req.param('postId');
  const { title, content } = c.req.valid('json');
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const TABLE_NAME = process.env.TABLE_NAME!;
  try {
    const { Item: existing } = await ddbDocClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' } }));
    if (!existing || existing.isDeleted) return c.json({ message: 'Post not found for update.' }, 404);
    if (existing.authorId !== userId) return c.json({ message: 'Forbidden: You are not the author.' }, 403);
    let UpdateExpression = 'set updatedAt = :u';
    const vals: any = { ':u': now };
    if (title) { UpdateExpression += ', title = :t'; vals[':t'] = title; }
    if (content) { UpdateExpression += ', content = :c'; vals[':c'] = content; }
    const { Attributes } = await ddbDocClient.send(new UpdateCommand({ TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' }, UpdateExpression, ExpressionAttributeValues: vals, ReturnValues: ReturnValue.ALL_NEW }));
    return c.json({ message: 'Post updated successfully!', post: Attributes }, 200);
  } catch (error: any) {
    console.error('Update Post Error:', error);
    return c.json({ message: 'Internal Server Error updating post.', error: error.message }, 500);
  }
});

// [5] DELETE /:postId - 게시물 삭제 (인증 필요)
postsRouter.delete('/:postId', cookieAuthMiddleware, adminOnlyMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const TABLE_NAME = process.env.TABLE_NAME!;
  try {
    const { Item: existing } = await ddbDocClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' } }));
    if (!existing || existing.isDeleted) return c.json({ message: 'Post not found for deletion.' }, 404);
    if (existing.authorId !== userId) return c.json({ message: 'Forbidden: You are not the author.' }, 403);
    await ddbDocClient.send(new UpdateCommand({ TableName: TABLE_NAME, Key: { PK: `POST#${postId}`, SK: 'METADATA' }, UpdateExpression: 'set isDeleted = :d, updatedAt = :u', ExpressionAttributeValues: { ':d': true, ':u': now } }));
    return c.json({ message: 'Post soft-deleted successfully!' }, 200);
  } catch (error: any) {
    console.error('Delete Post Error:', error);
    return c.json({ message: 'Internal Server Error deleting post.', error: error.message }, 500);
  }
});

export default postsRouter;
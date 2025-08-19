// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { cookieAuthMiddleware, adminOnlyMiddleware } from '../middlewares/auth.middleware'; 
import type { AppEnv } from '../lib/types';

const CreatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용은 필수 항목입니다.'),
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

// [3] POST / - 새 게시물 생성 (인증 필요)
postsRouter.post('/', cookieAuthMiddleware, adminOnlyMiddleware, zValidator('json', CreatePostSchema), async (c) => {
  const { title, content } = c.req.valid('json');
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const postId = uuidv4();
  const now = new Date().toISOString();
  const TABLE_NAME = process.env.TABLE_NAME!;
  const item = { PK: `POST#${postId}`, SK: 'METADATA', data_type: 'Post', postId, title, content, authorId: userId, authorEmail: userEmail, createdAt: now, updatedAt: now, isDeleted: false, viewCount: 0, GSI1_PK: `USER#${userId}`, GSI1_SK: `POST#${now}#${postId}`, GSI3_PK: 'POST#ALL', GSI3_SK: `${now}#${postId}` };

  try {
    await ddbDocClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return c.json({ message: 'Post created successfully!', post: item }, 201);
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
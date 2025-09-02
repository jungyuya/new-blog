// 파일 위치: apps/backend/src/routes/tags.router.ts
import { Hono } from 'hono';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import type { AppEnv } from '../lib/types';

const tagsRouter = new Hono<AppEnv>();

// --- [1] GET /:tagName/posts - 특정 태그가 달린 게시물 목록 조회 ---
tagsRouter.get('/:tagName/posts', async (c) => {
  const tagName = c.req.param('tagName').toLowerCase();
  const TABLE_NAME = process.env.TABLE_NAME!;

  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      // GSI2를 사용합니다.
      IndexName: 'GSI2', 
      KeyConditionExpression: 'PK = :pk',
      // [핵심] 공개되고 발행된 글만 필터링합니다.
      FilterExpression: '#status = :published AND #visibility = :public',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#visibility': 'visibility',
      },
      ExpressionAttributeValues: {
        ':pk': `TAG#${tagName}`,
        ':published': 'published',
        ':public': 'public',
      },
      ScanIndexForward: false, // 최신순으로 정렬
    });

    const { Items } = await ddbDocClient.send(command);

    return c.json({ posts: Items || [] });
  } catch (error: any) {
    console.error(`Error fetching posts for tag ${tagName}:`, error);
    return c.json({ message: 'Internal Server Error fetching posts by tag.', error: error.message }, 500);
  }
});

export default tagsRouter;
// 파일 위치: apps/backend/src/routes/tags.router.ts
import { Hono } from 'hono';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'; // [수정] ScanCommand import
import { ddbDocClient } from '../lib/dynamodb';
import type { AppEnv } from '../lib/types';

const tagsRouter = new Hono<AppEnv>();

// --- [신규] GET /popular - 가장 많이 사용된 태그 목록 조회 ---
tagsRouter.get('/popular', async (c) => {
  const TABLE_NAME = process.env.TABLE_NAME!;
  try {
    // 1. 모든 TAG 아이템을 스캔합니다.
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'TAG#',
      },
      // 필요한 최소한의 데이터(PK)만 가져와 성능을 최적화합니다.
      ProjectionExpression: 'PK',
    });

    const { Items } = await ddbDocClient.send(command);

    if (!Items || Items.length === 0) {
      return c.json({ tags: [] });
    }

    // 2. 태그별로 게시물 수를 카운트합니다.
    const tagCounts: Record<string, number> = {};
    Items.forEach(item => {
      const tagName = item.PK.replace('TAG#', '');
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
    });

    // 3. 카운트가 높은 순서대로 정렬하고, 상위 6개만 추출합니다.
    const popularTags = Object.entries(tagCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 6) // 상위 6개의 태그만 반환
      .map(([name, count]) => ({ name, count }));

    return c.json({ tags: popularTags });

  } catch (error: any) {
    console.error('Error fetching popular tags:', error);
    return c.json({ message: 'Internal Server Error fetching popular tags.', error: error.message }, 500);
  }
});

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
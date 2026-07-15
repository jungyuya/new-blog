// 파일 위치: apps/backend/src/search-handler.ts
// [변경] OpenSearch → DynamoDB Scan 기반 키워드 검색으로 전환

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE_NAME!;

interface SearchResult {
  postId: string;
  title: string;
  content: string;
  thumbnailUrl?: string;
  status: string;
  visibility: string;
  tags?: string[];
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const query = event.queryStringParameters?.q || '';

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Search query(q) is required.' }) };
  }

  if (query.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ message: '검색어는 2글자 이상이어야 합니다.' }) };
  }

  try {
    const result = await client.send(new ScanCommand({
      TableName: TABLE_NAME,
      // 제목 또는 요약(summary)에 검색어가 포함된 게시물만 필터링
      FilterExpression:
        '(contains(#title, :kw) OR contains(#summary, :kw)) AND #status = :pub AND #visibility = :pub_v AND attribute_not_exists(#deleted)',
      ExpressionAttributeNames: {
        '#title': 'title',
        '#summary': 'summary',
        '#status': 'status',
        '#visibility': 'visibility',
        '#deleted': 'isDeleted',
      },
      ExpressionAttributeValues: {
        ':kw': { S: query },
        ':pub': { S: 'published' },
        ':pub_v': { S: 'public' },
      },
      ProjectionExpression: 'postId, title, summary, thumbnailUrl, #status, #visibility, tags',
    }));

    const posts = (result.Items ?? [])
      .map(item => unmarshall(item))
      .filter(item => item.postId); // postId 없는 항목 제거 (SK 기반 데이터 혼입 방지)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Search successful',
        query,
        results: posts.map(p => ({
          postId: p.postId,
          title: p.title,
          content: p.summary ? p.summary.substring(0, 200) : '',
          thumbnailUrl: p.thumbnailUrl,
          status: p.status,
          visibility: p.visibility,
          tags: p.tags,
        })),
      }),
    };
  } catch (error) {
    console.error('Error during search:', error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to perform search.' }) };
  }
};
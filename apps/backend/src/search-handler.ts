// 파일 위치: apps/backend/src/search-handler.ts

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION!,
    service: 'es',
  }),
  node: process.env.OPENSEARCH_ENDPOINT!,
});

const INDEX_NAME = 'posts';

// [수정] OpenSearch 문서 타입 정의 확장
interface PostDocument {
  postId: string;
  parentPostId?: string; // 원본 글 ID (청킹된 경우 존재)
  title: string;
  content: string;
  thumbnailUrl?: string;
  status: 'published' | 'draft';
  visibility: 'public' | 'private';
  tags?: string[];
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const query = event.queryStringParameters?.q || '';

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Search query(q) is required.' }) };
  }

  try {
    const response = await opensearchClient.search({
      index: INDEX_NAME,
      body: {
        query: {
          bool: {
            must: [
              {
                simple_query_string: {
                  query: query,
                  fields: ['title^3', 'content', 'tags^2'],
                  default_operator: 'AND',
                },
              },
            ],
            filter: [
              { term: { status: 'published' } },
              { term: { visibility: 'public' } },
              { term: { isDeleted: false } }
            ],
          },
        },
        _source: ['postId', 'parentPostId', 'title', 'content', 'thumbnailUrl', 'status', 'visibility', 'tags'] // 필요한 필드만 가져옴
      },
    });

    const hits = response.body.hits.hits;

    // [핵심 수정] 검색 결과 매핑 및 중복 제거
    const searchResults = hits.map((hit: any) => {
      const source = hit._source as PostDocument;
      return {
        // parentPostId가 있으면 그것을 진짜 postId로 사용
        postId: source.parentPostId || source.postId,
        title: source.title,
        // content는 너무 길 수 있으므로 앞부분만 자르거나 그대로 사용 (선택 사항)
        content: source.content.substring(0, 200) + '...',
        thumbnailUrl: source.thumbnailUrl,
        status: source.status,
        visibility: source.visibility,
        tags: source.tags
      };
    });

    // [중복 제거] 같은 글의 여러 청크가 검색될 수 있으므로, postId 기준으로 중복을 제거합니다.
    const uniqueResults = Array.from(new Map(searchResults.map((item: any) => [item.postId, item])).values());

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Search successful', query, results: uniqueResults }),
    };
  } catch (error) {
    console.error('Error during search:', error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to perform search.' }) };
  }
};
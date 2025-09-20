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

// OpenSearch 문서의 타입을 정의합니다.
interface PostDocument {
  postId: string;
  title: string;
  content: string;
  thumbnailUrl?: string;
  status: 'published' | 'draft';
  visibility: 'public' | 'private';
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
              { term: { isDeleted: false } } // [핵심 추가]
            ],
          },
        },
      },
    });

    // [핵심 최종 수정] hit._source를 PostDocument 타입으로 단언(assert)합니다.
    const searchResults = response.body.hits.hits.map((hit) => hit._source as PostDocument);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Search successful', query, results: searchResults }),
    };
  } catch (error) {
    console.error('Error during search:', error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to perform search.' }) };
  }
};
// apps/backend/src/search-handler.ts

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

const opensearchClient = new Client({
  ...(AwsSigv4Signer({
    region: process.env.AWS_REGION!,
    service: 'es', 
  }) as any),
  node: process.env.OPENSEARCH_ENDPOINT!,
});

const INDEX_NAME = 'posts';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('Search API event received:', JSON.stringify(event, null, 2));
  const query = event.queryStringParameters?.q || '';

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Search query(q) is required.' }) };
  }

  try {
    // --- 핵심: search 함수를 "Promise 반환형"으로 강제 캐스트
    const searchAsPromise = opensearchClient.search as unknown as (params: any) => Promise<any>;

    const response = await searchAsPromise({
      index: INDEX_NAME,
      body: {
        query: {
          simple_query_string: {
            query: query,
            fields: ['title^3', 'content', 'tags^2'],
            default_operator: 'AND',
          },
        },
      },
    });

    const searchResults = (response?.body?.hits?.hits || []).map((hit: any) => hit._source);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Search successful', query, results: searchResults }),
    };
  } catch (error) {
    console.error('Error during search:', typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error));
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to perform search.' }) };
  }
};

// 파일 위치: scripts/migrate-to-opensearch.ts

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import { Client } from '@opensearch-project/opensearch'; // [수정] OpenSearchClient -> Client
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const REGION = process.env.AWS_REGION || 'ap-northeast-2';
const DYNAMODB_TABLE_NAME = process.env.MIGRATE_TABLE_NAME;
const OPENSEARCH_ENDPOINT = process.env.MIGRATE_OPENSEARCH_ENDPOINT;
const INDEX_NAME = 'posts';

if (!DYNAMODB_TABLE_NAME || !OPENSEARCH_ENDPOINT) {
  console.error('Error: Please define MIGRATE_TABLE_NAME and MIGRATE_OPENSEARCH_ENDPOINT in your .env file.');
  process.exit(1);
}

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const opensearchClient = new Client({ // [수정] OpenSearchClient -> Client
  ...AwsSigv4Signer({
    region: REGION,
    service: 'es',
  }),
  node: OPENSEARCH_ENDPOINT,
});

async function migrate() {
  console.log(`Starting migration from DynamoDB table "${DYNAMODB_TABLE_NAME}" to OpenSearch index "${INDEX_NAME}"...`);

  let allPosts: Record<string, any>[] = [];
  // [수정] lastEvaluatedKey에 명시적인 타입 추가
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  console.log('Scanning DynamoDB table...');
  do {
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE_NAME,
      IndexName: 'GSI3',
      FilterExpression: 'attribute_exists(postId)',
      ExclusiveStartKey: lastEvaluatedKey,
    });
    
    // [수정] 응답 객체에 명시적인 타입(ScanCommandOutput)을 적용하여 타입 오류 해결
    const response: ScanCommandOutput = await dynamoDbClient.send(scanCommand);
    
    if (response.Items) {
      allPosts = allPosts.concat(response.Items);
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
    console.log(`Scanned ${response.Count} items... Total items: ${allPosts.length}`);
  } while (lastEvaluatedKey);

  console.log(`Found ${allPosts.length} posts to migrate.`);

  if (allPosts.length === 0) {
    console.log('No posts to migrate. Exiting.');
    return;
  }

  const bulkOperations: any[] = [];
  for (const post of allPosts) {
    const document = {
      postId: post.postId,
      title: post.title,
      content: post.content,
      tags: post.tags,
      authorNickname: post.authorNickname,
      createdAt: post.createdAt,
    };
    bulkOperations.push({ index: { _index: INDEX_NAME, _id: document.postId } });
    bulkOperations.push(document);
  }

  console.log('Sending data to OpenSearch via Bulk API...');
  try {
    const response = await opensearchClient.bulk({
      index: INDEX_NAME,
      body: bulkOperations,
    });

    if (response.body.errors) {
      console.error('OpenSearch Bulk API returned errors. Some documents may not have been indexed.');
      const failedItems = response.body.items.filter((item: any) => item.index?.error);
      console.error(JSON.stringify(failedItems, null, 2));
    } else {
      console.log('✅ Migration successful! All documents have been indexed.');
    }
  } catch (error) {
    console.error('An error occurred during the bulk request:', error);
  }
}

migrate();
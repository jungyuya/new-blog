// 파일 위치: scripts/migrate-to-opensearch.ts

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import { Client } from '@opensearch-project/opensearch';
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
const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: REGION,
    service: 'es',
  }),
  node: OPENSEARCH_ENDPOINT,
});

async function migrate() {
  console.log(`Starting migration from DynamoDB table "${DYNAMODB_TABLE_NAME}" to OpenSearch index "${INDEX_NAME}"...`);

  let allPosts: Record<string, any>[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  console.log('Scanning DynamoDB table...');
  do {
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE_NAME,
      IndexName: 'GSI3',
      FilterExpression: 'attribute_exists(postId)',
      ExclusiveStartKey: lastEvaluatedKey,
    });
    
    const response: ScanCommandOutput = await dynamoDbClient.send(scanCommand);
    
    if (response.Items) {
      allPosts = allPosts.concat(response.Items);
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
    console.log(`Scanned ${response.Count} items... Total items: ${allPosts.length}`);
  } while (lastEvaluatedKey);

  console.log(`Found ${allPosts.length} total items in GSI3.`);

  // [핵심 수정] isDeleted가 true가 아닌, 즉 삭제되지 않은 게시물만 필터링합니다.
  const activePosts = allPosts.filter(post => post.isDeleted !== true);
  console.log(`Filtered ${activePosts.length} active posts to migrate.`);

  if (activePosts.length === 0) {
    console.log('No active posts to migrate. Exiting.');
    return;
  }

  const bulkOperations: any[] = [];
  for (const post of activePosts) {
    const document = {
      postId: post.postId,
      title: post.title,
      content: post.content,
      tags: post.tags,
      authorNickname: post.authorNickname,
      createdAt: post.createdAt,
      thumbnailUrl: post.thumbnailUrl,
      status: post.status,
      visibility: post.visibility,
      isDeleted: post.isDeleted || false, // isDeleted 필드를 명시적으로 포함
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
      console.log('✅ Migration successful! All active documents have been indexed.');
    }
  } catch (error) {
    console.error('An error occurred during the bulk request:', error);
  }
}

migrate();
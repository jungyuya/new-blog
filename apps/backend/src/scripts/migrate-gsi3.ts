
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import path from 'path';

// .env 로드 (backend root 기준)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION || 'ap-northeast-2';

if (!TABLE_NAME) {
    console.error('TABLE_NAME is not defined in .env');
    process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

async function migrate() {
    console.log(`Starting migration for table: ${TABLE_NAME}`);

    let lastEvaluatedKey = undefined;
    let processedCount = 0;

    do {
        // 1. 모든 Post 아이템 스캔 (SK가 METADATA인 것만)
        const scanCmd = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :metadataSk',
            ExpressionAttributeValues: {
                ':pkPrefix': 'POST#',
                ':metadataSk': 'METADATA',
            },
            ExclusiveStartKey: lastEvaluatedKey,
        });

        const response = await ddbDocClient.send(scanCmd) as any;
        const items = response.Items || [];

        // 2. 각 아이템 업데이트
        for (const item of items) {
            // GSI3_PK를 'POST#ALL'로 업데이트
            // GSI3_SK는 createdAt으로 설정 (없으면 updatedAt, 그것도 없으면 현재 시간)
            const gsi3sk = item.createdAt || item.updatedAt || new Date().toISOString();
            const updateCmd = new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: item.PK, SK: item.SK },
                UpdateExpression: 'SET GSI3_PK = :gsi3pk, GSI3_SK = :gsi3sk, category = if_not_exists(category, :cat), #status = if_not_exists(#status, :stat), #visibility = if_not_exists(#visibility, :vis)',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#visibility': 'visibility',
                },
                ExpressionAttributeValues: {
                    ':gsi3pk': 'POST#ALL',
                    ':gsi3sk': gsi3sk,
                    ':cat': 'post',
                    ':stat': 'published',
                    ':vis': 'public',
                },
            });

            try {
                await ddbDocClient.send(updateCmd);
                process.stdout.write('.');
                processedCount++;
            } catch (err) {
                console.error(`\nFailed to update post ${item.PK}:`, err);
            }
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`\nMigration completed. Processed ${processedCount} posts.`);
}

migrate();

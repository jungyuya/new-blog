
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION || 'ap-northeast-2';

if (!TABLE_NAME) {
    console.error('TABLE_NAME is not defined in .env');
    process.exit(1);
}

// 명시적으로 string으로 처리하기 위한 상수
const tableName: string = TABLE_NAME;

const client = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

async function cleanupGarbage() {
    console.log(`Starting garbage cleanup in table: ${TABLE_NAME}`);

    // 1. Scan GSI3 for all items
    let lastEvaluatedKey: any = undefined;
    let processedCount = 0;
    let deletedCount = 0;

    do {
        const queryCmd = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI3',
            KeyConditionExpression: 'GSI3_PK = :pk',
            ExpressionAttributeValues: {
                ':pk': 'POST#ALL',
            },
            Limit: 50,
            ExclusiveStartKey: lastEvaluatedKey,
        });

        const { Items, LastEvaluatedKey: lek } = await ddbDocClient.send(queryCmd);
        lastEvaluatedKey = lek;

        if (!Items || Items.length === 0) continue;

        const keys = Items.map(item => ({ PK: item.PK, SK: item.SK }));

        // 2. BatchGet to check full item validity
        const batches = [];
        while (keys.length > 0) {
            batches.push(keys.splice(0, 50));
        }

        for (const batchKeys of batches) {
            // Filter unique keys for BatchGet
            const uniqueKeys = batchKeys.filter((key, index, self) =>
                index === self.findIndex((t) => (
                    t.PK === key.PK && t.SK === key.SK
                ))
            );

            if (uniqueKeys.length === 0) continue;

            const batchGetCmd = new BatchGetCommand({
                RequestItems: {
                    [tableName]: { Keys: uniqueKeys },
                },
            });

            const batchResult = await ddbDocClient.send(batchGetCmd);
            const fullItems = (batchResult.Responses?.[tableName] || []) as any[];

            const itemMap = new Map<string, any>(fullItems.map((item: any) => [item.PK, item]));

            for (const keyI of uniqueKeys) {
                const fullItem = itemMap.get(keyI.PK);

                // 3. Identify and Remove Garbage
                // Garbage definition: Missing title OR Missing category (since we migrated all valid ones)
                // Or specifically items that cause problems.
                const isGarbage = !fullItem || !fullItem.title || !fullItem.postId;

                if (isGarbage) {
                    console.log(`🗑️  Found Garbage: ${keyI.PK}. Removing GSI3 index...`);

                    // We remove GSI3 attributes so they drop from the index. Better than deleting data if unsure.
                    // If it's truly garbage (no title), maybe delete? 
                    // Let's just REMOVE GSI3_PK/SK to hide it from the feed. 安全第一 (Safety First).
                    await ddbDocClient.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { PK: keyI.PK, SK: keyI.SK },
                        UpdateExpression: 'REMOVE GSI3_PK, GSI3_SK',
                    }));
                    deletedCount++;
                }
            }
        }

        processedCount += Items.length;
        console.log(`Processed ${processedCount} items...`);

    } while (lastEvaluatedKey);

    console.log(`Cleanup complete. Removed GSI3 from ${deletedCount} garbage items.`);
}

cleanupGarbage();


import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import path from 'path';

// .env 로드
dotenv.config({ path: path.join(__dirname, '../../.env') });

const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION || 'ap-northeast-2';

if (!TABLE_NAME) {
    console.error('TABLE_NAME is not defined in .env');
    process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

async function verify() {
    console.log(`Verifying data in table: ${TABLE_NAME}`);
    console.log(`Checking specifically for GSI3_PK = 'POST#ALL'`);

    // 1. Check if ANY items have GSI3_PK = 'POST#ALL'
    const scanCmd = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'GSI3_PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'POST#ALL',
        },
        Limit: 10, // Check first 10
    });

    const { Items } = await ddbDocClient.send(scanCmd);

    console.log(`Found ${Items?.length || 0} items with GSI3_PK='POST#ALL'`);

    if (Items && Items.length > 0) {
        console.log('Sample Item:');
        console.log(JSON.stringify(Items[0], null, 2));

        // Check category distribution
        const categories = Items.map(i => i.category);
        console.log('Categories found in sample:', categories);
    } else {
        console.log('⚠️  No items found with GSI3_PK="POST#ALL". Migration might have failed or not run.');

        // Check raw items to see what they have
        const rawScan = new ScanCommand({
            TableName: TABLE_NAME,
            Limit: 5,
            FilterExpression: 'begins_with(PK, :pk)',
            ExpressionAttributeValues: { ':pk': 'POST#' }
        });
        const rawRes = await ddbDocClient.send(rawScan);
        console.log('Raw POST items sample:', JSON.stringify(rawRes.Items, null, 2));
    }
}

verify();

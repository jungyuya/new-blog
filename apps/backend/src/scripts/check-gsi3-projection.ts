
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION || 'ap-northeast-2';

if (!TABLE_NAME) {
    console.error('TABLE_NAME is not defined in .env');
    process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

async function checkProjection() {
    console.log(`Checking GSI3 Projection on table: ${TABLE_NAME}`);

    const queryCmd = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3_PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'POST#ALL',
        },
        Limit: 1,
    });

    try {
        const { Items } = await ddbDocClient.send(queryCmd);
        if (!Items || Items.length === 0) {
            console.log('No items found in GSI3 with POST#ALL.');
        } else {
            console.log('Item found in GSI3. Keys present:');
            console.log(Object.keys(Items[0]));
            console.log('Full Item:', JSON.stringify(Items[0], null, 2));
        }
    } catch (error) {
        console.error('Error querying GSI3:', error);
    }
}

checkProjection();

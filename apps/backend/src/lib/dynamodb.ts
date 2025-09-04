// 파일 위치: apps/backend/src/lib/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.REGION || 'ap-northeast-2';
const IS_PROD = process.env.NODE_ENV === 'production';

const ddbClientOptions: { region: string; endpoint?: string } = { region: REGION };
if (process.env.DYNAMODB_ENDPOINT) {
  ddbClientOptions.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const ddbClient = new DynamoDBClient(ddbClientOptions);
// 이 ddbDocClient를 프로젝트 전역에서 재사용할 것입니다.
export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
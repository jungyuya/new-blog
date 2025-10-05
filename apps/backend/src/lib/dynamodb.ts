// 파일 위치: apps/backend/src/lib/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import * as AWSXRay from 'aws-xray-sdk';

const REGION = process.env.REGION || 'ap-northeast-2';
const IS_PROD = process.env.NODE_ENV === 'production';

const ddbClientOptions: { region: string; endpoint?: string } = { region: REGION };
if (process.env.DYNAMODB_ENDPOINT) {
  ddbClientOptions.endpoint = process.env.DYNAMODB_ENDPOINT;
}

// 1. 원본 DynamoDBClient를 생성합니다.
const ddbClient = new DynamoDBClient(ddbClientOptions);

// 2.  X-Ray SDK를 사용하여 원본 클라이언트를 캡처(wrapping)합니다.
//    운영 환경에서만 X-Ray를 활성화하여 로컬 개발에 영향을 주지 않도록 합니다.
const capturedDdbClient = IS_PROD ? AWSXRay.captureAWSv3Client(ddbClient) : ddbClient;

// 3. 캡처된 클라이언트를 사용하여 DynamoDBDocumentClient를 생성합니다.
export const ddbDocClient = DynamoDBDocumentClient.from(capturedDdbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});
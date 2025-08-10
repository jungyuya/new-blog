// 파일 위치: apps/cache-gateway/src/index.ts

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// --- 환경 변수 로드 및 검증 ---
// InfraStack.ts에서 주입해 줄 환경 변수들입니다.
const cacheBucketName = process.env.CACHE_BUCKET_NAME;
const turboTokenSecretArn = process.env.TURBO_TOKEN_SECRET_ARN;
const region = process.env.AWS_REGION || 'ap-northeast-2';

if (!cacheBucketName || !turboTokenSecretArn) {
  throw new Error('Required environment variables CACHE_BUCKET_NAME and TURBO_TOKEN_SECRET_ARN are not set.');
}

// --- AWS 클라이언트 초기화 ---
const s3Client = new S3Client({ region });
const secretsManagerClient = new SecretsManagerClient({ region });

// --- 비밀 토큰 캐싱 ---
// Lambda의 실행 컨텍스트가 살아있는 동안, Secrets Manager에 대한 호출을 최소화하기 위해
// 비밀 토큰을 한 번만 조회하여 변수에 저장(캐싱)합니다.
let cachedToken: string | null = null;
async function getTurboToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }
  const command = new GetSecretValueCommand({ SecretId: turboTokenSecretArn });
  const response = await secretsManagerClient.send(command);
  if (!response.SecretString) {
    throw new Error('Secret value is empty in Secrets Manager.');
  }
  cachedToken = response.SecretString;
  return cachedToken;
}

// --- Lambda 핸들러 함수 (핵심 로직) ---
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    // 1. 인증: 요청 헤더의 토큰과 비밀 토큰을 비교합니다.
    const requestToken = event.headers.authorization?.replace('Bearer ', '');
    const expectedToken = await getTurboToken();

    if (!requestToken || requestToken !== expectedToken) {
      console.warn('Authentication failed: Invalid or missing token.');
      return { statusCode: 401, body: 'Unauthorized' };
    }

    // 2. 요청 분석: Turborepo가 요청한 해시(hash) 값을 경로에서 추출합니다.
    const artifactHash = event.pathParameters?.proxy;
    if (!artifactHash) {
      return { statusCode: 400, body: 'Bad Request: Missing artifact hash.' };
    }
    const s3Key = `v8/artifacts/${artifactHash}`;

    // 3. 작업 분기: HTTP 메서드(GET/PUT)에 따라 다른 작업을 수행합니다.
    switch (event.requestContext.http.method) {
      // --- 캐시 다운로드 (GET) ---
      case 'GET': {
        const command = new GetObjectCommand({ Bucket: cacheBucketName, Key: s3Key });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5분 유효
        // Turborepo는 GET 요청에 대해 파일 위치로의 리다이렉트를 기대할 수 있습니다.
        // 여기서는 Presigned URL을 Location 헤더에 담아 307 (Temporary Redirect)로 응답합니다.
        return {
          statusCode: 307,
          headers: { 'Location': presignedUrl },
        };
      }

      // --- 캐시 업로드 (PUT) ---
      case 'PUT': {
        // [핵심] 업로드 전에 파일이 이미 있는지 확인하여 중복 업로드를 방지합니다.
        try {
          await s3Client.send(new HeadObjectCommand({ Bucket: cacheBucketName, Key: s3Key }));
          // 파일이 이미 존재하면, 업로드할 필요가 없으므로 성공(200 OK)을 반환합니다.
          console.log(`Cache hit on PUT for ${s3Key}. Skipping upload.`);
          return { statusCode: 200, body: 'Cache hit, upload skipped.' };
        } catch (error: any) {
          // HeadObject는 파일이 없을 때 'NotFound' 에러를 발생시킵니다. 이것이 정상적인 흐름입니다.
          if (error.name !== 'NotFound') {
            throw error; // 다른 종류의 에러라면 그대로 던집니다.
          }
        }

        const command = new PutObjectCommand({ Bucket: cacheBucketName, Key: s3Key });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5분 유효
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: presignedUrl }),
        };
      }

      default:
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
// 파일 위치: apps/backend/src/update-speech-url-handler.ts

import { SNSEvent } from 'aws-lambda';
import * as postsRepository from './repositories/posts.repository';

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

interface PollyTaskNotification {
  taskId: string;
  outputUri: string;
  taskStatus: 'COMPLETED' | 'FAILED';
  // ... 그 외 Polly가 보내주는 다른 속성들
}

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const message = record.Sns.Message;
      const notification: PollyTaskNotification = JSON.parse(message);

      // 1. 작업이 실패한 경우, 로그만 남기고 처리를 중단합니다.
      if (notification.taskStatus === 'FAILED') {
        console.error('Speech synthesis task failed:', notification);
        continue; // 다음 메시지 처리
      }

      // 2. S3 URI에서 postId와 파일 이름을 추출합니다.
      // 예: s3://bucket-name/post-id-123/task-id.mp3
      const s3Uri = new URL(notification.outputUri);
      const key = s3Uri.pathname.substring(1); // 맨 앞의 '/' 제거
      const keyParts = key.split('/');
      
      if (keyParts.length < 2) {
        throw new Error(`Invalid S3 key format: ${key}`);
      }

      const postId = keyParts[0];
      const fileName = keyParts[1];

      // 3. CloudFront URL을 생성합니다.
      const speechUrl = `${CLOUDFRONT_DOMAIN}/${postId}/${fileName}`;

      console.log(`Updating post ${postId} with speechUrl: ${speechUrl}`);

      // 4. posts.repository를 재사용하여 DynamoDB를 업데이트합니다.
      await postsRepository.updatePost(postId, {
        speechUrl: speechUrl,
      });

      console.log(`Successfully updated speechUrl for post ${postId}`);

    } catch (error) {
      console.error('Error processing SNS message:', error);
      // 이 Lambda는 DLQ가 없으므로, 에러를 다시 던져 CloudWatch에서 실패를 확인하도록 합니다.
      throw error;
    }
  }
};
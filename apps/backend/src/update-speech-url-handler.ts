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

            if (notification.taskStatus === 'FAILED') {
                console.error('Speech synthesis task failed:', notification);
                continue;
            }

            const uriParts = notification.outputUri.replace('s3://', '').split('/');
            // uriParts[0] = bucket-name
            // uriParts[1] = 'speeches'
            // uriParts[2] = postId
            // uriParts[3] = filename.mp3

            if (uriParts.length < 4) {
                throw new Error(`Invalid S3 URI format: ${notification.outputUri}`);
            }

            const speechesPrefix = uriParts[1];
            const postId = uriParts[2];
            const fileName = uriParts[3];

            // CloudFront URL을 생성합니다. (경로는 이미 S3 키에 포함되어 있음)
            const speechUrl = `${CLOUDFRONT_DOMAIN}/${speechesPrefix}/${postId}/${fileName}`;

            console.log(`Updating post ${postId} with speechUrl: ${speechUrl}`);

            await postsRepository.updatePost(postId, {
                speechUrl: speechUrl,
            });

            console.log(`Successfully updated speechUrl for post ${postId}`);

        } catch (error) {
            console.error('Error processing SNS message:', error);
            throw error;
        }
    }
};
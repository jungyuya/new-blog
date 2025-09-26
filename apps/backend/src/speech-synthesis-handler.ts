// 파일 위치: apps/backend/src/speech-synthesis-handler.ts

import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { PollyClient, StartSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { remark } from 'remark';
import strip from 'strip-markdown';
import type { Post } from './lib/types';

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const SYNTHESIZED_SPEECH_BUCKET_NAME = process.env.SYNTHESIZED_SPEECH_BUCKET_NAME!;
const REGION = process.env.REGION!;

const pollyClient = new PollyClient({ region: REGION });

// 마크다운을 순수 텍스트로 변환하는 함수
async function markdownToPlainText(markdown: string): Promise<string> {
    const file = await remark().use(strip).process(markdown);
    return String(file);
}

// 메인 핸들러 함수
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    console.log('Received DynamoDB Stream event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        // INSERT 또는 MODIFY 이벤트만 처리
        if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
            continue;
        }

        // NewImage에서 Post 데이터 추출
        const newImage = record.dynamodb?.NewImage;
        if (!newImage) {
            continue;
        }

        const post = unmarshall(newImage as any) as Post;

        // 1. 'published' 상태인 Post 아이템만 처리
        if (post.status !== 'published' || !post.postId) {
            console.log(`Skipping post ${post.postId || 'unknown'} with status: ${post.status}`);
            continue;
        }

        // 2. content가 없거나 너무 짧으면 처리하지 않음
        if (!post.content || post.content.length < 50) {
            console.log(`Skipping post ${post.postId} due to short or missing content.`);
            continue;
        }

        // 3. 이미 speechUrl이 있다면, 중복 생성을 방지하기 위해 처리하지 않음
        if (post.speechUrl) {
            console.log(`Skipping post ${post.postId} as speechUrl already exists.`);
            continue;
        }

        console.log(`Processing post for speech synthesis: ${post.postId}`);

        try {
            // 4. 마크다운 content를 순수 텍스트로 변환
            const plainText = await markdownToPlainText(post.content);

            // 5. Polly 비동기 음성 합성 작업 시작
            const command = new StartSpeechSynthesisTaskCommand({
                Engine: 'neural', // 신경망 엔진 사용으로 자연스러운 음성 생성
                LanguageCode: 'ko-KR',
                OutputFormat: 'mp3',
                OutputS3BucketName: SYNTHESIZED_SPEECH_BUCKET_NAME,
                OutputS3KeyPrefix: `${post.postId}/`, // postId를 폴더처럼 사용
                SnsTopicArn: SNS_TOPIC_ARN,
                Text: plainText,
                VoiceId: 'Seoyeon', // 한국어 여성 음성
                // RoleArn: POLLY_S3_ACCESS_ROLE_ARN, // PassRole 패턴을 사용하지 않으므로 주석 처리
            });

            await pollyClient.send(command);
            console.log(`Successfully started speech synthesis task for post: ${post.postId}`);

        } catch (error) {
            console.error(`Error processing post ${post.postId}:`, error);
            // DLQ로 보내기 위해 에러를 다시 던짐
            throw error;
        }
    }
};
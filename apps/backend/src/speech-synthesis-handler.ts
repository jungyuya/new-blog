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
    // --- [핵심 수정 1] 핸들러 시작점에 무조건 로그를 남깁니다. ---
    console.log(`SpeechSynthesisLambda invoked with ${event.Records.length} records.`);

    for (const record of event.Records) {
        // --- [핵심 수정 2] 각 레코드 처리 시작 시 로그를 남깁니다. ---
        console.log(`Processing record with eventName: ${record.eventName}`);

        if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
            console.log(`Skipping record because eventName is not INSERT or MODIFY.`);
            continue;
        }

        const newImage = record.dynamodb?.NewImage;
        if (!newImage) {
            console.log(`Skipping record because NewImage is missing.`);
            continue;
        }

        const post = unmarshall(newImage as any) as Post;

        // --- [핵심 수정 3] 필터링 조건과 값을 명확하게 로그로 남깁니다. ---
        console.log(`Checking post: postId=${post.postId}, status=${post.status}, hasSpeechUrl=${!!post.speechUrl}`);

        if (post.status !== 'published' || !post.postId) {
            console.log(`FILTERED: Skipping post due to status ('${post.status}') or missing postId.`);
            continue;
        }

        if (!post.content || post.content.length < 50) {
            console.log(`FILTERED: Skipping post due to short or missing content.`);
            continue;
        }

        if (post.speechUrl) {
            console.log(`FILTERED: Skipping post as speechUrl already exists.`);
            continue;
        }

        console.log(`PASSED FILTERS: Processing post for speech synthesis: ${post.postId}`);

        try {
            // 4. 마크다운 content를 순수 텍스트로 변환
            const plainText = await markdownToPlainText(post.content);

            // 5. Polly 비동기 음성 합성 작업 시작
            const outputS3KeyPrefix = `speeches/${post.postId}/`;

            const command = new StartSpeechSynthesisTaskCommand({
                Engine: 'neural',
                LanguageCode: 'ko-KR',
                OutputFormat: 'mp3',
                OutputS3BucketName: SYNTHESIZED_SPEECH_BUCKET_NAME,
                // 'OutputS3Key' 대신 올바른 파라미터인 'OutputS3KeyPrefix'를 사용합니다.
                OutputS3KeyPrefix: outputS3KeyPrefix,
                SnsTopicArn: SNS_TOPIC_ARN,
                Text: plainText,
                VoiceId: 'Seoyeon',
            });

            await pollyClient.send(command);
            console.log(`Successfully started speech synthesis task for post: ${post.postId} with prefix: ${outputS3KeyPrefix}`);
       
        } catch (error) {
            console.error(`Error processing post ${post.postId}:`, error);
            // DLQ로 보내기 위해 에러를 다시 던짐
            throw error;
        }
    }
};
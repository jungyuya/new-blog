// 파일 위치: apps/backend/src/speech-synthesis-handler.ts

import { PollyClient, StartSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { remark } from 'remark';
import strip from 'strip-markdown';
import * as postsRepository from './repositories/posts.repository'; // [신규] DB 업데이트를 위해 import

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const SYNTHESIZED_SPEECH_BUCKET_NAME = process.env.SYNTHESIZED_SPEECH_BUCKET_NAME!;
const REGION = process.env.REGION!;

const pollyClient = new PollyClient({ region: REGION });

// [신규] Lambda 직접 호출 시 받을 페이로드 타입 정의
interface SpeechSynthesisPayload {
  postId: string;
  content: string;
}

// 마크다운을 순수 텍스트로 변환하는 함수 (변경 없음)
async function markdownToPlainText(markdown: string): Promise<string> {
    const file = await remark().use(strip).process(markdown);
    return String(file);
}

// 메인 핸들러 함수 (시그니처 및 내부 로직 대폭 수정)
export const handler = async (payload: SpeechSynthesisPayload): Promise<void> => {
    console.log('Received invocation payload:', JSON.stringify(payload, null, 2));

    const { postId, content } = payload;

    // 페이로드 유효성 검사
    if (!postId || !content) {
        console.error('Invalid payload: postId or content is missing.');
        // 이 Lambda는 비동기 호출되므로, 여기서 에러를 던져도 호출자에게 전달되지 않음.
        // 실패 처리를 위해 DB 상태를 FAILED로 업데이트하는 것이 이상적.
        await postsRepository.updatePost(postId, { speechStatus: 'FAILED' } as any);
        return;
    }

    try {
        // 1. 마크다운 content를 순수 텍스트로 변환
        const plainText = await markdownToPlainText(content);

        // 2. Polly 비동기 음성 합성 작업 시작
        const outputS3KeyPrefix = `speeches/${postId}/`;

        const command = new StartSpeechSynthesisTaskCommand({
            Engine: 'neural',
            LanguageCode: 'ko-KR',
            OutputFormat: 'mp3',
            OutputS3BucketName: SYNTHESIZED_SPEECH_BUCKET_NAME,
            OutputS3KeyPrefix: outputS3KeyPrefix,
            SnsTopicArn: SNS_TOPIC_ARN,
            Text: plainText,
            VoiceId: 'Seoyeon',
        });

        await pollyClient.send(command);
        console.log(`Successfully started speech synthesis task for post: ${postId} with prefix: ${outputS3KeyPrefix}`);
   
    } catch (error) {
        console.error(`Error processing post ${postId}:`, error);
        // [신규] 에러 발생 시, DB의 상태를 'FAILED'로 업데이트하여 프론트엔드에 피드백
        await postsRepository.updatePost(postId, { speechStatus: 'FAILED' } as any).catch(dbError => {
            console.error(`CRITICAL: Failed to update post status to FAILED for postId: ${postId}`, dbError);
        });
        // 에러를 다시 던져 AWS Lambda의 재시도 정책(기본값)에 따라 재실행되도록 함
        throw error;
    }
};
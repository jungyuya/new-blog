import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { stream } from 'hono/streaming';
import * as chatService from '../services/chat.service';
import type { AppEnv } from '../lib/types';

const chatRouter = new Hono<AppEnv>();

// 1. 쿼터 조회 API
chatRouter.get('/quota', async (c) => {
  try {
    const status = await chatService.getQuota();
    return c.json(status);
  } catch (error) {
    console.error('Get Quota Error:', error);
    return c.json({ message: 'Failed to get quota' }, 500);
  }
});

// 2. 채팅(질문) API
const chatSchema = z.object({
  question: z.string().min(1).max(200),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional(),
});

chatRouter.post('/', zValidator('json', chatSchema), async (c) => {
  const { question, history } = c.req.valid('json');

  try {
    // A. 쿼터 차감 시도 (방어 로직)
    const allowed = await chatService.useQuota();

    if (!allowed) {
      return c.json({
        message: 'Daily quota exceeded. Please try again tomorrow.',
        error: 'QUOTA_EXCEEDED'
      }, 429);
    }

    // B. RAG 답변 생성 (스트림)
    const { stream: textStream, sources } = await chatService.generateAnswerStream(question, history);

    // C. 스트리밍 응답 반환
    return stream(c, async (streamWriter) => {
      try {
        // 1. 먼저 출처 정보 전송 (특수 구분자와 함께)
        await streamWriter.write(`__SOURCES__${JSON.stringify(sources)}__SOURCES__`);

        // 2. 텍스트 스트림 전송
        for await (const chunk of textStream) {
          await streamWriter.write(chunk);
        }
      } catch (error) {
        console.error('Stream writing error:', error);
      }
    });

  } catch (error) {
    console.error('Chat Error:', error);
    return c.json({ message: 'Failed to generate answer' }, 500);
  }
});

export default chatRouter;
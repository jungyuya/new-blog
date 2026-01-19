// 파일 위치: apps/backend/src/routes/chat.router.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
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
  question: z.string().min(1).max(200), // 질문 길이 제한으로 오남용 방지
});

chatRouter.post('/', zValidator('json', chatSchema), async (c) => {
  const { question } = c.req.valid('json');

  try {
    // A. 쿼터 차감 시도 (방어 로직)
    const allowed = await chatService.useQuota();
    
    if (!allowed) {
      return c.json({ 
        message: 'Daily quota exceeded. Please try again tomorrow.',
        error: 'QUOTA_EXCEEDED'
      }, 429); // 429 Too Many Requests
    }

    // B. RAG 답변 생성
    const answer = await chatService.generateAnswer(question);
    
    return c.json({ answer });

  } catch (error) {
    console.error('Chat Error:', error);
    return c.json({ message: 'Failed to generate answer' }, 500);
  }
});

export default chatRouter;
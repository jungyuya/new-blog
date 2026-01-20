import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as chatService from '../services/chat.service';
import { GuardrailService } from '../services/guardrail.service';
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
    // A. 가드레일 검증 (쿼터 소모 전에 먼저 체크)
    const validation = GuardrailService.validateQuestion(question);
    if (!validation.isValid) {
      console.warn('[Guardrail] Blocked question:', {
        question,
        reason: validation.reason,
        timestamp: new Date().toISOString(),
      });
      return c.json({
        message: validation.reason || '부적절한 질문입니다.',
        error: 'GUARDRAIL_BLOCKED'
      }, 400);
    }

    // B. 쿼터 차감 시도
    const allowed = await chatService.useQuota();

    if (!allowed) {
      return c.json({
        message: 'Daily quota exceeded. Please try again tomorrow.',
        error: 'QUOTA_EXCEEDED'
      }, 429);
    }

    // C. RAG 답변 생성
    const { answer, sources } = await chatService.generateAnswer(question, history);

    return c.json({ answer, sources });

  } catch (error) {
    console.error('Chat Error:', error);
    return c.json({ message: 'Failed to generate answer' }, 500);
  }
});

export default chatRouter;
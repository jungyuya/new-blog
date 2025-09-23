// 파일 위치: apps/backend/src/index.ts (v2.2 - 최종 에러 핸들링)
import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { ZodError } from 'zod'; // ZodError를 import해야 instanceof로 확인 가능
import { serve } from '@hono/node-server';
import postsRouter from './routes/posts.router';
import authRouter from './routes/auth.router';
import usersRouter from './routes/users.router';
import tagsRouter from './routes/tags.router';
import imagesRouter from './routes/images.router';
import configRouter from './routes/config.router';
import type { AppEnv } from './lib/types';
import { commentsRouter, postCommentsRouter } from './routes/comments.router';
import * as Sentry from '@sentry/node';

// Hono 앱 생성 전에 Sentry를 가장 먼저 초기화.
if (process.env.BACKEND_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.BACKEND_SENTRY_DSN,
    // 성능 모니터링 설정 (10%의 트랜잭션만 샘플링)
    tracesSampleRate: 0.1,
  });
  console.log('[Sentry] Backend SDK initialized.');
}

const app = new Hono<AppEnv>().basePath('/api');

// --- Global Middlewares ---
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://blog.jungyu.store'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
app.use('*', async (c, next) => {
  console.log(`[BACKEND REQUEST LOGGER] Method: ${c.req.method}, Path: ${c.req.path}`);
  await next();
});

// --- Route Registration ---
app.route('/posts', postsRouter);
app.route('/auth', authRouter);
app.route('/users', usersRouter);
app.route('/tags', tagsRouter);
app.route('/images', imagesRouter);
app.route('/config', configRouter); 
app.route('/comments', commentsRouter);
app.route('/posts/:postId/comments', postCommentsRouter);

// --- [핵심 수정] Error Handling ---
app.onError((err, c) => {
  console.error(`[GLOBAL ERROR HANDLER] Path: ${c.req.path}`, err);

  // --- [신규] Sentry로 에러를 전송합니다. ---
  Sentry.captureException(err);

  // Zod 유효성 검사 에러인 경우, 400 상태 코드와 함께 상세 오류를 반환합니다.
  if (err instanceof ZodError) {
    return c.json({ message: 'Validation Error', errors: err.issues }, 400);
  }

  // 그 외의 모든 에러는 500 Internal Server Error로 처리합니다.
  return c.json({ message: 'Internal Server Error', error: err.message }, 500);
});

export { app };

// --- Server Export ---
export const handler = handle(app);

if (process.env.NODE_ENV === 'development') {
  serve({ fetch: app.fetch, port: 4000 }, (info) => {
    console.log(`[BACKEND] Development server is running at http://localhost:${info.port}`);
  });
}
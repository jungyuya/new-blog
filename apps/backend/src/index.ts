// 파일 위치: apps/backend/src/index.ts

import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { serve } from '@hono/node-server';
import * as AWSXRay from 'aws-xray-sdk';
import * as Sentry from '@sentry/node';

import chatRouter from './routes/chat.router'; 
import postsRouter from './routes/posts.router';
import authRouter from './routes/auth.router';
import usersRouter from './routes/users.router';
import tagsRouter from './routes/tags.router';
import imagesRouter from './routes/images.router';
import configRouter from './routes/config.router';
import type { AppEnv } from './lib/types';
import { commentsRouter, postCommentsRouter } from './routes/comments.router';

const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD) {
  // Sentry 초기화
  if (process.env.BACKEND_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.BACKEND_SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
    console.log('[Sentry] Backend SDK initialized.');
  }
  // X-Ray Promise 캡처 활성화
  AWSXRay.capturePromise();
}

const app = new Hono<AppEnv>().basePath('/api');

// --- [핵심 수정] 가장 단순하고 안정적인 X-Ray 미들웨어 ---
if (IS_PROD) {
  app.use('*', async (c, next) => {
    const segment = new AWSXRay.Segment('BackendHonoApp', c.req.header('x-amzn-trace-id'));
    const ns = AWSXRay.getNamespace();

    await ns.runPromise(async () => {
      AWSXRay.setSegment(segment);
      
      // 요청 정보를 수동으로 기록
      segment.addMetadata('request', {
        method: c.req.method,
        path: c.req.path,
        headers: c.req.header(),
      });

      try {
        await next();
      } catch (err) {
        // next()에서 발생한 에러를 잡아서 기록
        segment.addError(err as Error);
        throw err; // 에러를 다시 던져서 Hono의 onError 핸들러가 처리하도록 함
      } finally {
        // 응답 정보를 수동으로 기록
        segment.addMetadata('response', {
          status: c.res.status,
        });
        if (c.res.status >= 500) segment.addFaultFlag();
        else if (c.res.status >= 400) segment.addErrorFlag();

        segment.close();
      }
    });
  });
}

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
app.route('/chat', chatRouter); 

// --- Error Handling ---
app.onError((err, c) => {
  console.error(`[GLOBAL ERROR HANDLER] Path: ${c.req.path}`, err);

  if (IS_PROD) {
    Sentry.captureException(err);
    // X-Ray 에러 기록은 이제 통합 미들웨어의 catch 블록에서도 처리될 수 있지만,
    // 여기서 한번 더 기록하여 모든 에러를 놓치지 않도록 합니다.
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addError(err as Error);
    }
  }

  if (err instanceof ZodError) {
    return c.json({ message: 'Validation Error', errors: err.issues }, 400);
  }

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
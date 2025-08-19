// 파일 위치: apps/backend/src/index.ts (v2.1 - 테스트를 위해 수정된 최종본)
import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { serve } from '@hono/node-server';
import postsRouter from './routes/posts.router';
import authRouter from './routes/auth.router';
import usersRouter from './routes/users.router';
import type { AppEnv } from './lib/types';

const app = new Hono<AppEnv>().basePath('/api');

// --- Global Middlewares ---
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://blog.jungyu.store'],
  credentials: true,
  // ...
}));
app.use('*', async (c, next) => {
  console.log(`[BACKEND REQUEST LOGGER] Method: ${c.req.method}, Path: ${c.req.path}`);
  await next();
});

// --- Route Registration ---
app.route('/posts', postsRouter);
app.route('/auth', authRouter);
app.route('/users', usersRouter);

// --- Error Handling ---
app.onError((err, c) => {
  // ...
  return c.json({ message: 'Internal Server Error', error: err.message }, 500);
});

// [수정] app 객체를 바로 export 합니다.
export { app };

// --- Server Export ---
export const handler = handle(app);

if (process.env.NODE_ENV !== 'production') {
  serve({ fetch: app.fetch, port: 4000 }, (info) => {
    console.log(`[BACKEND] Development server is running at http://localhost:${info.port}`);
  });
}
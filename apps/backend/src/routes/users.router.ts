// 파일 위치: apps/backend/src/routes/users.router.ts (v2.2 - GET /me/profile 추가 및 순서 정리)
import { Hono } from 'hono';
import { cookieAuthMiddleware } from '../middlewares/auth.middleware';
import type { AppEnv } from '../lib/types';
import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ZodError } from 'zod';

const UpdateProfileSchema = z.object({
  nickname: z.string().min(2, '닉네임은 2자 이상이어야 합니다.').max(20, '닉네임은 20자를 초과할 수 없습니다.'),
  bio: z.string().max(160, '자기소개는 160자를 초과할 수 없습니다.').optional(),
  avatarUrl: z.string().url({ message: "유효한 URL 형식이 아닙니다." }).or(z.literal("")).optional(),
});

const usersRouter = new Hono<AppEnv>();

// --- [핵심 추가 1] 더 구체적인 '/me/profile' 경로를 '/me'보다 먼저 정의합니다. ---

// --- GET /me/profile - DynamoDB 프로필 조회 ---
usersRouter.get('/me/profile', cookieAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const TABLE_NAME = process.env.TABLE_NAME!;

  if (!userId) {
    return c.json({ message: 'User identity not found in context.' }, 500);
  }

  try {
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    }));

    if (!Item) {
      return c.json({ message: 'Profile not found.' }, 404);
    }
    return c.json({ profile: Item });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ message: 'Failed to get user profile.' }, 500);
  }
});

// --- PUT /me/profile - DynamoDB 프로필 수정/생성 (Upsert) ---
usersRouter.put(
  '/me/profile',
  cookieAuthMiddleware,
  // [핵심 수정] zValidator에 errorHandler를 추가합니다.
  zValidator('json', UpdateProfileSchema, (result, c) => {
    if (!result.success) {
      return c.json({ message: 'Validation Error', errors: (result.error as ZodError).issues }, 400);
    }
  }),
  async (c) => {
    const userId = c.get('userId');
    const userEmail = c.get('userEmail');
    const { nickname, bio, avatarUrl } = c.req.valid('json');
    const now = new Date().toISOString();
    const TABLE_NAME = process.env.TABLE_NAME!;

    if (!userId || !userEmail) {
      return c.json({ message: 'User identity not found in context.' }, 500);
    }

    try {
      const { Item: existingProfile } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));

      // [핵심 수정] 저장할 profileItem 객체에 avatarUrl을 포함시킵니다.
      const profileItem = {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        userId,
        email: userEmail,
        nickname,
        bio: bio || '',
        // avatarUrl이 요청에 포함되지 않았다면(undefined), 기존 값을 유지합니다.
        // 요청에 빈 문자열('')이 왔다면, 그것은 사진을 삭제하려는 의도이므로 그대로 저장합니다.
        avatarUrl: avatarUrl === undefined ? existingProfile?.avatarUrl || '' : avatarUrl,
        updatedAt: now,
        createdAt: existingProfile?.createdAt || now,
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: profileItem,
      });
      await ddbDocClient.send(command);

      return c.json({ message: 'Profile updated successfully.', profile: profileItem }, 200);
    } catch (error: any) {
      console.error('Update profile error:', error);
      return c.json({ message: 'Failed to update user profile.' }, 500);
    }
  }
);

// --- 덜 구체적인 '/me' 경로는 마지막에 정의합니다. ---
usersRouter.get('/me', cookieAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const userGroups = c.get('userGroups');
  const TABLE_NAME = process.env.TABLE_NAME!;

  if (!userId || !userEmail) {
    console.error('[GET /me] Critical error: userId or userEmail not found in context after auth middleware.');
    return c.json({ message: 'User identity not found in context after authentication.' }, 500);
  }

  try {
    const { Item: profile } = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    }));

    const userPayload = {
      id: userId,
      email: userEmail,
      groups: userGroups || [],
      nickname: profile?.nickname || userEmail.split('@')[0],
      bio: profile?.bio || '',
      avatarUrl: profile?.avatarUrl || '',
    };

    return c.json({ user: userPayload });
  } catch (error) {
    console.error('Get user profile error in /me:', error);
    return c.json({ message: 'Failed to retrieve user profile.' }, 500);
  }
});

export default usersRouter;
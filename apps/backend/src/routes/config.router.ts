// 파일 위치: apps/backend/src/routes/config.router.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { cookieAuthMiddleware, adminOnlyMiddleware } from '../middlewares/auth.middleware';
import type { AppEnv } from '../lib/types';

const UpdateHeroSchema = z.object({
  postId: z.string().uuid('유효한 postId를 입력해주세요.'),
});

const configRouter = new Hono<AppEnv>();

// --- PUT /hero - Hero 게시물 업데이트 (관리자 전용) ---
configRouter.put(
  '/hero',
  cookieAuthMiddleware, // 1. 먼저 로그인을 확인하고
  adminOnlyMiddleware,  // 2. 그 다음 관리자인지 확인합니다.
  zValidator('json', UpdateHeroSchema), // 3. 요청 본문의 유효성을 검사합니다.
  async (c) => {
    const { postId } = c.req.valid('json');
    const TABLE_NAME = process.env.TABLE_NAME!;

    try {
      // DynamoDB UpdateCommand를 사용하여 SITE_CONFIG 아이템의 heroPostId 속성을 업데이트합니다.
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: 'SITE_CONFIG',
          SK: 'METADATA',
        },
        UpdateExpression: 'SET #heroPostId = :postId',
        ExpressionAttributeNames: {
          '#heroPostId': 'heroPostId',
        },
        ExpressionAttributeValues: {
          ':postId': postId,
        },
      });

      await ddbDocClient.send(command);

      return c.json({ message: `Hero post updated successfully to ${postId}` }, 200);

    } catch (error: any) {
      console.error('Update Hero Post Error:', error);
      return c.json({ message: 'Internal Server Error updating hero post.', error: error.message }, 500);
    }
  }
);

export default configRouter;
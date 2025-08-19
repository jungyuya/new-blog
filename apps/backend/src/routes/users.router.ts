import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { cookieAuthMiddleware } from '../middlewares/auth.middleware';
import type { AppEnv } from '../lib/types';

const usersRouter = new Hono<AppEnv>();

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION });

// --- GET /me - 현재 로그인한 사용자 정보 조회 ---
usersRouter.get('/me', cookieAuthMiddleware, async (c) => {
    const userId = c.get('userId');
    const accessToken = getCookie(c, 'accessToken');

    if (!userId || !accessToken) {
        return c.json({ message: 'User ID or Access Token not found in context.' }, 400);
    }

    try {
        const getUserResponse = await cognitoClient.send(new GetUserCommand({
            AccessToken: accessToken,
        }));

        const emailAttribute = getUserResponse.UserAttributes?.find(
            attr => attr.Name === 'email'
        );
        const email = emailAttribute?.Value;

        if (!email) {
            return c.json({ message: 'User email not found in Cognito attributes.' }, 404);
        }
        
        const userGroups = c.get('userGroups');

        // 최종 반환 객체에 groups 속성을 추가합니다.
        return c.json({ user: { id: userId, email: email, groups: userGroups } });
    } catch (error: any) {
        console.error('GetUser API call failed:', error);
        return c.json({ message: 'Failed to retrieve user information from Cognito.', error: error.message }, 500);
    }
});

export default usersRouter;
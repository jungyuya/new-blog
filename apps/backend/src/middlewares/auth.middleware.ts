// 파일 위치: apps/backend/src/middlewares/auth.middleware.ts
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { AppEnv } from '../lib/types'; // 공유 타입 import

const USER_POOL_ID = process.env.USER_POOL_ID || 'default-user-pool-id';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || 'default-user-pool-client-id';

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'access',
  clientId: USER_POOL_CLIENT_ID,
});

// Hono의 MiddlewareHandler 타입을 명시적으로 사용합니다.
export const cookieAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const token = getCookie(c, 'accessToken');
    if (!token) {
      return c.json({ message: 'Unauthorized: Access token cookie not found.' }, 401);
    }
    
    const payload = await verifier.verify(token);
    
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email as string);
    c.set('userGroups', (payload['cognito:groups'] as string[]) || []);
    
    await next();
  } catch (error: any) {
    console.error('Cookie Auth Error:', error);
    return c.json({ message: 'Unauthorized: Invalid access token from cookie.' }, 401);
  }
};

// =================================================================
// 관리자 전용 미들웨어 (Admin-Only Middleware)
// =================================================================
/**
 * 'Admins' 그룹에 속한 사용자만 접근을 허용하는 미들웨어입니다.
 * 반드시 cookieAuthMiddleware 뒤에 사용해야 합니다.
 */
export const adminOnlyMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  // cookieAuthMiddleware가 context에 주입한 userGroups 정보를 가져옵니다.
  const userGroups = c.get('userGroups');

  // userGroups가 존재하지 않거나, 'Admins' 그룹을 포함하고 있지 않다면,
  if (!userGroups || !userGroups.includes('Admins')) {
    // 403 Forbidden 에러를 반환하고 요청 처리를 중단합니다.
    return c.json({ message: 'Forbidden: Administrator access is required.' }, 403);
  }

  // 관리자임이 확인되면, 다음 핸들러로 제어권을 넘깁니다.
  await next();
};
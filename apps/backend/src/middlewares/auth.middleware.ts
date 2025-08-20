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
// 선택적 인증 미들웨어 (Optional Auth Middleware)
// =================================================================
/**
 * accessToken 쿠키가 존재하면 검증하고 사용자 정보를 주입합니다.
 * 쿠키가 없어도 에러를 반환하지 않고 다음 핸들러로 넘어갑니다.
 * 공개 콘텐츠이지만, 로그인 상태에 따라 다른 처리가 필요할 때 사용합니다.
 */
export const tryCookieAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const token = getCookie(c, 'accessToken');

    // [핵심] 토큰이 없을 경우, 그냥 다음으로 넘어갑니다.
    if (!token) {
      await next();
      return;
    }

    const payload = await verifier.verify(token);

    c.set('userId', payload.sub);
    c.set('userEmail', payload.email as string);
    c.set('userGroups', (payload['cognito:groups'] as string[]) || []);

  } catch (error: any) {
    // 토큰이 있지만 유효하지 않은 경우(만료 등)에도 에러를 던지지 않고,
    // 그냥 로그인하지 않은 사용자인 것처럼 처리합니다.
    console.warn('Optional Auth: Invalid token found, treating as guest.', error.message);
  }

  await next();
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
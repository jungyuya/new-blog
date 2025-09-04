// 파일 위치: apps/backend/src/middlewares/auth.middleware.ts (v2.0 - 최종 정리본)
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { AppEnv } from '../lib/types';

const USER_POOL_ID = process.env.USER_POOL_ID!;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;

// [수정] ID Token 검증기 하나만 생성하여 사용합니다.
// 대부분의 인증 확인은 사용자 정보가 포함된 ID Token으로 수행하는 것이 효율적입니다.
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id', // tokenUse를 'id'로 설정
  clientId: USER_POOL_CLIENT_ID,
});

// =================================================================
// 필수 인증 미들웨어 (Required Auth Middleware)
// =================================================================
/**
 * idToken 쿠키를 검증하고, 유효하지 않으면 401 에러를 반환합니다.
 * 성공 시, context(c)에 `userId`, `userEmail`, `userGroups`를 주입합니다.
 */
export const cookieAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    // [수정] 'idToken' 쿠키를 읽어옵니다.
    const token = getCookie(c, 'idToken');
    if (!token) {
      return c.json({ message: 'Unauthorized: ID token cookie not found.' }, 401);
    }

    // [수정] idTokenVerifier를 사용하여 검증합니다.
    const payload = await idTokenVerifier.verify(token);

    // [수정] 이제 payload에는 email이 반드시 포함되어 있습니다.
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email as string);
    c.set('userGroups', (payload['cognito:groups'] as string[]) || []);

    await next();
  } catch (error: any) {
    console.error('Cookie Auth Error:', error);
    return c.json({ message: 'Unauthorized: Invalid ID token from cookie.' }, 401);
  }
};

// =================================================================
// 선택적 인증 미들웨어 (Optional Auth Middleware)
// =================================================================
/**
 * idToken 쿠키가 존재하면 검증하고 사용자 정보를 주입합니다.
 * 쿠키가 없거나 유효하지 않아도 에러를 반환하지 않고 다음 핸들러로 넘어갑니다.
 */
export const tryCookieAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const token = getCookie(c, 'idToken');
    
    if (token) {
      // 토큰이 존재할 경우에만 검증을 시도합니다.
      const payload = await idTokenVerifier.verify(token);
      c.set('userId', payload.sub);
      c.set('userEmail', payload.email as string);
      c.set('userGroups', (payload['cognito:groups'] as string[]) || []);
    }
  } catch (error: any) {
    // 토큰이 있지만 유효하지 않은 경우(만료 등)에도 에러를 던지지 않고,
    // 그냥 로그인하지 않은 사용자인 것처럼 처리합니다.
    console.warn('Optional Auth: Invalid token found, treating as guest.', error.message);
  }
  // [수정] 토큰이 있든 없든, 유효하든 안 하든, 항상 next()를 호출합니다.
  await next();
};

// =================================================================
// 관리자 전용 미들웨어 (Admin-Only Middleware)
// =================================================================
/**
 * 'Admins' 그룹에 속한 사용자만 접근을 허용하는 미들웨어입니다.
 * 반드시 cookieAuthMiddleware 또는 tryCookieAuthMiddleware 뒤에 사용해야 합니다.
 */
export const adminOnlyMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userGroups = c.get('userGroups');
  if (!userGroups || !userGroups.includes('Admins')) {
    return c.json({ message: 'Forbidden: Administrator access is required.' }, 403);
  }
  await next();
};
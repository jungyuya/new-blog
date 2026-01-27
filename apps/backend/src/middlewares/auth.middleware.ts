// 파일 위치: apps/backend/src/middlewares/auth.middleware.ts (v2.1 - UserContext 주입)
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

import type { AppEnv, UserContext } from '../lib/types'; // UserContext import
import { ddbDocClient } from '../lib/dynamodb'; // ddbDocClient import

const USER_POOL_ID = process.env.USER_POOL_ID!;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;

const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'id',
  clientId: USER_POOL_CLIENT_ID,
});

// =================================================================
// 필수 인증 미들웨어 (Required Auth Middleware)
// =================================================================
export const cookieAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const token = getCookie(c, 'idToken');
    if (!token) {
      return c.json({ message: 'Unauthorized: ID토큰이 만료되었거나 없습니다.' }, 401);
    }

    const payload = await idTokenVerifier.verify(token);

    // --- [핵심 수정] DynamoDB에서 사용자 프로필 정보를 가져옵니다 ---
    const getUserProfileCommand = new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${payload.sub}`,
        SK: `PROFILE`,
      },
    });
    const userProfileResult = await ddbDocClient.send(getUserProfileCommand);
    const userProfile = userProfileResult.Item;

    // --- [핵심 수정] UserContext 객체를 생성하여 컨텍스트에 주입합니다 ---
    const userContext: UserContext = {
      userId: payload.sub,
      userEmail: payload.email as string,
      userGroups: (payload['cognito:groups'] as string[]) || [],
      // 프로필이 아직 없으면 Cognito의 nickname을, 있으면 DB의 nickname을 사용
      nickname: userProfile?.nickname || payload['cognito:nickname'] || 'Unnamed User',
      avatarUrl: userProfile?.avatarUrl,
    };
    c.set('user', userContext);

    // [참고] 기존의 개별 정보 주입도 유지하여 하위 호환성을 보장할 수 있습니다.
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email as string);
    c.set('userGroups', (payload['cognito:groups'] as string[]) || []);

    await next();
  } catch (error: any) {
    console.error('Cookie Auth Error:', error);
    // Postman cURL에 idToken이 없던 문제를 고려하여, 에러 메시지를 더 명확하게 변경
    if (error.message.includes('not found')) {
      return c.json({ message: 'Unauthorized: ID token cookie not found.' }, 401);
    }
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


// =================================================================
// 비로그인 사용자 식별 미들웨어 (Anonymous User Middleware)
// =================================================================
/**
 * X-Anonymous-Id 헤더가 존재하면 검증하고 컨텍스트에 주입합니다.
 * 헤더가 없어도 에러를 반환하지 않고 다음 핸들러로 넘어갑니다.
 * 로그인 여부와 관계없이 항상 익명 ID를 확인할 필요가 있을 때 사용합니다.
 */
export const tryAnonymousAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const anonymousId = c.req.header('x-anonymous-id');

  // UUID v4 형식을 따르는지 간단히 검증하여 안전성을 높입니다.
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (anonymousId && uuidV4Regex.test(anonymousId)) {
    c.set('anonymousId', anonymousId);
  }
  
  // 헤더가 없거나 형식이 맞지 않아도 에러 없이 다음으로 넘어갑니다.
  await next();
};
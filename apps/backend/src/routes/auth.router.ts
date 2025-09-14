// 파일 위치: apps/backend/src/routes/auth.router.ts (v1.1 - 스키마 포함 최종 수정본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { CognitoIdentityProviderClient, SignUpCommand, InitiateAuthCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider';
import type { AppEnv } from '../lib/types';

// =================================================================
// 📐 [SCHEMAS] - 인증 라우터에서 사용할 데이터 유효성 검사 스키마
// =================================================================
const SignUpSchema = z.object({
    email: z.string().email('유효한 이메일 형식이 아닙니다.'),
    password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

const LoginSchema = z.object({
    email: z.string().email('유효한 이메일 형식이 아닙니다.'),
    password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

// =================================================================
// 🚦 [ROUTER] - 'auth'와 관련된 모든 API 경로를 정의합니다.
// =================================================================
const authRouter = new Hono<AppEnv>();

// Cognito 클라이언트 초기화 (이 라우터 내에서만 사용)
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION });
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || 'default-user-pool-client-id';

// --- [1] POST /signup - 회원가입 ---
authRouter.post('/signup', zValidator('json', SignUpSchema), async c => {
    const { email, password } = c.req.valid('json');
    try {
        await cognitoClient.send(new SignUpCommand({ ClientId: USER_POOL_CLIENT_ID, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] }));
        return c.json({ message: 'User signed up successfully. Please confirm your email.' }, 200);
    } catch (error: any) {
        console.error('Sign Up Error:', error);
        if (error.name === 'UsernameExistsException') return c.json({ message: 'User already exists.' }, 409);
        if (error.name === 'InvalidPasswordException' || error.name === 'InvalidParameterException') return c.json({ message: error.message }, 400);
        return c.json({ message: 'Internal Server Error during sign up.', error: error.message }, 500);
    }
});

// --- [2] POST /login - 로그인 ---
authRouter.post('/login', zValidator('json', LoginSchema), async c => {
    const { email, password } = c.req.valid('json');
    try {
        const resp = await cognitoClient.send(new InitiateAuthCommand({
            AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
            ClientId: USER_POOL_CLIENT_ID,
            AuthParameters: { USERNAME: email, PASSWORD: password }
        }));

        if (resp.AuthenticationResult) {
            const { AccessToken, RefreshToken, IdToken } = resp.AuthenticationResult; // IdToken 추가
            const IS_PROD = process.env.NODE_ENV === 'production';
            const cookieOptions = { httpOnly: true, secure: IS_PROD, sameSite: 'Strict' as const, path: '/' };

            if (AccessToken) {
                setCookie(c, 'accessToken', AccessToken, { ...cookieOptions, maxAge: 60 * 60 });
            }
            if (RefreshToken) {
                setCookie(c, 'refreshToken', RefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
            }
            if (IdToken) setCookie(c, 'idToken', IdToken, { ...cookieOptions, maxAge: 60 * 60 });
            return c.json({ message: 'Authentication successful' });
        }
        return c.json({ message: 'Authentication failed, no tokens returned.' }, 401);
    } catch (error: any) {
        console.error('Login Error:', error);
        if (error.name === 'UserNotFoundException' || error.name === 'NotAuthorizedException') {
            return c.json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
        }
        if (error.name === 'UserNotConfirmedException') {
            return c.json({ message: '이메일 인증이 필요합니다.', code: 'USER_NOT_CONFIRMED' }, 403);
        }
        return c.json({ message: '로그인 중 서버 오류가 발생했습니다.', error: error.message }, 500);
    }
});

// --- [3] POST /logout - 로그아웃 (v1.1 - idToken 삭제 추가) ---
authRouter.post('/logout', async c => {
    // [수정] deleteCookie의 옵션은 setCookie와 동일하게 맞춰주는 것이 가장 안전합니다.
    const IS_PROD = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        path: '/',
        secure: IS_PROD,
        httpOnly: true,
        sameSite: 'Strict' as const,
    };

    deleteCookie(c, 'accessToken', cookieOptions);
    deleteCookie(c, 'refreshToken', cookieOptions);
    deleteCookie(c, 'idToken', cookieOptions);

    return c.json({ message: 'User logged out successfully.' }, 200);
});

// =================================================================
// 📦 [EXPORT] - 생성된 라우터를 외부에서 사용할 수 있도록 내보냅니다.
// =================================================================
export default authRouter;
// 파일 위치: apps/backend/__tests__/routes/users.router.test.ts (v2.1 - 최종 수정)
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import { ddbDocClient } from '../../src/lib/dynamodb';
import { mockAdminPayload, mockUserPayload, mockUserProfile } from '../../src/test/setup';

// =================================================================
// 🤫 [MOCKING]
// =================================================================
vi.mock('../../src/lib/dynamodb', () => ({
  ddbDocClient: { send: vi.fn() },
}));

const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}));
vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) },
}));

// =================================================================
// 🚀 [TEST SERVER SETUP]
// =================================================================
let server: ReturnType<typeof serve>;
let app: any;
beforeAll(async () => {
  app = (await import('../../src/index')).app;
  server = serve({ fetch: app.fetch, port: 4003 });
});
afterAll(() => {
  server?.close();
});
beforeEach(() => {
  vi.resetAllMocks();
  // [수정] beforeEach에서는 Cognito 모킹만 담당합니다.
  mockVerify.mockImplementation(async (token: string) => {
    // 이 테스트 파일에서는 fake-user-token만 사용하지만, 일관성을 위해 둘 다 둡니다.
    if (token === 'fake-admin-token') return mockAdminPayload;
    if (token === 'fake-user-token') return mockUserPayload;
    throw new Error('Invalid token');
  });
});

// =================================================================
// 🧪 [TEST SUITE]
// =================================================================
describe('Users API (/api/users)', () => {
  describe('PUT /me/profile', () => {
    const mockUserProfileData = { nickname: 'TestUser', bio: 'This is a test bio.' };

    it('should return 401 Unauthorized if no token is provided', async () => {
      const response = await request(server)
        .put('/api/users/me/profile')
        .send(mockUserProfileData);
      expect(response.status).toBe(401);
    });

    it('should return 400 Bad Request if nickname is too short', async () => {
      // [수정] 미들웨어의 프로필 조회 모킹을 추가합니다.
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: undefined });
      const invalidProfile = { nickname: 'a', bio: 'short name' };

      const response = await request(server)
        .put('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-user-token')
        .send(invalidProfile);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation Error');
    });
    
    it('should create a new profile (upsert) and return 200 OK', async () => {
      // [수정] 미들웨어와 라우터의 모든 DB 호출을 순서대로 명시적으로 모킹합니다.
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: mockUserProfile }) // 1. 미들웨어의 프로필 조회
        .mockResolvedValueOnce({ Item: undefined })     // 2. 라우터의 기존 프로필 확인 (없음)
        .mockResolvedValueOnce({});                     // 3. 라우터의 PutCommand

      const response = await request(server)
        .put('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-user-token')
        .send(mockUserProfileData);

      expect(response.status).toBe(200);
      expect(response.body.profile.nickname).toBe('TestUser');

      // [수정] 총 호출 횟수를 3번으로 수정합니다.
      expect((ddbDocClient.send as any)).toHaveBeenCalledTimes(3);
      
      // PutCommand가 세 번째 호출인지 확인합니다.
      const putCommandArgs = (ddbDocClient.send as any).mock.calls[2][0].input;
      expect(putCommandArgs.Item.PK).toBe(`USER#${mockUserPayload.sub}`);
      expect(putCommandArgs.Item.SK).toBe('PROFILE');
    });
  });

  describe('GET /me/profile', () => {
    it('should return 404 Not Found if profile does not exist', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: undefined }) // 1. 미들웨어의 프로필 조회
        .mockResolvedValueOnce({ Item: undefined }); // 2. 라우터의 프로필 조회
      const response = await request(server)
        .get('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-user-token');
      expect(response.status).toBe(404);
    });

    it('should return 200 OK with the user profile if it exists', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: mockUserProfile }) // 1. 미들웨어의 프로필 조회
        .mockResolvedValueOnce({ Item: mockUserProfile }); // 2. 라우터의 프로필 조회
      const response = await request(server)
        .get('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-user-token');
      expect(response.status).toBe(200);
      expect(response.body.profile.nickname).toBe('Test User Nickname');
    });
  });

  describe('GET /me', () => {
    it('should return user data with nickname from profile if it exists', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: mockUserProfile }) // 1. 미들웨어의 프로필 조회
        .mockResolvedValueOnce({ Item: mockUserProfile }); // 2. 라우터의 프로필 조회
      const response = await request(server)
        .get('/api/users/me')
        .set('Cookie', 'idToken=fake-user-token');
      expect(response.status).toBe(200);
      expect(response.body.user.nickname).toBe('Test User Nickname');
    });

    it('should return user data with default nickname if profile does not exist', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: undefined }) // 1. 미들웨어의 프로필 조회
        .mockResolvedValueOnce({ Item: undefined }); // 2. 라우터의 프로필 조회
      const response = await request(server)
        .get('/api/users/me')
        .set('Cookie', 'idToken=fake-user-token');
      expect(response.status).toBe(200);
      expect(response.body.user.nickname).toBe('user'); // 'user@test.com'에서 @ 앞부분
    });
  });
});
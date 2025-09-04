// 파일 위치: apps/backend/__tests__/routes/users.router.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import type { app } from '../../src/index';
import { ddbDocClient } from '../../src/lib/dynamodb';

// =================================================================
// 🤫 [MOCKING] - 외부 의존성을 모킹합니다.
// =================================================================
// 1. DynamoDB 클라이언트 모킹
vi.mock('../../src/lib/dynamodb', () => ({
  ddbDocClient: { send: vi.fn() },
}));

// 2. Cognito JWT 검증기 모킹
const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}));
vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) },
}));

// =================================================================
// 🚀 [TEST SERVER SETUP] - 블랙박스 테스트를 위한 서버 설정
// =================================================================
let server: ReturnType<typeof serve>;
beforeAll(async () => {
  // 포트 충돌을 방지하기 위해 다른 포트(4003)를 사용합니다.
  server = serve({ fetch: (await import('../../src/index')).app.fetch, port: 4003 });
});
afterAll(() => {
  server?.close();
});
beforeEach(() => {
  vi.resetAllMocks();
});

// =================================================================
// 🧪 [TEST SUITE] - Users API
// =================================================================
describe('Users API (/api/users)', () => {

  describe('PUT /me/profile', () => {
    const mockUserProfile = { nickname: 'TestUser', bio: 'This is a test bio.' };
    const mockJwtPayload = { sub: 'user-123', email: 'test@example.com', 'cognito:groups': ['Users'] };

    it('should return 401 Unauthorized if no token is provided', async () => {
      // Given: 인증 토큰 없음 (cookieAuthMiddleware가 처리)
      // When
      const response = await request(server)
        .put('/api/users/me/profile')
        .send(mockUserProfile);
      // Then
      expect(response.status).toBe(401);
    });

    it('should return 400 Bad Request if nickname is too short', async () => {
      // Given
      mockVerify.mockResolvedValue(mockJwtPayload);
      const invalidProfile = { nickname: 'a', bio: 'short name' };

      // When
      const response = await request(server)
        .put('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-token')
        .send(invalidProfile);

      // [핵심 디버깅] 실제 응답 본문이 어떻게 생겼는지 출력합니다.
      console.log('>>> Zod Validation Error Response Body:', response.body);

      // Then
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation Error');
    });
    
    it('should create a new profile (upsert) and return 200 OK', async () => {
      // Given: 인증 통과, 유효한 데이터, DB에는 기존 프로필 없음
      mockVerify.mockResolvedValue(mockJwtPayload);
      // GetCommand는 'Item: undefined'를 반환하도록 설정
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: undefined });
      // PutCommand는 성공
      (ddbDocClient.send as any).mockResolvedValueOnce({});

      // When
      const response = await request(server)
        .put('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-token')
        .send(mockUserProfile);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.profile.nickname).toBe('TestUser');

      // ddbDocClient.send가 2번(Get, Put) 호출되었는지 확인
      expect((ddbDocClient.send as any)).toHaveBeenCalledTimes(2);
      const putCommandArgs = (ddbDocClient.send as any).mock.calls[1][0].input;
      expect(putCommandArgs.Item.PK).toBe('USER#user-123');
      expect(putCommandArgs.Item.SK).toBe('PROFILE');
      // createdAt이 새로 생성되었는지 확인
      expect(putCommandArgs.Item.createdAt).toBeDefined();
    });
  });
  describe('GET /me/profile', () => {
    const mockJwtPayload = { sub: 'user-123', email: 'test@example.com' };

    it('should return 404 Not Found if profile does not exist', async () => {
      // Given: 인증은 통과했지만, DB에 프로필이 없음
      mockVerify.mockResolvedValue(mockJwtPayload);
      (ddbDocClient.send as any).mockResolvedValue({ Item: undefined });

      // When
      const response = await request(server)
        .get('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-token');

      // Then
      expect(response.status).toBe(404);
    });

    it('should return 200 OK with the user profile if it exists', async () => {
      // Given: 인증 통과, DB에 프로필 존재
      mockVerify.mockResolvedValue(mockJwtPayload);
      const mockProfile = { PK: 'USER#user-123', SK: 'PROFILE', nickname: 'TestUser' };
      (ddbDocClient.send as any).mockResolvedValue({ Item: mockProfile });

      // When
      const response = await request(server)
        .get('/api/users/me/profile')
        .set('Cookie', 'idToken=fake-token');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.profile.nickname).toBe('TestUser');
    });
  });

  describe('GET /me', () => {
    const mockJwtPayload = { sub: 'user-123', email: 'test@example.com', 'cognito:groups': [] };

    it('should return user data with nickname from profile if it exists', async () => {
      // Given: 인증 통과, DB에 프로필 존재
      mockVerify.mockResolvedValue(mockJwtPayload);
      const mockProfile = { PK: 'USER#user-123', SK: 'PROFILE', nickname: 'RealNickname' };
      (ddbDocClient.send as any).mockResolvedValue({ Item: mockProfile });

      // When
      const response = await request(server)
        .get('/api/users/me')
        .set('Cookie', 'idToken=fake-token');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.user.nickname).toBe('RealNickname');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return user data with default nickname if profile does not exist', async () => {
      // Given: 인증 통과, DB에 프로필 없음
      mockVerify.mockResolvedValue(mockJwtPayload);
      (ddbDocClient.send as any).mockResolvedValue({ Item: undefined });

      // When
      const response = await request(server)
        .get('/api/users/me')
        .set('Cookie', 'idToken=fake-token');

      // Then
      expect(response.status).toBe(200);
      // 이메일 앞부분을 기본 닉네임으로 사용하는지 확인
      expect(response.body.user.nickname).toBe('test');
      expect(response.body.user.email).toBe('test@example.com');
    });
  });
});
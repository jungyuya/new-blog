import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import type { app } from '../../src/index';

// [핵심] getSignedUrl 함수를 모킹하여 실제 AWS SDK 호출을 방지합니다.
const { mockGetSignedUrl } = vi.hoisted(() => ({ mockGetSignedUrl: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) },
}));

let server: ReturnType<typeof serve>;
beforeAll(async () => {
  // 포트 충돌을 방지하기 위해 다른 포트(4002)를 사용합니다.
  server = serve({ fetch: (await import('../../src/index')).app.fetch, port: 4002 });
});
afterAll(() => server?.close());
beforeEach(() => vi.resetAllMocks());

describe('Images API (/api/images)', () => {
  describe('GET /presigned-url', () => {
    
    it('should return 403 Forbidden if user is not an admin', async () => {
      // Given: 일반 사용자
      mockVerify.mockResolvedValue({ 'cognito:groups': ['Users'] });

      // When
      const response = await request(server)
        .get('/api/images/presigned-url?fileName=test.png')
        .set('Cookie', 'accessToken=fake-user-token');

      // Then
      expect(response.status).toBe(403);
    });

    it('should return 200 OK with a presigned URL if user is an admin', async () => {
      // Given: 관리자
      mockVerify.mockResolvedValue({ 'cognito:groups': ['Admins'] });
      // getSignedUrl 함수가 호출되면, 가짜 URL을 반환하도록 설정
      const fakePresignedUrl = 'https://fake-s3-url.com/uploads/...';
      mockGetSignedUrl.mockResolvedValue(fakePresignedUrl);

      // When
      const response = await request(server)
        .get('/api/images/presigned-url?fileName=test.png')
        .set('Cookie', 'accessToken=fake-admin-token');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.presignedUrl).toBe(fakePresignedUrl);
      expect(response.body.key).toContain('uploads/');
      expect(response.body.publicUrl).toContain('/images/');
      // getSignedUrl 함수가 정확히 1번 호출되었는지 확인
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should return 400 Bad Request if fileName is missing', async () => {
        // Given: 관리자이지만, 필수 쿼리 파라미터 누락
        mockVerify.mockResolvedValue({ 'cognito:groups': ['Admins'] });

        // When
        const response = await request(server)
            .get('/api/images/presigned-url') // fileName 없음
            .set('Cookie', 'accessToken=fake-admin-token');

        // Then
        expect(response.status).toBe(400);
    });
  });
});
// 파일 위치: apps/backend/__tests__/routes/images.router.test.ts (import 수정 최종본)
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import { mockAdminPayload, mockUserPayload, mockUserProfile } from '../../src/test/setup';
// --- [핵심 수정] ddbDocClient를 import합니다. ---
import { ddbDocClient } from '../../src/lib/dynamodb';

// =================================================================
// 🤫 [MOCKING]
// =================================================================
const { mockGetSignedUrl } = vi.hoisted(() => ({ mockGetSignedUrl: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) },
}));

vi.mock('../../src/lib/dynamodb', () => ({ ddbDocClient: { send: vi.fn() } }));

// =================================================================
// 🚀 [TEST SERVER SETUP]
// =================================================================
let server: ReturnType<typeof serve>;
let app: any;
beforeAll(async () => {
  app = (await import('../../src/index')).app;
  server = serve({ fetch: app.fetch, port: 4005 });
});
afterAll(() => {
  server?.close();
});
beforeEach(() => {
  vi.resetAllMocks();
  mockVerify.mockImplementation(async (token: string) => {
    if (token === 'fake-admin-token') return mockAdminPayload;
    if (token === 'fake-user-token') return mockUserPayload;
    throw new Error('Invalid token');
  });
});

// =================================================================
// 🧪 [TEST SUITE]
// =================================================================
describe('Images API (/api/images)', () => {
  describe('GET /presigned-url', () => {
    
    it('should return 403 Forbidden if user is not an admin', async () => {
      // Given: 일반 사용자
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });

      // When
      const response = await request(server)
        .get('/api/images/presigned-url?fileName=test.png')
        .set('Cookie', 'idToken=fake-user-token');

      // Then
      expect(response.status).toBe(403);
    });

    it('should return 200 OK with a presigned URL if user is an admin', async () => {
      // Given: 관리자
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: undefined });
      const fakePresignedUrl = 'https://fake-s3-url.com/uploads/...';
      mockGetSignedUrl.mockResolvedValue(fakePresignedUrl);

      // When
      const response = await request(server)
        .get('/api/images/presigned-url?fileName=test.png')
        .set('Cookie', 'idToken=fake-admin-token');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.presignedUrl).toBe(fakePresignedUrl);
      expect(response.body.key).toContain('uploads/');
      expect(response.body.publicUrl).toContain('/images/');
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should return 400 Bad Request if fileName is missing', async () => {
        // Given: 관리자이지만, 필수 쿼리 파라미터 누락
        (ddbDocClient.send as any).mockResolvedValueOnce({ Item: undefined });

        // When
        const response = await request(server)
            .get('/api/images/presigned-url')
            .set('Cookie', 'idToken=fake-admin-token');

        // Then
        expect(response.status).toBe(400);
    });
  });
});
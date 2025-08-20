// 파일 위치: apps/backend/__tests__/routes/posts.router.test.ts (v3.0 - 최종 안정화 버전)
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import type { app } from '../../src/index';
import { ddbDocClient } from '../../src/lib/dynamodb';

// =================================================================
// 🤫 [MOCKING] - 모든 외부 의존성을 모킹합니다.
// =================================================================
// 1. DynamoDB 클라이언트 모킹
vi.mock('../../src/lib/dynamodb', () => ({
  ddbDocClient: { send: vi.fn() },
}));

// 2. Cognito JWT 검증기 모킹 (hoisted mock 사용)
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
  // 테스트 서버는 고유한 포트(4001)에서 실행합니다.
  server = serve({ fetch: (await import('../../src/index')).app.fetch, port: 4001 });
});
afterAll(() => {
  server?.close();
});
beforeEach(() => {
  // [핵심] 각 테스트 실행 전에 모든 mock의 상태(호출 기록, mockResolvedValue 등)를 깨끗하게 초기화합니다.
  vi.resetAllMocks();
});

// =================================================================
// 🧪 [TEST SUITE] - Posts API
// =================================================================
describe('Posts API (/api/posts)', () => {

  // --- 1. GET / (목록 조회) ---
  describe('GET /', () => {
    it('should return only public/published posts for guests (no token)', async () => {
      (ddbDocClient.send as any).mockResolvedValue({ Items: [] });
      await request(server).get('/api/posts');
      const queryArgs = (ddbDocClient.send as any).mock.calls[0][0].input;
      expect(queryArgs.FilterExpression).toBe('#status = :published AND #visibility = :public');
    });

    it('should return all posts for admins', async () => {
      mockVerify.mockResolvedValue({ 'cognito:groups': ['Admins'] });
      (ddbDocClient.send as any).mockResolvedValue({ Items: [] });
      const response = await request(server).get('/api/posts').set('Cookie', 'accessToken=fake-admin-token');
      expect(response.status).toBe(200);
      const queryArgs = (ddbDocClient.send as any).mock.calls[0][0].input;
      expect(queryArgs.FilterExpression).toBeUndefined();
    });
  });

  // --- 2. POST / (게시물 생성) ---
  describe('POST /', () => {
    const newPostData = { title: 'New Post', content: 'This is content.', tags: ['React', 'AWS'] };

    it('should return 403 Forbidden if user is not an admin', async () => {
      mockVerify.mockResolvedValue({ sub: 'user-id', 'cognito:groups': ['Users'] });
      const response = await request(server)
        .post('/api/posts')
        .set('Cookie', 'accessToken=fake-user-token')
        .send(newPostData);
      expect(response.status).toBe(403);
    });

    it('should return 201 Created if user is an admin', async () => {
      mockVerify.mockResolvedValue({ sub: 'admin-id', 'cognito:groups': ['Admins'] });
      (ddbDocClient.send as any).mockResolvedValue({});
      const response = await request(server)
        .post('/api/posts')
        .set('Cookie', 'accessToken=fake-admin-token')
        .send(newPostData);
      expect(response.status).toBe(201);
      const sendCall = (ddbDocClient.send as any).mock.calls[0][0];
      expect(sendCall.constructor.name).toBe('BatchWriteCommand');
      const writeRequests = sendCall.input.RequestItems[process.env.TABLE_NAME!];
      expect(writeRequests.length).toBe(3); // Post 1개 + Tag 2개
    });
  });

  // --- 3. GET /:postId (상세 조회) ---
  describe('GET /:postId', () => {
    it('should return 403 Forbidden when a non-author tries to access a private post', async () => {
      const mockPrivatePost = { postId: 'private-1', visibility: 'private', authorId: 'author-1' };
      (ddbDocClient.send as any).mockResolvedValue({ Item: mockPrivatePost });
      mockVerify.mockResolvedValue({ sub: 'another-user-id' }); // 작성자가 아닌 다른 사용자
      const response = await request(server)
        .get('/api/posts/private-1')
        .set('Cookie', 'accessToken=another-user-token');
      expect(response.status).toBe(403);
    });

    it('should return 200 OK when the author accesses their private post', async () => {
      const mockPrivatePost = { postId: 'private-1', visibility: 'private', authorId: 'author-1' };
      (ddbDocClient.send as any).mockResolvedValue({ Item: mockPrivatePost });
      mockVerify.mockResolvedValue({ sub: 'author-1' }); // 작성자 본인
      const response = await request(server)
        .get('/api/posts/private-1')
        .set('Cookie', 'accessToken=author-token');
      expect(response.status).toBe(200);
      expect(response.body.post.postId).toBe('private-1');
      // GetCommand, UpdateCommand(viewCount) 총 2번 호출되었는지 확인
      expect((ddbDocClient.send as any).mock.calls.length).toBe(2);
    });
  });

  // --- 4. PUT /:postId (게시물 수정) ---
  describe('PUT /:postId', () => {
    it('should return 403 Forbidden if a non-admin tries to update a post', async () => {
        mockVerify.mockResolvedValue({ sub: 'user-id', 'cognito:groups': ['Users'] });
        const response = await request(server)
            .put('/api/posts/1')
            .set('Cookie', 'accessToken=user-token')
            .send({ title: 'Updated Title' });
        expect(response.status).toBe(403);
    });

    it('should update a post successfully if user is an admin', async () => {
      mockVerify.mockResolvedValue({ sub: 'admin-id', 'cognito:groups': ['Admins'] });
      // 순서대로 Get(소유권), Batch(태그), Update(게시물)의 mock 응답을 설정
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: { postId: '1', authorId: 'admin-id', tags: [] } })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Attributes: { title: 'Updated Title' } });
      const response = await request(server)
        .put('/api/posts/1')
        .set('Cookie', 'accessToken=admin-token')
        .send({ title: 'Updated Title', tags: ['updated'] });
      expect(response.status).toBe(200);
      expect(response.body.post.title).toBe('Updated Title');
    });
  });
});
// 파일 위치: apps/backend/__tests__/routes/comments.router.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import { ddbDocClient } from '../../src/lib/dynamodb.js'; // [수정] .js 확장자 추가
import { mockAdminPayload, mockUserPayload, mockUserProfile } from '../../src/test/setup';

// =================================================================
// 🤫 [MOCKING] - posts.router.test.ts와 동일한 패턴
// =================================================================
vi.mock('../../src/lib/dynamodb.js', () => ({ ddbDocClient: { send: vi.fn() } })); // [수정] .js 확장자 추가
const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('aws-jwt-verify', () => ({ CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) } }));

// =================================================================
// 🚀 [TEST SERVER SETUP] - posts.router.test.ts와 동일한 패턴
// =================================================================
let server: ReturnType<typeof serve>;
let app: any;

beforeAll(async () => {
  // comments.router가 포함된 전체 앱을 가져옵니다.
  app = (await import('../../src/index.js')).app;
  server = serve({ fetch: app.fetch, port: 4002 }); // 충돌 방지를 위해 다른 포트 사용
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  // 모든 mock을 초기화합니다.
  vi.resetAllMocks();
  // 인증 mock을 설정합니다.
  mockVerify.mockImplementation(async (token: string) => {
    if (token === 'fake-admin-token') return mockAdminPayload;
    if (token === 'fake-user-token') return mockUserPayload;
    throw new Error('Invalid token');
  });
});

// =================================================================
// 🧪 [TEST SUITE]
// =================================================================
describe('Comments API', () => {
  const postId = 'test-post-123';
  const mockComment = {
    PK: `POST#${postId}`,
    SK: `COMMENT#123456789#c-abc-123`,
    commentId: 'c-abc-123',
    authorId: mockUserPayload.sub, // 일반 유저가 작성
    content: 'Original comment',
  };
  const mockAdminComment = {
    ...mockComment,
    commentId: 'c-admin-456',
    authorId: mockAdminPayload.sub, // 관리자가 작성
  };

  // --- POST /api/posts/:postId/comments ---
  describe('POST /api/posts/:postId/comments', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const response = await request(server)
        .post(`/api/posts/${postId}/comments`)
        .send({ content: 'New comment' });
      expect(response.status).toBe(401);
    });

    it('should create a new comment and return 201 Created if user is logged in', async () => {
      // auth.middleware가 DB에서 프로필을 조회하는 것을 모킹합니다.
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      // comments.router가 PutCommand를 보내는 것을 모킹합니다.
      (ddbDocClient.send as any).mockResolvedValueOnce({});

      const response = await request(server)
        .post(`/api/posts/${postId}/comments`)
        .set('Cookie', 'idToken=fake-user-token')
        .send({ content: 'New comment' });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('New comment');
      expect(response.body.authorId).toBe(mockUserPayload.sub);
    });
  });

  // --- GET /api/posts/:postId/comments ---
  describe('GET /api/posts/:postId/comments', () => {
    it('should return comments for a given post', async () => {
      (ddbDocClient.send as any).mockResolvedValue({ Items: [mockComment] });

      const response = await request(server).get(`/api/posts/${postId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0].content).toBe('Original comment');
    });
  });

  // --- PUT /api/comments/:commentId ---
  describe('PUT /api/comments/:commentId', () => {
    it('should return 403 Forbidden if a user tries to update another user\'s comment', async () => {
      // auth.middleware가 프로필을 조회합니다.
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      // comments.router가 소유권 검증을 위해 모든 댓글을 Query합니다.
      (ddbDocClient.send as any).mockResolvedValueOnce({ Items: [mockAdminComment] }); // 관리자가 쓴 댓글

      const response = await request(server)
        .put(`/api/comments/${mockAdminComment.commentId}`)
        .set('Cookie', 'idToken=fake-user-token') // 일반 유저로 로그인
        .send({ content: 'Updated content', postId });

      expect(response.status).toBe(403);
    });

    it('should update a comment and return 200 OK if the user is the author', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: mockUserProfile }) // 1. auth.middleware 프로필 조회
        .mockResolvedValueOnce({ Items: [mockComment] }) // 2. 소유권 검증 Query
        .mockResolvedValueOnce({ Attributes: { ...mockComment, content: 'Updated content' } }); // 3. UpdateCommand 결과

      const response = await request(server)
        .put(`/api/comments/${mockComment.commentId}`)
        .set('Cookie', 'idToken=fake-user-token') // 댓글 작성자로 로그인
        .send({ content: 'Updated content', postId });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('Updated content');
    });
  });

  // --- DELETE /api/comments/:commentId ---
  describe('DELETE /api/comments/:commentId', () => {
    it('should return 403 Forbidden if a user tries to delete another user\'s comment', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: mockUserProfile })
        .mockResolvedValueOnce({ Items: [mockAdminComment] });

      const response = await request(server)
        .delete(`/api/comments/${mockAdminComment.commentId}`)
        .set('Cookie', 'idToken=fake-user-token')
        .send({ postId });

      expect(response.status).toBe(403);
    });

    it('should soft-delete a comment and return 204 No Content if the user is the author', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: mockUserProfile }) // 1. auth.middleware 프로필 조회
        .mockResolvedValueOnce({ Items: [mockComment] }) // 2. 소유권 검증 Query
        .mockResolvedValueOnce({}); // 3. UpdateCommand (soft-delete) 결과

      const response = await request(server)
        .delete(`/api/comments/${mockComment.commentId}`)
        .set('Cookie', 'idToken=fake-user-token')
        .send({ postId });

      expect(response.status).toBe(204);
    });
  });
});
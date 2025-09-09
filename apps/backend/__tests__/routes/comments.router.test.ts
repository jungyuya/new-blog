// 파일 위치: apps/backend/__tests__/routes/comments.router.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import { ddbDocClient } from '../../src/lib/dynamodb';
import { mockAdminPayload, mockUserPayload, mockUserProfile } from '../../src/test/setup';

// =================================================================
// 🤫 [MOCKING] - posts.router.test.ts와 동일한 패턴
// =================================================================
vi.mock('../../src/lib/dynamodb', () => ({ ddbDocClient: { send: vi.fn() } }));
const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('aws-jwt-verify', () => ({ CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) } }));

// =================================================================
// 🚀 [TEST SERVER SETUP] - posts.router.test.ts와 동일한 패턴
// =================================================================
let server: ReturnType<typeof serve>;
let app: any;
beforeAll(async () => {
  app = (await import('../../src/index')).app;
  server = serve({ fetch: app.fetch, port: 4002 }); // 포트 충돌 방지를 위해 4002 사용
});
afterAll(() => { server?.close(); });
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
describe('Comments API (/api/posts/:postId/comments & /api/comments/:commentId)', () => {
  const postId = 'test-post-123';
  const commentId = 'test-comment-456';
  const mockComment = {
    PK: `POST#${postId}`,
    SK: `COMMENT#123456789#${commentId}`,
    commentId,
    authorId: mockUserPayload.sub, // 댓글 작성자는 일반 사용자
    content: 'Original comment',
  };

  describe('POST /api/posts/:postId/comments', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const response = await request(server)
        .post(`/api/posts/${postId}/comments`)
        .send({ content: 'A comment from a guest' });
      expect(response.status).toBe(401);
    });

    it('should create a new comment and return 201 Created if user is logged in', async () => {
      // auth.middleware가 DB에서 프로필을 조회하는 것을 모킹
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      // comments.router가 PutCommand를 보내는 것을 모킹
      (ddbDocClient.send as any).mockResolvedValueOnce({});

      const response = await request(server)
        .post(`/api/posts/${postId}/comments`)
        .set('Cookie', 'idToken=fake-user-token')
        .send({ content: 'A new comment' });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('A new comment');
      expect(response.body.authorId).toBe(mockUserPayload.sub);
    });
  });

  describe('GET /api/posts/:postId/comments', () => {
    it('should return a list of comments for a given post', async () => {
      (ddbDocClient.send as any).mockResolvedValue({ Items: [mockComment] });
      const response = await request(server).get(`/api/posts/${postId}/comments`);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0].commentId).toBe(commentId);
    });
  });

  describe('PUT /api/comments/:commentId', () => {
    it('should return 403 Forbidden if a non-author tries to update a comment', async () => {
      // auth.middleware가 Admin 프로필을 조회
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: { nickname: 'Admin' } });
      // comments.router가 소유권 검증을 위해 댓글 목록을 조회
      (ddbDocClient.send as any).mockResolvedValueOnce({ Items: [mockComment] });

      const response = await request(server)
        .put(`/api/comments/${commentId}`)
        .set('Cookie', 'idToken=fake-admin-token') // 관리자가 수정 시도
        .send({ content: 'Updated content', postId });

      expect(response.status).toBe(403);
    });

    it('should update the comment and return 200 OK if the author updates it', async () => {
      // auth.middleware가 User 프로필을 조회
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      // comments.router가 소유권 검증을 위해 댓글 목록을 조회
      (ddbDocClient.send as any).mockResolvedValueOnce({ Items: [mockComment] });
      // comments.router가 UpdateCommand를 보내고, 업데이트된 아이템을 반환
      (ddbDocClient.send as any).mockResolvedValueOnce({ Attributes: { ...mockComment, content: 'Updated content' } });

      const response = await request(server)
        .put(`/api/comments/${commentId}`)
        .set('Cookie', 'idToken=fake-user-token') // 작성자가 수정 시도
        .send({ content: 'Updated content', postId });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('Updated content');
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('should soft-delete the comment and return 204 No Content if the author deletes it', async () => {
      // auth.middleware가 User 프로필을 조회
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      // comments.router가 소유권 검증을 위해 댓글 목록을 조회
      (ddbDocClient.send as any).mockResolvedValueOnce({ Items: [mockComment] });
      // comments.router가 UpdateCommand(soft-delete)를 보냄
      (ddbDocClient.send as any).mockResolvedValueOnce({});

      const response = await request(server)
        .delete(`/api/comments/${commentId}`)
        .set('Cookie', 'idToken=fake-user-token') // 작성자가 삭제 시도
        .send({ postId });

      expect(response.status).toBe(204);
    });
  });
});
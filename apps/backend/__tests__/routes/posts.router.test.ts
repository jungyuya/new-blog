// 파일 위치: apps/backend/__tests__/routes/posts.router.test.ts (v3.9 - 최종)
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import { ddbDocClient } from '../../src/lib/dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { mockAdminPayload, mockUserPayload, mockUserProfile } from '../../src/test/setup';

// =================================================================
// 🤫 [MOCKING]
// =================================================================
vi.mock('../../src/lib/dynamodb', () => ({ ddbDocClient: { send: vi.fn() } }));
const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('aws-jwt-verify', () => ({ CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) } }));
const { mockS3Send } = vi.hoisted(() => ({ mockS3Send: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: vi.fn(() => ({ send: mockS3Send })), DeleteObjectsCommand: vi.fn((input) => ({ input })) }));
// =================================================================
// 🚀 [TEST SERVER SETUP]
// =================================================================
let server: ReturnType<typeof serve>;
let app: any;
beforeAll(async () => {
  app = (await import('../../src/index')).app;
  server = serve({ fetch: app.fetch, port: 4001 });
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
describe('Posts API (/api/posts)', () => {
  describe('GET /', () => {
    it('should return only public/published posts for guests (no token)', async () => {
      (ddbDocClient.send as any).mockResolvedValue({ Items: [] });
      await request(server).get('/api/posts');
      const queryArgs = (ddbDocClient.send as any).mock.calls[0][0].input;
      expect(queryArgs.FilterExpression).toBe('#status = :published AND #visibility = :public');
    });

    it('should return all posts for admins', async () => {
      (ddbDocClient.send as any).mockResolvedValue({ Items: [{ title: 'Admin Post' }] });
      const response = await request(server).get('/api/posts').set('Cookie', 'idToken=fake-admin-token');
      expect(response.status).toBe(200);
      expect(response.body.posts).toHaveLength(1);
    });
  });

  describe('POST /', () => {
    const newPostData = { title: 'New Post', content: 'This is content.', tags: ['React', 'AWS'] };
    it('should return 403 Forbidden if user is not an admin', async () => {
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      const response = await request(server).post('/api/posts').set('Cookie', 'idToken=fake-user-token').send(newPostData);
      expect(response.status).toBe(403);
    });

    it('should return 201 Created if user is an admin', async () => {
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: undefined }) // 1. Admin 프로필 조회
        .mockResolvedValueOnce({});                 // 2. BatchWrite 응답
      const response = await request(server).post('/api/posts').set('Cookie', 'idToken=fake-admin-token').send(newPostData);
      expect(response.status).toBe(201);
      expect(response.body.post.title).toBe('New Post');
    });
  });

  describe('GET /:postId', () => {
    it('should return 403 Forbidden when a non-author tries to access a private post', async () => {
      const mockPrivatePost = { postId: 'private-1', visibility: 'private', authorId: 'another-user-id' };
      (ddbDocClient.send as any).mockResolvedValue({ Item: mockPrivatePost });
      const response = await request(server).get('/api/posts/private-1').set('Cookie', 'idToken=fake-user-token');
      expect(response.status).toBe(403);
    });

    it('should return 200 OK when the author accesses their private post', async () => {
      const mockPrivatePost = { postId: 'private-1', visibility: 'private', authorId: mockUserPayload.sub };
      
      // --- 리팩토링된 코드의 실제 DB 호출 순서와 횟수에 맞게 mock을 재설정합니다. ---
      (ddbDocClient.send as any)
        // 1. postsRepository.findPostById(postId) 호출에 대한 응답
        .mockResolvedValueOnce({ Item: mockPrivatePost }) 
        // 2. postsRepository.incrementViewCount(postId) 호출에 대한 응답 (결과값은 중요하지 않음)
        .mockResolvedValueOnce({}) 
        // 3. likes.service.checkUserLikeStatus() 호출에 대한 응답 (좋아요 누르지 않은 상태)
        .mockResolvedValueOnce({ Item: null }) 
        // 4. postsRepository.findAllPostTitlesForNav(isAdmin) 호출에 대한 응답
        .mockResolvedValueOnce({ Items: [{ postId: 'private-1', title: 'Private Post' }] });

      const response = await request(server).get('/api/posts/private-1').set('Cookie', 'idToken=fake-user-token');
      
      expect(response.status).toBe(200);
      expect(response.body.post.postId).toBe('private-1');
      expect(response.body).toHaveProperty('prevPost');
      expect(response.body).toHaveProperty('nextPost');
    });
  });

  describe('PUT /:postId', () => {
    it('should return 403 Forbidden if a non-admin tries to update a post', async () => {
      (ddbDocClient.send as any).mockResolvedValueOnce({ Item: mockUserProfile });
      const response = await request(server).put('/api/posts/1').set('Cookie', 'idToken=fake-user-token').send({ title: 'Updated Title' });
      expect(response.status).toBe(403);
    });

    it('should update a post successfully if user is an admin and the author', async () => {
      const mockPost = { postId: '1', tags: [], authorId: mockAdminPayload.sub }; // 관리자가 작성자
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: undefined }) // 1. Admin 프로필 조회
        .mockResolvedValueOnce({ Item: mockPost }) // 2. Get Post
        .mockResolvedValueOnce({ Item: undefined }) // 3. Admin 프로필 재조회
        .mockResolvedValueOnce({}) // 4. BatchWrite Tags
        .mockResolvedValueOnce({ Attributes: { title: 'Updated Title' } }); // 5. Update Post
      const response = await request(server).put('/api/posts/1').set('Cookie', 'idToken=fake-admin-token').send({ title: 'Updated Title', tags: ['updated'] });
      expect(response.status).toBe(200);
      expect(response.body.post.title).toBe('Updated Title');
    });
  });

  describe('DELETE /:postId', () => {
    it('should soft-delete post successfully if user is an admin and the author', async () => {
      const mockPost = { postId: 'post-to-delete', content: `![test](https://test.com/images/image.webp)`, authorId: mockAdminPayload.sub }; // 관리자가 작성자
      (ddbDocClient.send as any)
        .mockResolvedValueOnce({ Item: undefined }) // 1. Admin 프로필 조회
        .mockResolvedValueOnce({ Item: mockPost }) // 2. Get Post
        .mockResolvedValueOnce({});                 // 3. Update Post (soft-delete)
      mockS3Send.mockResolvedValue({});
      const response = await request(server).delete('/api/posts/post-to-delete').set('Cookie', 'idToken=fake-admin-token');
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('soft-deleted successfully');
    });
  });
});
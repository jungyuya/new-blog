// 파일 위치: apps/backend/__tests__/routes/posts.router.test.ts (v2.2 - 데이터 수정 최종본)

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import type { app } from '../../src/index';
import { ddbDocClient } from '../../src/lib/dynamodb';

// --- 모킹 및 서버 설정은 이전과 동일 ---

vi.mock('../../src/lib/dynamodb', () => ({
    ddbDocClient: { send: vi.fn() },
}));

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));

vi.mock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: { create: vi.fn().mockReturnValue({ verify: mockVerify }) },
}));

let server: ReturnType<typeof serve>;
let appInstance: typeof app;

beforeAll(async () => {
    const imported = await import('../../src/index');
    appInstance = imported.app;
    server = serve({ fetch: appInstance.fetch, port: 4001 });
});

afterAll(() => {
    server?.close();
});

beforeEach(() => {
    vi.resetAllMocks();
});

// --- 테스트 스위트 ---
describe('Posts API (/api/posts)', () => {

    describe('GET /', () => {
        it('should return 200 OK with an array of posts when data exists', async () => {
            // ✅ [수정] 실제 코드의 필터 로직을 통과할 수 있도록 완전한 데이터를 제공합니다.
            const mockPosts = [
                {
                    postId: '1',
                    title: 'Test Post 1',
                    data_type: 'Post', // 필터 조건 1
                    isDeleted: false,  // 필터 조건 2
                },
            ];
            (ddbDocClient.send as any).mockResolvedValue({ Items: mockPosts });

            const response = await request(server).get('/api/posts');

            expect(response.status).toBe(200);
            // 이제 posts 배열은 비어있지 않으므로, 아래 검증이 성공합니다.
            expect(response.body.posts[0].title).toBe('Test Post 1');
        });

        // 'empty array' 테스트는 변경할 필요가 없습니다.
        it('should return 200 OK with an empty array when no data exists', async () => {
            (ddbDocClient.send as any).mockResolvedValue({ Items: [] });
            const response = await request(server).get('/api/posts');
            expect(response.status).toBe(200);
            expect(response.body.posts).toEqual([]);
        });
    });

    // POST 테스트 스위트는 변경할 필요가 없습니다.
    describe('POST /', () => {
        it('should return 403 Forbidden if user is not an admin', async () => {
            const mockUserPayload = {
                sub: 'user-uuid-123',
                email: 'user@example.com',
                'cognito:groups': ['Users'],
            };
            mockVerify.mockResolvedValue(mockUserPayload);
            const newPostData = { title: 'New Post', content: 'This is content.' };
            const response = await request(server)
                .post('/api/posts')
                .set('Cookie', 'accessToken=fake-user-token')
                .send(newPostData);
            expect(response.status).toBe(403);
            expect(response.body.message).toContain('Administrator access is required');
        });

        it('should return 201 Created if user is an admin', async () => {
            const mockAdminPayload = {
                sub: 'admin-uuid-456',
                email: 'admin@example.com',
                'cognito:groups': ['Admins', 'Users'],
            };
            mockVerify.mockResolvedValue(mockAdminPayload);
            (ddbDocClient.send as any).mockResolvedValue({});
            const newPostData = { title: 'Admin Post', content: 'Content by admin.' };
            const response = await request(server)
                .post('/api/posts')
                .set('Cookie', 'accessToken=fake-admin-token')
                .send(newPostData);
            expect(response.status).toBe(201);
            expect(response.body.message).toContain('Post created successfully!');
            expect(response.body.post.authorId).toBe('admin-uuid-456');
        });
    });
});
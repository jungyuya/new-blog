// 파일 위치: apps/backend/__tests__/routes/posts.router.test.ts (v1.2 - Cognito Mocking 추가 최종본)
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import { app } from '../../src/index';
import { ddbDocClient } from '../../src/lib/dynamodb';
import { CognitoJwtVerifier } from 'aws-jwt-verify'; // 모킹을 위해 import

// =================================================================
// 🤫 [MOCKING] - 모든 외부 의존성을 흉내내는 가짜(Mock) 객체를 만듭니다.
// =================================================================

// [1] DynamoDB 클라이언트 모킹
vi.mock('../../src/lib/dynamodb', () => ({
    ddbDocClient: {
        send: vi.fn(),
    },
}));

// [2] Cognito JWT 검증기 모킹 (새로 추가된 부분!)
vi.mock('aws-jwt-verify', () => {
    // CognitoJwtVerifier 클래스 전체를 모킹합니다.
    return {
        CognitoJwtVerifier: {
            // verifier 인스턴스를 만드는 create 정적 메서드를 가짜 함수로 대체합니다.
            create: vi.fn().mockReturnValue({
                // create가 반환하는 객체에는 verify 메서드가 있어야 합니다.
                // 이 verify 메서드 또한 가짜 함수로 대체합니다.
                verify: vi.fn(),
            }),
        },
    };
});

const server = serve({ fetch: app.fetch });

describe('Posts API (/api/posts)', () => {

    beforeEach(() => {
        // 각 테스트 시작 전에 모든 mock을 초기화합니다.
        vi.clearAllMocks();
    });
    // --- [TEST SUITE 1] ---
    describe('GET /', () => {

        it('should return 200 OK with an array of posts when data exists', async () => {
            // Given
            const mockPosts = [
                { postId: '1', title: 'Test Post 1', isDeleted: false, data_type: 'Post' },
                { postId: '2', title: 'Test Post 2', isDeleted: false, data_type: 'Post' },
            ];
            (ddbDocClient.send as any).mockResolvedValue({ Items: mockPosts });

            // When
            const response = await request(server).get('/api/posts');

            // Then
            expect(response.status).toBe(200);
            expect(response.body.posts.length).toBe(2);
            expect(response.body.posts[0].title).toBe('Test Post 1');
        });

        it('should return 200 OK with an empty array when no data exists', async () => {
            // Given
            (ddbDocClient.send as any).mockResolvedValue({ Items: [] });

            // When
            const response = await request(server).get('/api/posts');

            // Then
            expect(response.status).toBe(200);
            expect(response.body.posts).toEqual([]);
        });
    });

    // --- [TEST SUITE 2] ---
    describe('POST /', () => {

        it('should return 403 Forbidden if user is not an admin', async () => {
            // [1] Given (준비): 일반 사용자(Admins 그룹 없음)의 토큰을 시뮬레이션합니다.
            const mockUserPayload = {
                sub: 'user-uuid-123',
                email: 'user@example.com',
                'cognito:groups': ['Users'], // 'Admins' 그룹이 아님
            };
            // Cognito verifier의 verify 함수가 호출되면, 위 가짜 페이로드를 반환하도록 설정합니다.
            (CognitoJwtVerifier.create({} as any).verify as any).mockResolvedValue(mockUserPayload);

            // 글 생성에 필요한 가짜 데이터
            const newPostData = { title: 'New Post', content: 'This is content.' };

            // [2] When (실행): 일반 사용자가 글 생성을 시도합니다.
            const response = await request(server)
                .post('/api/posts')
                .set('Cookie', 'accessToken=fake-user-token') // 쿠키는 존재해야 cookieAuthMiddleware를 통과함
                .send(newPostData);

            // [3] Then (검증): 403 에러가 발생하는지 확인합니다.
            expect(response.status).toBe(403);
            expect(response.body.message).toContain('Administrator access is required');
        });

        it('should return 201 Created if user is an admin', async () => {
            // [1] Given (준비): 관리자(Admins 그룹 포함)의 토큰을 시뮬레이션합니다.
            const mockAdminPayload = {
                sub: 'admin-uuid-456',
                email: 'admin@example.com',
                'cognito:groups': ['Admins', 'Users'], // 'Admins' 그룹 포함!
            };
            (CognitoJwtVerifier.create({} as any).verify as any).mockResolvedValue(mockAdminPayload);

            // DynamoDB의 PutCommand가 성공적으로 완료되었다고 시뮬레이션합니다.
            (ddbDocClient.send as any).mockResolvedValue({});

            const newPostData = { title: 'Admin Post', content: 'Content by admin.' };

            // [2] When (실행): 관리자가 글 생성을 시도합니다.
            const response = await request(server)
                .post('/api/posts')
                .set('Cookie', 'accessToken=fake-admin-token')
                .send(newPostData);

            // [3] Then (검증): 201 성공 코드가 반환되는지 확인합니다.
            expect(response.status).toBe(201);
            expect(response.body.message).toContain('Post created successfully!');
            // 생성된 post 객체에 admin의 정보가 잘 담겼는지도 확인할 수 있습니다.
            expect(response.body.post.authorId).toBe('admin-uuid-456');
        });
    });
});
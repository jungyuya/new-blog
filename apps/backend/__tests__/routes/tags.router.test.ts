// 파일 위치: apps/backend/__tests__/routes/tags.router.test.ts (포트 수정)
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { serve } from '@hono/node-server';
import type { app } from '../../src/index';
import { ddbDocClient } from '../../src/lib/dynamodb';

// --- 모킹 및 서버 설정 ---
vi.mock('../../src/lib/dynamodb', () => ({ ddbDocClient: { send: vi.fn() } }));
let server: ReturnType<typeof serve>;
beforeAll(async () => { 
  // [핵심 수정] 포트 번호를 4004로 변경하여 다른 테스트와의 충돌을 방지합니다.
  server = serve({ fetch: (await import('../../src/index')).app.fetch, port: 4004 }); 
});
afterAll(() => server?.close());
beforeEach(() => vi.resetAllMocks());

// --- 테스트 스위트 ---
describe('Tags API (/api/tags)', () => {
  describe('GET /:tagName/posts', () => {
    it('should return 200 OK with posts for a specific tag', async () => {
      // Given
      const mockTaggedPosts = [{ postId: '1', title: 'React Post' }];
      (ddbDocClient.send as any).mockResolvedValue({ Items: mockTaggedPosts });

      // When
      const response = await request(server).get('/api/tags/react/posts');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.posts.length).toBe(1);
      expect(response.body.posts[0].title).toBe('React Post');
      // GSI2를 사용했는지 확인
      const queryCommandArgs = (ddbDocClient.send as any).mock.calls[0][0].input;
      expect(queryCommandArgs.IndexName).toBe('GSI2');
      expect(queryCommandArgs.ExpressionAttributeValues[':pk']).toBe('TAG#react');
    });
  });
});
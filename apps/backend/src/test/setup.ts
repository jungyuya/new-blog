// 파일 위치: apps/backend/src/test/setup.ts (v2.1 - 모킹 제거, 데이터 정의만)
import { beforeAll, afterAll, vi } from 'vitest';

// [신규] 모든 테스트 파일에서 import하여 사용할 수 있도록 export 합니다.
export const mockAdminPayload = {
  sub: 'admin-123',
  email: 'admin@test.com',
  'cognito:groups': ['Admins'],
  'cognito:nickname': 'AdminUser',
};

export const mockUserPayload = {
  sub: 'user-123',
  email: 'user@test.com',
  'cognito:groups': [],
  'cognito:nickname': 'NormalUser',
};

export const mockUserProfile = {
  PK: `USER#${mockUserPayload.sub}`,
  SK: 'PROFILE',
  userId: mockUserPayload.sub,
  nickname: 'Test User Nickname',
  avatarUrl: 'http://example.com/avatar.png',
};

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.USER_POOL_ID = 'ap-northeast-2_testpool';
  process.env.USER_POOL_CLIENT_ID = 'testclientid';
  process.env.TABLE_NAME = 'TestBlogTable';
  console.log('🚀 Vitest setup complete. Running in TEST mode.');
});

afterAll(() => {
  console.log('✅ Vitest teardown complete.');
});
import { beforeAll, afterAll, vi } from 'vitest';

// 이 파일은 모든 테스트 파일이 실행되기 전에 단 한 번 실행됩니다.

beforeAll(() => {
  // 1. 현재 프로세스가 '테스트' 환경임을 명시적으로 설정합니다.
  //    이를 통해 프로덕션 코드(예: index.ts)에서 
  //    if (process.env.NODE_ENV === 'test') 와 같은 분기 처리가 가능해집니다.
  process.env.NODE_ENV = 'test';

  // 2. 테스트에 필요한 최소한의 환경 변수를 설정합니다.
  //    CognitoJwtVerifier가 형식 오류를 일으키지 않도록, 실제와 유사한 형식의 가짜 값을 넣어줍니다.
  process.env.USER_POOL_ID = 'ap-northeast-2_testpool';
  process.env.USER_POOL_CLIENT_ID = 'testclientid';
  process.env.TABLE_NAME = 'TestBlogTable';

  console.log('🚀 Vitest setup complete. Running in TEST mode.');
});

afterAll(() => {
  // 모든 테스트가 끝난 후 정리 작업을 수행할 수 있습니다.
  console.log('✅ Vitest teardown complete.');
});
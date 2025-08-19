// 파일 위치: apps/backend/vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // describe, it, expect 와 같은 Vitest의 기본 함수들을
    // 각 테스트 파일마다 import 하지 않고도 전역적으로 사용할 수 있게 해줍니다.
    globals: true,
    
    // 테스트 코드가 실행될 환경을 Node.js로 설정합니다.
    // 브라우저 API(예: document)가 없는 백엔드 환경에 적합합니다.
    environment: 'node',
    
    // (선택 사항이지만 권장) 테스트 실행 전에 매번 실행될 설정 파일을 지정합니다.
    // 이 파일은 나중에 만들 것입니다.
    // setupFiles: './src/test/setup.ts', 
  },
});
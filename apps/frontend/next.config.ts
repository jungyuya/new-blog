// apps/frontend/next.config.ts (최종 수정본)
import type { NextConfig } from 'next';

const config: NextConfig = {
  // output: 'standalone',  // <--- 이 라인을 완전히 삭제하거나 주석 처리합니다.
  
  // typescript: {          // <--- 이 블록 전체를 완전히 삭제하거나 주석 처리합니다.
  //   ignoreBuildErrors: true,
  // },
};

// 만약 config 객체 안에 아무것도 남지 않는다면, 아래와 같이 비워두어도 좋습니다.
// const config: NextConfig = {};

export default config;
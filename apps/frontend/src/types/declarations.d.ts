// 이 파일은 타입 정의(.d.ts)가 없는 순수 JavaScript 모듈을 위해
// TypeScript에게 해당 모듈이 존재함을 알려주는 역할을 합니다.
// 파일 위치: apps/frontend/src/types/declarations.d.ts

import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

declare module 'remark-unwrap-images';
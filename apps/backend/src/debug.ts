// 파일: apps/backend/src/debug.ts (marked 단독 테스트용)

import { marked } from 'marked';
// import { sanitizeContent } from './lib/sanitizer'; // 이번 테스트에서는 사용하지 않음

// 1. 문제가 발생하는 부분만 최소한으로 잘라낸 마크다운 텍스트
const problematicMarkdown = `
3.1. 우리 블로그만의 '보안 정책' 수립
apps/backend/src/lib/sanitizer.ts 파일을 만들어, 우리 블로그에서 허용할 태그와 속성의 목록을 명시적으로 정의했습니다.

\`\`\`typescript
// sanitizer.ts
import sanitizeHtml from 'sanitize-html';
\`\`\`

이 코드 다음 내용이 잘립니다.
`;

async function runMarkedOnlyTest() {
  console.log('--- [Debug] marked 라이브러리 단독 출력 결과 확인 ---');

  // 2. 다른 과정 없이, marked.parse()의 결과물을 직접 확인합니다.
  try {
    const resultFromMarked = await marked.parse(problematicMarkdown);

    console.log(resultFromMarked);
  } catch (error) {
    console.error("marked.parse()에서 오류 발생:", error);
  }
}

runMarkedOnlyTest();
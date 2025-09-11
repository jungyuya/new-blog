// 파일: apps/backend/src/debug.ts

import { sanitizeContent } from './lib/sanitizer';
import { marked } from 'marked';

// --- 시나리오 3 (수정된 버전) ---

const markdownInput = `
## 1. 편리함 속에 숨겨진 위험: XSS 취약점의 발견

최근 블로그에 유튜브 동영상을 첨부하는 기능을 구현하던 중, 편리한 기능 뒤에 숨어있던 아찔한 보안 취약점을 발견했습니다. 제 블로그는 Toast UI Editor를 사용하여 마크다운으로 글을 작성하고, \`react-markdown\`과 \`rehype-raw\` 플러그인을 통해 본문을 렌더링하고 있습니다.

\`rehype-raw\`는 마크다운에 포함된 HTML 태그를 실제 DOM 요소로 렌더링해주는 강력한 플러그인입니다. 덕분에 아래와 같은 유튜브 \`<iframe>\` 태그를 본문에 넣으면 영상이 잘 출력되었습니다.

\`\`\`html
<iframe src="https://www.youtube.com/embed/..."></iframe>
\`\`\`

문제는 여기서 시작되었습니다. 만약 \`<iframe>\` 대신, 아래와 같은 악의적인 \`<script>\` 태그를 삽입하면 어떻게 될까요?

\`\`\`html
<script>alert('당신의 쿠키 정보가 탈취되었습니다!');</script>
\`\`\`

\`rehype-raw\`는 이 또한 정직하게 HTML로 렌더링했고, 결과적으로 다른 사용자가 이 게시물을 보는 순간 해당 스크립트가 실행되는 **XSS(Cross-Site Scripting) 공격**에 무방비로 노출되는 상태였습니다.

## 2. 첫 번째 실패: DOMPurify와 '내용 삭제' 대란

XSS 공격을 막는 가장 표준적인 방법은 서버 측에서 HTML을 저장하기 전에 '정제(Sanitization)'하는 것입니다. 처음에는 가장 유명한 라이브러리인 \`DOMPurify\`를 백엔드에 도입하려 했습니다.

하지만 테스트 과정에서 심각한 부작용을 겪었습니다. \`DOMPurify\`를 적용하자, 악성 스크립트뿐만 아니라 **마크다운으로 작성된 정상적인 글 내용(목록, 인용구, 코드 블록 등)의 상당 부분이 삭제**되는 문제가 발생했습니다.
`;

// 비동기 작업을 처리하기 위해 전체 로직을 async 함수로 감쌉니다.
async function runTest() {
  console.log('--- [시나리오 3] 올바른 순서로 처리 ---');

  // [1단계] marked.parse가 Promise를 반환하므로 'await'로 기다려서 결과를 받습니다.
  const convertedHtml = await marked.parse(markdownInput);

  console.log('\n--- [중간 결과] Markdown -> HTML 변환 결과물 ---');
  console.log(convertedHtml);

  // [2단계] 이제 convertedHtml은 확실한 string이므로 안전하게 전달할 수 있습니다.
  const finalResult = sanitizeContent(convertedHtml);

  console.log('\n--- [최종 결과] 정제까지 완료된 안전한 HTML ---');
  console.log(finalResult);
}

// 생성한 async 함수를 실행합니다.
runTest();
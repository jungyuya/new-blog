// test-toc.js
// require 대신 import를 사용하려면 package.json에 "type": "module"을 추가해야 할 수 있습니다.
const { generateToc } = require('./src/utils/toc.ts'); // 경로 확인 필요

const sampleMarkdown = `
# Hello World
Some text here.
## Section 1: Introduction
More text.
### Sub-section 1.1
Even more text.
## Section 2
`;

const toc = generateToc(sampleMarkdown);
console.log(toc);
/* 예상 결과:
[
  { id: 'hello-world', level: 1, text: 'Hello World' },
  { id: 'section-1-introduction', level: 2, text: 'Section 1: Introduction' },
  { id: 'sub-section-11', level: 3, text: 'Sub-section 1.1' },
  { id: 'section-2', level: 2, text: 'Section 2' }
]
*/
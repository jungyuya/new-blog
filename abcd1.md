# Epic 5: 챗봇 완성도 극대화 - Phase 5.2 상세 구현 계획

**목표**: 챗봇의 응답 방식을 '스트리밍(Streaming)'으로 전환하여 체감 속도를 획기적으로 개선하고, '마크다운(Markdown)' 렌더링을 지원하여 코드와 구조화된 텍스트의 가독성을 높인다.

## 1. 백엔드 구현 (`apps/backend`)

### Step 5.2.1: Bedrock 스트리밍 응답 구현
*   **파일**: `src/services/chat.service.ts`
    *   **Action**: 기존 `InvokeModelCommand`를 **`InvokeModelWithResponseStreamCommand`**로 변경합니다.
    *   **로직 변경**:
        *   전체 답변을 한 번에 생성하여 반환(`generateAnswer`)하지 않고, **Async Generator** 함수(`generateAnswerStream`)를 새로 작성합니다.
        *   청크(Chunk) 단위로 생성되는 텍스트를 실시간으로 `yield` 합니다.
        *   출처(Source) 정보는 스트림의 마지막에 별도 이벤트(예: JSON 메타데이터)로 전송하거나, 첫 번째 청크와 함께 HTTP 헤더로 보내는 방식 등을 고려합니다. (여기서는 마지막에 특수 구분자와 함께 보내는 방식 권장)

*   **파일**: `src/routes/chat.router.ts`
    *   **API 변경**: `POST /` 응답을 Hono의 `streamText` 유틸리티를 사용하여 스트리밍 모드로 전환합니다.
    *   **헤더 설정**: `Transfer-Encoding: chunked`, `Content-Type: text/plain` (또는 `text/event-stream`).

---

## 2. 프론트엔드 구현 (`apps/frontend`)
<!--5.2.2의 스트리밍 채팅은 잠정중단-->
~~### Step 5.2.2: 스트리밍 클라이언트 구현 (Stream Reader)
*   **파일**: `src/components/AiChatView.tsx`
    *   **Action**: `handleSendMessage` 함수를 전면 재작성합니다.
    *   **로직**:
        1.  `fetch` 호출 후 `response.body.getReader()`를 획득합니다.
        2.  `while` 루프로 스트림이 끝날 때까지 `read()`를 반복합니다.
        3.  받아온 텍스트 조각을 즉시 `messages` 상태의 마지막 메시지(AI 답변)에 이어 붙입니다 (`setMessages` update).
        4.  스트림 종료 후 전체 답변이 완성됩니다.~~ 

### Step 5.2.3: 마크다운 및 코드 하이라이팅 (Rich Text)
*   **패키지 설치**: `react-markdown`, `remark-gfm`, `react-syntax-highlighter` (또는 `prismjs`).
*   **파일**: `src/components/chat-widget/MessageItem.tsx`
    *   **Action**: 단순 텍스트(`div`)로 렌더링하던 부분을 `<ReactMarkdown>` 컴포넌트로 교체합니다.
    *   **스타일링**:
        *   **Code Block**: `Pre` 태그나 `Code` 태그를 `SyntaxHighlighter` 컴포넌트로 매핑하여 예쁜 색상을 입힙니다.
        *   **Table/List**: 기본 Tailwind 스타일(`.prose`)을 적용하여 리스트와 표가 깨지지 않게 합니다.

---

## 3. 검증 계획 (Verification)

1.  **스트리밍 동작 확인**
    *   질문: "RAG가 뭐야?" (긴 답변 유도)
    *   기대 결과: 답변이 한 번에 팍 뜨는게 아니라, 타자 치듯이 **한 글자씩** 화면에 찍혀야 합니다.
2.  **마크다운 렌더링 확인**
    *   질문: "Python으로 Hello World 출력하는 코드 짜줘"
    *   기대 결과: 
        ```python
        print("Hello World")
        ```
        위와 같이 회색 박스에 코드 하이라이팅이 적용되어 보여야 합니다.
3.  **메타데이터(출처) 유지 확인**
    *   스트리밍 완료 후에도 이전 Phase에서 구현한 **출처(Citations)**가 정상적으로 하단에 표시되는지 확인합니다.

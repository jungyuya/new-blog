# Epic 5: 챗봇 완성도 극대화 - Phase 5.1 상세 구현 계획

**목표**: 챗봇에게 명확한 페르소나를 부여하고, 대화의 맥락을 이해하며, 답변의 출처를 제공하여 신뢰성을 높인다. 또한 추천 질문 기능을 통해 사용자의 초기 진입 장벽을 낮춘다.

## 1. 백엔드 구현 (`apps/backend`)

### Step 5.1.1: 페르소나 및 프롬프트 엔지니어링
*   **파일**: `src/services/chat.service.ts`
*   **작업 내용**:
    *   **System Prompt 적용**: Claude 3 호출 시 `system` 파라미터 또는 프롬프트 상단에 페르소나 정의를 추가합니다.
    *   **페르소나 정의**: "Cloud Engineer JUNGYU". 친절하고 전문적인 '해요체'를 사용하며, 이모지를 적절히 사용하여 딱딱하지 않게 답변합니다.
    *   **메타 인지**: 제공된 Context(`search contexts`)에 없는 내용일 경우 "블로그 내용에는 관련 정보가 없지만, 일반적인 지식으로는..." 형태로 답하거나 모른다고 솔직하게 답변하도록 가이드라인을 설정합니다.

### Step 5.1.2: 대화 맥락 유지 (Context Awareness)
*   **파일**: `src/routes/chat.router.ts`
    *   **API 변경**: `POST /` 요청 body에 `history` 필드(배열)를 추가합니다.
    *   **Schema**: `z.object({ question: z.string(), history: z.array(...) })`
*   **파일**: `src/services/chat.service.ts`
    *   **로직 변경**: `generateAnswer` 함수가 `history`를 인자로 받습니다.
    *   **Bedrock 호출**: `messages` 파라미터 구성 시 `history`의 최근 대화(최대 3턴)를 포함시켜 LLM이 문맥을 파악하게 합니다.

### Step 5.1.3: 출처 표기 (Citation)
*   **파일**: `src/services/chat.service.ts`
    *   **검색 결과 활용**: OpenSearch에서 가져온 Top 3 문서(`hits`)의 `title`, `postId` 정보를 추출합니다.
    *   **응답 구조 변경**: 단순히 텍스트만 반환하던 것에서 객체 반환으로 변경합니다.
        *   변경 전: `string` (답변 텍스트)
        *   변경 후: `{ answer: string, sources: { title: string, url: string }[] }`
    *   URL 생성은 `postId`를 기반으로 프론트엔드 URL 규칙(`https://jungyu.store/posts/{postId}`)을 따릅니다.

---

## 2. 프론트엔드 구현 (`apps/frontend`)

### Step 5.1.4: 챗봇 UI 고도화
*   **파일**: `src/components/AiChatView.tsx`
    *   **대화 기록 관리**: `messages` state를 유지하며, API 호출 시 이전 대화 내용을 함께 전송합니다.
    *   **추천 질문 (Chips)**:
        *   대화가 없는 초기 상태(`messages.length === 1`)일 때, "추천 질문" 버튼들을 표시합니다.
        *   예시: `["기술 스택 알려줘 🛠️", "이 블로그는 뭐야? 🤔", "AWS 비용 절감 팁 💰"]`
        *   버튼 클릭 시 해당 텍스트로 즉시 메시지를 전송합니다.
*   **파일**: `src/components/chat-widget/MessageItem.tsx`
    *   **출처 렌더링**: `message.sources` 데이터가 있을 경우, 말풍선 하단에 "📚 참고 문서" 영역을 표시하고 링크를 렌더링합니다.
    *   링크 클릭 시 새 탭으로 해당 글로 이동합니다.

---

## 3. 검증 계획 (Verification)

1.  **페르소나 테스트**
    *   질문: "누구시죠?"
    *   기대 결과: "안녕하세요! 저는 클라우드 엔지니어 JUNGYU의 AI 어시스턴트입니다..." 형태의 답변.
2.  **맥락(Context) 테스트**
    *   질문 1: "S3 Intelligent-Tiering이 뭐야?" -> 답변 확인.
    *   질문 2: "그거 비용은 비싸?" -> 답변 확인 (앞의 '그거'가 S3 Intelligent-Tiering임을 인지해야 함).
3.  **출처(Citation) 테스트**
    *   질문: "RAG 구축 경험 공유해줘"
    *   기대 결과: 답변과 함께 관련 블로그 포스트 링크가 하단에 표시됨.
4.  **UI 테스트**
    *   채팅창을 처음 열었을 때 추천 질문 버튼이 보이고, 클릭 시 정상 작동하는지 확인.

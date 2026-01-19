
---

### **[최종 실행 계획서] Epic 9: RAG 기반 지능형 블로그 Q&A 시스템**

**목표**: 블로그의 모든 게시글을 학습한 AI 챗봇을 구축하여, 사용자에게 맥락에 맞는 정확한 답변을 제공한다. 단, **월 $1 미만의 비용**을 준수하기 위해 **일일 총량 제한(Global Quota)** 시스템을 적용한다.

**UI 컨셉**: 기존의 우측 하단 플로팅 버튼(FAB)을 그대로 활용하되, 채팅창 내부에서 **[AI 검색]** 탭과 **[관리자 문의]** 탭을 전환하는 하이브리드 UI를 구현한다.

---

#### **Phase 1: 데이터 및 인프라 준비 (Foundation)**

기존 `IndexingLambda`와 `OpenSearch`를 업그레이드하여, RAG의 핵심인 '지식 베이스'를 구축합니다.

*   **Step 1.1: OpenSearch 인덱스 업그레이드**
    *   **Action**: `apps/infra/lib/blog-stack.ts`는 수정 불필요(기존 도메인 사용). 대신, `IndexingLambda`가 처음 실행될 때 OpenSearch 인덱스에 `knn_vector` 필드 매핑(1024차원)이 없으면 자동으로 추가하는 로직을 구현합니다.
*   **Step 1.2: `IndexingLambda` 로직 확장**
    *   **Action**: `apps/backend/src/indexing-handler.ts` 수정.
    *   **내용**:
        1.  `@aws-sdk/client-bedrock-runtime` 설치.
        2.  글 저장 시 본문을 **헤더(#) 단위로 청킹(Chunking)**하는 로직 추가.
        3.  각 청크를 **Titan Embeddings v2** 모델에 보내 벡터화.
        4.  텍스트와 벡터를 OpenSearch에 저장.
*   **Step 1.3: 기존 데이터 마이그레이션**
    *   **Action**: 로컬 스크립트(`scripts/migrate-to-vector.ts`) 작성.
    *   **내용**: DynamoDB의 모든 글을 읽어와서 Step 1.2의 로직을 수행, OpenSearch를 벡터 데이터로 다시 채웁니다. (일회성 실행)

#### **Phase 2: 백엔드 로직 및 방어 시스템 구축 (Backend & Defense)**

비용 방어를 위한 쿼터 시스템과 RAG 검색/생성 로직을 구현합니다.

*   **Step 2.1: 쿼터 관리 API (`GET /api/chat/quota`)**
    *   **Action**: `ChatRouter` 및 `ChatService` 생성.
    *   **내용**: DynamoDB `RATE_LIMIT` 테이블에서 오늘의 `GLOBAL_COUNTER`를 조회하여 남은 횟수(`50 - current`)를 반환합니다.
*   **Step 2.2: 채팅 API (`POST /api/chat`) - 방어 로직**
    *   **내용**:
        1.  DynamoDB `UpdateItem`으로 `GLOBAL_COUNTER`를 +1 증가시킵니다.
        2.  **조건**: `count < 50`. 실패 시 `429 Too Many Requests` 에러 반환.
*   **Step 2.3: 채팅 API - RAG 로직**
    *   **내용**: 방어 로직 통과 시 실행.
        1.  사용자 질문 벡터화 (Titan).
        2.  OpenSearch k-NN 검색 (Top 3 청크 추출).
        3.  프롬프트 구성 ("이 내용을 바탕으로 답해줘...").
        4.  **Claude 3 Haiku** 호출 및 답변 반환. (초기엔 스트리밍 없이 단답형으로 구현하여 복잡도 최소화)

#### **Phase 3: 프론트엔드 UI/UX 구현 (Frontend)**

기존 채팅 위젯을 업그레이드하여 AI와 관리자 문의를 통합합니다.

*   **Step 3.1: `ChatWidget` 컴포넌트 구조화**
    *   **Action**: `apps/frontend/src/components/ChatWidget.tsx` 생성.
    *   **구조**:
        *   **State**: `isOpen` (열림/닫힘), `activeTab` ('ai' | 'human').
        *   **UI**: 우측 하단 고정 버튼. 클릭 시 채팅창 팝업.
*   **Step 3.2: [AI 검색] 탭 구현**
    *   **상단 바**: "⚡ 일일 남은 질문: 32/50" 표시 (API 연동).
    *   **채팅 영역**: 카카오톡 스타일의 말풍선 UI.
    *   **입력창**: 질문 입력 및 전송 버튼.
    *   **동작**: 전송 시 `POST /api/chat` 호출 -> 로딩 스피너 -> 답변 표시 -> 남은 횟수 차감.
*   **Step 3.3: [관리자 문의] 탭 구현**
    *   **내용**: 기존에 사용하던 GCP 채팅 서비스 URL을 `<iframe>`으로 로드.
    *   **장점**: 기존 서비스를 그대로 유지하면서도, AI 기능만 매끄럽게 추가.

#### **Phase 4: 배포 및 검증 (Deployment)**

*   **Step 4.1: IAM 권한 설정**
    *   **Action**: `blog-stack.ts` 수정.
    *   **내용**: `BackendApiLambda`에게 `bedrock:InvokeModel` 및 `es:ESHttp*` 권한 부여.
*   **Step 4.2: 배포 및 테스트**
    *   전체 배포 후 마이그레이션 스크립트 실행.
    *   실제 질문 테스트: "블로그 주제가 뭐야?", "콜드 스타트 해결법은?" 등의 질문에 블로그 내용을 인용하여 답하는지 확인.
    *   쿼터 테스트: 50회 초과 시 차단되는지 확인.

---

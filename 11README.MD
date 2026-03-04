# Cloud Infrastructure Engineer & Architect Portfolio

> **"비즈니스 가치를 창출하는 적정 기술(Right-sizing)과 운영 비용 최적화(FinOps)를 추구합니다."**

단순히 최신 기술을 나열하는 것을 넘어, 서비스 규모와 비즈니스 요구사항에 맞춘 **아키텍처 설계, 비용 최적화, 역량 있는 트러블슈팅, 자동화 파이프라인 구축**에 강점을 가진 클라우드 엔지니어입니다. 총 4개의 실전 프로젝트를 통해 퍼블릭 클라우드(AWS, GCP, Tencent) 도입부터 CI/CD 구축, 비동기 이벤트 환경, 자체 모니터링 시스템까지 클라우드 네이티브 애플리케이션의 전 과정을 직접 설계하고 운영하고 있습니다.

---

## 🚀 Core Competencies (핵심 역량)

### 1. Cloud Architecture & FinOps (운영 비용 최적화)
무조건 복잡한 시스템을 도입하기보다, 트래픽 한계와 비용을 선제적으로 계산하여 **가장 효율적인 아키텍처 다이어트(Architecture Diet)**를 감행합니다.
- **Cost Zero Architecture**: GKE 기반 MSA 환경을 유지 비용 문제(Cluster Management Fee 등)로 인해 단일 VM 내 Docker Compose 환경으로 마이그레이션. 서비스 실시간성은 100% 유지하며 **월 고정 비용을 10만원대에서 $0로 최적화**했습니다.
- **Serverless & Free-tier Strategy**: AWS Lambda, API Gateway, DynamoDB를 조합한 완전 관리형 서버리스 아키텍처와 t4g.small(ARM64) 기반의 Self-hosted Runner 구성으로 상시 구동 인프라 위주의 지출을 원천에 방어했습니다.

### 2. Event-Driven & Async Processing (비동기 파이프라인)
트래픽이 급증하거나 외부 API(AI 등) 지연이 발생해도, 메인 서비스 응답 속도에 영향을 주지 않는 결합도 낮은 아키텍처를 설계합니다.
- **AI 비동기 파이프라인**: AWS Lambda, DynamoDB Stream, SQS/SNS, EventBridge를 이용하여 백그라운드에서 AI 요약(Bedrock)과 음성 합성(Polly), 오픈서치(OpenSearch) 실시간 동기화를 구축했습니다.
- **Resiliency(회복 탄력성)**: SQS Dead-Letter Queue(DLQ)를 활용해 이벤트 처리 실패 시 데이터 유실을 방지하고 재처리 로직을 설계하여 안정성을 높였습니다.

### 3. 멀티 클라우드 하이브리드 연동 (Multi-Cloud Integration)
특정 벤더에 종속되지 않는 벤더 유연성(Vendor-Agnostic)을 고려하여 각 서비스의 강점을 조립합니다.
- **Service Mesh Strategy**: 글로벌 캐싱이 우수한 Tencent Cloud(EdgeOne, COS)를 프론트 인프라로, 강력한 생성형 AI 성능을 가진 GCP(Vision, Gemini)를 코어로, 안정적인 인증과 데이터베이스 관리를 위한 Supabase를 백엔드로 결합하여 단일 서비스(QuizDive)에 녹여냈습니다. 

### 4. DevSecOps & IaC (인프라 자동화 및 보안)
팀 프로젝트 및 확장성을 고려하여 수동 작업을 최소화하고 보안의 기본기를 탄탄하게 다졌습니다.
- **보안 중심 배포**: AWS OIDC를 연동하여 Access Key 하드코딩 위협을 제거. Husky의 pre-commit 훅과 GitGuardian을 연동해 시크릿(API Key 등)의 커밋/퍼블리시를 원천 차단했습니다.
- **형상 관리(IaC)**: AWS CDK와 Terraform 커스텀 모듈을 작성하여, 서비스 인프라를 코드화하고 리전 이동이나 재난 복구(DR) 시 10분 내 인프라를 복원할 수 있게 구현했습니다.

---

## 📂 Projects Overview & Deep Dive

> 단순 요약이 아닌, **"어떤 문제를 어떻게 해결했는가"**를 보여주는 핵심 포트폴리오입니다.

### 1. Deep Dive! Blog (지능형 서버리스 블로그)
> **비용 $0로 무한 확장이 가능한 비동기 이벤트 기반(Event-Driven) 블로그 플랫폼**
- **Architecture**: Next.js(Frontend) + Hono(Backend) + AWS (Lambda, DynamoDB) + CloudFront
- **Problem & Solution**:
  - **문제**: 초기 람다(Lambda) 컨테이너 기동 시 TTFB(Time to First Byte)가 4초 이상 지연되는 콜드 스타트 이슈 발생.
  - **해결**: AWS X-Ray 분산 추적으로 병목을 측정한 뒤, Docker Multi-stage 배포(260MB 경량화)와 EventBridge Scheduler의 Keep-Warm 핑(ping) 전략으로 **초기 진입 속도를 2초 이내로 50% 단축**했습니다.
  - **이벤트 패턴**: Presigned URL 직접 업로드(Direct Upload) 및 Lambda Layer를 활용한 미디어 리사이징 비동기 파이프라인을 구축해 트래픽 병목을 제거했습니다.

### 2. Deep Dive! RAG (맥락 인식 AI 챗봇)
> **단순 키워드 검색을 넘어, DynamoDB Stream과 OpenSearch를 결합한 실시간 RAG 챗봇**
- **Architecture**: Amazon OpenSearch + Amazon Bedrock (Claude 3) + AWS Lambda
- **Problem & Solution**:
  - **문제**: 답변 생성형 AI가 블로그 내용과 무관한 환각(Hallucination) 현상을 일으킴. 권한 문제(Access Denied)로 IAM 연결 장애.
  - **해결**: OpenSearch의 검색 결과 Vector 유사도(Score)가 낮을 경우 답변 생성을 중단하는 방어 로직 추가. CDK에서 특정 모델 리소스에만 `bedrock:InvokeModel` 최소 권한 원칙을 부여해 트러블슈팅 완료.
  - **비용 방어**: 일일 50회 쿼터 제한(DynamoDB Atomic Counter 기반)으로 $1 초과 과금을 원천 차단했습니다.

### 3. QuizDive (AI 플래시카드 생성 앱)
> **Tencent Cloud, GCP, Supabase를 결합하여 만든 Hybrid Multi-Cloud 기반 Serverless PWA**
- **Architecture**: Tencent EdgeOne Pages + GCP Vision/Gemini + Supabase + IndexedDB
- **Problem & Solution**:
  - **문제**: 5MB 고해상도 이미지 업로드 시 EdgeOne 서버리스 타임아웃(30초) 발생 및 504 Gateway Timeout.
  - **해결**: 클라이언트 Canvas API를 이용해 최대 1280px로 리사이징(용량 95% 감소) 후 Base64 형태로 GCP Vision API를 직접 통신하는 파이프라인으로 전환, **처리 시간을 45초에서 8초 이내로 단축**했습니다.
  - **문제**: 서버리스 특성상 Prometheus Pull 형태의 모니터링 수집 불가.
  - **해결**: Supabase 로그 API 수집 및 PostgreSQL 내부 RPC 집계 함수와 Recharts를 연동하여 **추가 비용 $0의 Push 기반 로그 모니터링 파이프라인을 자체 구축**했습니다.

### 4. Realtime Chat 서비스 (Legacy)
> **GKE MSA 아키텍처에서 단일 VM 환경으로 마이그레이션하여 운영 비용 $0 달성**
- **Architecture**: Go (Goroutine), PostgreSQL, Docker Compose, Nginx Reverse Proxy
- **Problem & Solution**:
  - **문제**: 개인 프로젝트 규모(Traffic) 대비 GKE 클러스터 유지비용(월 약 10만원) 과다 지출.
  - **해결**: 과감한 아키텍처 다이어트 감행. K8s Manifest를 Docker Compose 기반 단일 VM 파이프라인으로 전환하여 성능 저하 없이 **클라우드 고정비 100% 절감($0)**.
  - **트러블슈팅**: CI/CD 파이프라인에서 컨테이너 DNS IP 업데이트 누락으로 502 Bad Gateway 발생 해결, Node.js 대비 메모리 점유율을 대폭 낮추기 위해 **Golang Goroutine**을 활용한 커스텀 메세지 브로커 구현.

---

## 💡 Engineering Philosophy & Next Steps

저는 시스템의 기술적인 복잡도보다, 그 시스템이 해결하고자 하는 **비즈니스 문제**와 유지되는 **운영 비용**에 집중합니다. 오버엔지니어링을 철저히 경계하며, 특정 벤더에 종속되지 않는 유연하고 단단한 아키텍처 구축을 최우선 가치로 둡니다.

> *"이 포트폴리오의 각 프로젝트들은 대규모 인프라 운영, 엔터프라이즈 레벨의 폭발적인 트래픽, 그리고 잠재적 장애 상황을 예상하며 **예산($0~$1)이라는 강한 제약 환경**에서 한계를 테스트한 실전 샌드박스입니다. 이러한 깊은 고민의 흔적들은 인프라 장애를 극복하고 비용(FinOps)을 최적화해야 하는 현업의 문제 해결에 즉시 기여할 수 있는 강력한 무기입니다."*

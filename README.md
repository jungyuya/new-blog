# new-blog

AWS 서버리스 아키텍처 기반의 개인 블로그 플랫폼입니다. Infrastructure as Code(IaC), 불변 배포 전략, 모니터링 통합 등 프로덕션 수준의 DevOps 관행을 적용했습니다.

**데모**: https://blog.jungyu.store

---

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [DevOps 및 인프라 특징](#devops-및-인프라-특징)
- [프로젝트 구조](#프로젝트-구조)
- [로컬 개발 환경 구성](#로컬-개발-환경-구성)
- [배포 과정](#배포-과정)
- [주요 구현 사항](#주요-구현-사항)

---

## 프로젝트 개요

이 프로젝트는 단순한 블로그 애플리케이션을 넘어, 클라우드 네이티브 환경에서 안정적이고 확장 가능한 서비스를 구축하고 운영하는 과정을 담고 있습니다. 특히 다음 사항에 중점을 두었습니다:

- **완전한 Infrastructure as Code**: AWS CDK를 사용하여 전체 인프라를 코드로 정의하고 버전 관리합니다.
- **자동화된 CI/CD 파이프라인**: GitHub Actions를 통해 빌드, 테스트, 배포, 검증까지 전 과정을 자동화했습니다.
- **서버리스 우선 설계**: 관리 오버헤드를 최소화하고 비용 효율성을 극대화하는 서버리스 아키텍처를 채택했습니다.
- **관측성(Observability)**: AWS X-Ray와 Sentry를 통합하여 실시간 트레이싱 및 에러 추적이 가능합니다.

---

## 아키텍처

<!-- 
전체 아키텍처 삽입 예정.
-->

### 주요 컴포넌트

**Frontend**
- Next.js 16 기반 SSR 애플리케이션
- CloudFront + Lambda@Edge를 통한 글로벌 배포
- S3에서 정적 자산 제공

**Backend**
- Hono 프레임워크 기반 REST API
- AWS Lambda (Node.js 20, ARM64)
- API Gateway 또는 Lambda Function URL

**데이터 레이어**
- DynamoDB: 게시글, 사용자, 댓글 저장
- OpenSearch: 전문 검색(Full-text search) 엔진
- S3: 이미지 및 미디어 저장

**인증 및 권한**
- AWS Cognito User Pool
- JWT 기반 인증

**이미지 처리**
- Lambda 함수 (Sharp 라이브러리)
- S3 이벤트 트리거 기반 자동 리사이징

**모니터링 및 추적**
- AWS X-Ray: 분산 트레이싱
- Sentry: 에러 추적 및 알림
- CloudWatch Logs 및 Metrics

---

## 기술 스택

### 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.0.10 | 서버 사이드 렌더링 프레임워크 |
| React | 19.2.3 | UI 라이브러리 |
| TypeScript | 5.5.4 | 정적 타입 검사 |
| Tailwind CSS | 4.0 | 유틸리티 우선 CSS 프레임워크 |
| Framer Motion | 12.x | 애니메이션 라이브러리 |
| SWR | 2.3.6 | 데이터 페칭 및 캐싱 |

### 백엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Hono | 4.8.12 | 경량 웹 프레임워크 |
| Zod | 4.0.14 | 스키마 유효성 검증 |
| AWS SDK v3 | 3.x | AWS 서비스 통합 |
| Vitest | 3.2.4 | 테스트 프레임워크 |
| esbuild | 0.21+ | 번들러 |

### 인프라
| 기술 | 버전 | 용도 |
|------|------|------|
| AWS CDK | 2.215+ | Infrastructure as Code |
| Node.js | 22.x | 런타임 |
| pnpm | 10.14.0 | 패키지 매니저 |
| Turborepo | 2.5.5 | 모노레포 빌드 시스템 |
| Docker | - | 컨테이너화 (Frontend) |

### AWS 서비스
- **Compute**: Lambda, Lambda@Edge
- **Storage**: S3, DynamoDB
- **Search**: OpenSearch Service
- **Network**: CloudFront, Route53, ACM
- **Security**: Cognito, WAF, IAM
- **Messaging**: SQS, EventBridge
- **Monitoring**: CloudWatch, X-Ray

---

## DevOps 및 인프라 특징

이 프로젝트에서 구현한 주요 DevOps 패턴과 인프라 관행입니다.

### 1. Infrastructure as Code (IaC)

**AWS CDK를 사용한 전체 인프라 정의**

```typescript
// apps/infra/lib/blog-stack.ts (844줄)
// DynamoDB, Lambda, CloudFront, OpenSearch 등 모든 리소스를 코드로 정의
```

- 인프라 변경 사항을 코드 리뷰를 통해 검증
- Git을 통한 인프라 버전 관리
- 재현 가능한 환경 구성

### 2. 불변 배포(Immutable Deployment)

배포마다 고유한 Release ID를 생성하여 정적 자산을 분리합니다.

```yaml
RELEASE_ID="$(date +%Y%m%d%H%M%S)-${GITHUB_SHA::7}"
# 예: 20260116085932-abc1234
```

**장점:**
- 배포 중에도 기존 사용자는 이전 버전의 자산을 계속 사용
- 롤백 시 즉시 이전 버전으로 전환 가능
- 캐시 무효화 문제 해결

### 3. CI/CD 파이프라인

**GitHub Actions 기반 완전 자동화된 배포 파이프라인**

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│ Code Push   │───▶│  Build       │───▶│  Deploy      │───▶│  Verify     │
│ to main     │    │  & Test      │    │  to AWS      │    │  & Monitor  │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
```

**파이프라인 주요 단계:**

1. **변경 감지**: 변경된 앱만 선택적으로 배포 (Turbo 활용)
2. **빌드**: Frontend와 Backend를 병렬 빌드
3. **ECR 이미지 푸시**: Docker 이미지 빌드 및 Amazon ECR 업로드
4. **CDK 배포**: 인프라 변경 사항 자동 적용
5. **정적 자산 동기화**: S3에 버전별 정적 파일 업로드
6. **캐시 무효화**: CloudFront 캐시 갱신
7. **Smoke Test**: 배포 직후 자동 검증
   - HTTP 200 응답 확인
   - 버전별 정적 자산 접근성 검증

### 4. OIDC 기반 AWS 인증

GitHub Actions에서 AWS 자격 증명을 직접 저장하지 않고, OIDC(OpenID Connect)를 통해 임시 토큰을 발급받습니다.

```yaml
- name: Configure AWS Credentials via OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
    aws-region: ap-northeast-2
```

**보안 이점:**
- Access Key/Secret Key를 GitHub Secrets에 저장하지 않음
- 토큰 유효 기간이 제한적 (15분~1시간)
- IAM 역할 기반 세밀한 권한 제어

### 5. 멀티스테이지 Docker 빌드

Frontend 이미지를 최적화하기 위해 멀티스테이지 빌드를 사용합니다.

```dockerfile
# Stage 1: Pruning - 프로덕션 의존성만 추출
FROM node:22-alpine AS pruner
RUN pnpm deploy --filter=frontend... --prod /app/prod_deps --legacy

# Stage 2: Runner - 실행 이미지
FROM node:22-alpine AS runner
COPY --from=pruner /app/prod_deps/node_modules ./node_modules
```

**효과:**
- 최종 이미지 크기 최소화
- 불필요한 devDependencies 제외
- 빌드 속도 향상 (캐시 레이어 활용)

### 6. 모니터링 및 관측성

**AWS X-Ray 통합**
```typescript
// Backend에서 모든 요청을 자동으로 트레이싱
AWSXRay.capturePromise();
app.use('*', async (c, next) => {
  const segment = new AWSXRay.Segment('BackendHonoApp');
  // 요청/응답 메타데이터 자동 수집
});
```

**Sentry 에러 추적**
- Frontend/Backend 모두 Sentry SDK 통합
- 소스맵 자동 업로드로 프로덕션 에러 디버깅 가능
- Release 버전별 에러 추적

### 7. 테스트 전략

**Backend: Unit + Integration 테스트**
```bash
# Vitest 기반 테스트
pnpm --filter backend test
```

- 라우터별 테스트 파일 (5개)
- Supertest를 사용한 HTTP 엔드포인트 테스트
- 테스트 환경 격리 (setup.ts)

---

## 프로젝트 구조

이 프로젝트는 Turborepo 기반 모노레포로 구성되어 있습니다.

```
new-blog/
├── apps/
│   ├── frontend/              # Next.js 애플리케이션
│   │   ├── src/
│   │   │   ├── app/           # Next.js 13+ App Router
│   │   │   ├── components/    # 재사용 가능한 UI 컴포넌트 (43개)
│   │   │   ├── hooks/         # 커스텀 React Hooks
│   │   │   ├── contexts/      # React Context (Auth, Theme 등)
│   │   │   └── utils/         # 유틸리티 함수
│   │   ├── Dockerfile         # 프로덕션 이미지 빌드 설정
│   │   └── package.json
│   │
│   ├── backend/               # Hono API 서버
│   │   ├── src/
│   │   │   ├── routes/        # API 라우트 (7개: posts, auth, users, tags, images, config, comments)
│   │   │   ├── services/      # 비즈니스 로직 레이어
│   │   │   ├── repositories/  # 데이터 접근 레이어 (DynamoDB, OpenSearch)
│   │   │   ├── middlewares/   # 인증, 에러 처리 등
│   │   │   └── lib/           # 공통 유틸리티 및 타입 정의
│   │   ├── __tests__/         # Vitest 테스트 파일
│   │   └── package.json
│   │
│   ├── image-processor/       # 이미지 리사이징 Lambda
│   │   ├── src/
│   │   │   └── index.ts       # Sharp 기반 이미지 처리
│   │   └── package.json
│   │
│   └── infra/                 # AWS CDK 인프라 정의
│       ├── lib/
│       │   ├── blog-stack.ts          # 메인 애플리케이션 스택 (844줄)
│       │   ├── cicd-stack.ts          # CI/CD 인프라 스택
│       │   └── image-processor.stack.ts
│       ├── bin/
│       │   └── infra.ts       # CDK 앱 진입점
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── deploy.yml         # 통합 배포 워크플로우 (295줄)
│       └── build-and-verify.yml
│
├── scripts/                   # 유틸리티 스크립트
│   ├── setup_runner.sh        # Self-hosted runner 설정
│   └── migrate-to-opensearch.ts
│
├── turbo.json                 # Turborepo 빌드 설정
├── pnpm-workspace.yaml        # pnpm 워크스페이스 정의
└── package.json               # 루트 패키지 설정
```

### 앱별 역할

| 앱 | 설명 | 주요 의존성 |
|----|------|------------|
| **frontend** | SSR 블로그 UI | Next.js, React, Tailwind, SWR |
| **backend** | REST API 서버 | Hono, AWS SDK, Zod, @opensearch-project/opensearch |
| **image-processor** | 이미지 최적화 | Sharp, AWS SDK (S3) |
| **infra** | IaC 정의 | AWS CDK, Constructs |

---

## 로컬 개발 환경 구성

### 사전 요구 사항

- Node.js 22.x (`.nvmrc` 참고)
- pnpm 10.14.0 이상
- Docker Desktop (프론트엔드 컨테이너 테스트용)

---

## 배포 과정

배포는 GitHub Actions를 통해 완전히 자동화되어 있습니다.

### 자동 배포 트리거

`main` 브랜치에 푸시하면 자동으로 배포가 시작됩니다:

```bash
git push origin main
```

### 배포 워크플로우 상세

`.github/workflows/deploy.yml` 파일은 다음 단계를 수행합니다:

**1. 변경 감지 (Detect Changes)**
```yaml
- Frontend/Backend 코드 변경 감지
- 인프라 코드 변경 감지
- 변경된 부분만 선택적으로 배포
```

**2. 빌드 (Build)**
```yaml
- Release ID 생성: YYYYMMDDHHmmss-[git-sha]
- pnpm install (캐싱 활용)
- Frontend/Backend 빌드
- Sharp Lambda Layer 빌드
```

**3. 컨테이너 이미지 (Container Build)**
```yaml
- Docker 멀티스테이지 빌드
- ARM64 아키텍처로 빌드
- Amazon ECR에 푸시
```

**4. 인프라 배포 (Infrastructure Deploy)**
```yaml
- AWS CDK를 사용하여 스택 배포
- Lambda 함수 업데이트 (새 ECR 이미지 태그)
- DynamoDB, OpenSearch 등 리소스 업데이트
```

**5. 정적 자산 배포 (Static Assets Deploy)**
```yaml
- S3에 .next/static 폴더 업로드
- 버전별 경로로 업로드: /{RELEASE_ID}/_next/static/
```

**6. 캐시 무효화 (Cache Invalidation)**
```yaml
- CloudFront 캐시 무효화 (/* 경로)
```

**7. 검증 (Verification)**
```yaml
- Smoke Test 실행
  - 홈페이지 HTTP 200 확인
  - 버전별 정적 자산 접근 확인
- 실패 시 배포 중단 및 알림
```

### 수동 배포

CDK를 직접 사용하여 수동 배포도 가능합니다:

```bash
# 인프라 변경 사항만 배포
cd apps/infra
pnpm exec cdk deploy BlogInfraStack

# 특정 이미지 태그로 배포
pnpm exec cdk deploy BlogInfraStack --parameters ImageTag=20260116-abc1234
```

---

## 주요 구현 사항

### 1. 서버리스 아키텍처 설계

**Lambda + DynamoDB 조합으로 완전한 서버리스 구현**

- **비용 효율성**: 요청이 없을 때는 과금되지 않음
- **자동 확장**: 트래픽 증가 시 Lambda가 자동으로 스케일 아웃
- **관리 부담 없음**: 서버 패치, 업데이트 불필요

**ARM64 아키텍처 채택**
```typescript
// apps/infra/lib/blog-stack.ts
const backendFunction = new lambda.Function(this, 'BackendFunction', {
  architecture: lambda.Architecture.ARM_64, // Graviton2 프로세서
  // x86 대비 20% 가격 절감, 최대 34% 성능 향상
});
```

### 2. 검색 기능 구현

**OpenSearch Service를 사용한 전문 검색**

```typescript
// 게시글 인덱싱 (DynamoDB Stream → Lambda → OpenSearch)
// 한글 형태소 분석기(nori) 적용
```

- DynamoDB에 게시글 저장 시 자동으로 OpenSearch에 인덱싱
- 제목, 본문, 태그에 대한 통합 검색
- 검색어 하이라이팅 지원

### 3. 이미지 최적화 파이프라인

**S3 이벤트 트리거 기반 자동 이미지 처리**

```
Upload Image (S3) → Trigger Lambda → Sharp 리사이징 → Save Optimized Image
```

- 원본 이미지는 `originals/` 폴더에 저장
- 자동으로 여러 해상도 생성 (썸네일, 중간, 원본)
- WebP 포맷 변환으로 용량 최적화

### 4. 인증 시스템

**AWS Cognito + JWT 검증**

```typescript
// Backend: JWT 토큰 검증 미들웨어
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.CLIENT_ID,
});
```

- Cognito User Pool로 회원가입/로그인 관리
- JWT 토큰 기반 stateless 인증
- 미들웨어를 통한 보호된 라우트 구현

### 5. 모노레포 관리 전략

**Turborepo를 통한 효율적인 빌드**

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    }
  }
}
```

- 변경된 앱만 선택적으로 빌드
- 의존성 그래프 자동 해석
- 빌드 결과 캐싱으로 시간 절약

### 6. 보안 강화

**다층 보안 적용**

- **WAF**: CloudFront 앞단에 Web Application Firewall 배치
  - SQL Injection, XSS 공격 차단
  - Rate Limiting으로 DDoS 방어
  
- **CORS 정책**: Backend에서 허용된 오리진만 접근 가능
  ```typescript
  app.use('*', cors({
    origin: ['https://blog.jungyu.store'],
    credentials: true,
  }));
  ```

- **입력 검증**: Zod 스키마로 모든 API 입력 검증
  ```typescript
  const postSchema = z.object({
    title: z.string().min(1).max(100),
    content: z.string().min(1),
  });
  ```

---


---

## 문의

프로젝트에 대한 질문이나 제안 사항이 있다면 언제든 이메일 : jungyuya@gmail.com 으로 연락 주세요.
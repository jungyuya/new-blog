# Deep Dive! Serverless Blog Platform
> **"월 유지비 $1 미만, 완전 자동화된 AWS Serverless 기반의 지능형 블로그 플랫폼"**

[![CI/CD Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square&logo=github-actions)](https://github.com/jungyuya/new-blog/actions)
[![Infrastructure](https://img.shields.io/badge/AWS%20CDK-v2-orange?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/cdk/)
[![Frontend](https://img.shields.io/badge/Next.js-v16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Hono-v4-E36002?style=flat-square&logo=hono)](https://hono.dev/)

---

## 🚀 프로젝트 소개
본 프로젝트는 현대적인 클라우드 네이티브 환경에서의 **DevOps 철학(IaC, CI/CD, Observability)**을 완벽하게 구현한 엔지니어링 포트폴리오입니다. 단순한 블로그 기능을 넘어, **비용 최적화(FinOps)**와 **운영 자동화(Ops)**에 초점을 맞춘 프로덕션 레벨의 아키텍처를 제시합니다.

- **URL**: [https://blog.jungyu.store](https://blog.jungyu.store)
- **Repo**: [https://github.com/jungyuya/new-blog](https://github.com/jungyuya/new-blog)

---

## 🏗️ 아키텍처 & 핵심 설계

<!-- 
[아키텍처 다이어그램 삽입 위치]
*./arch.html의 스크린샷 또는 다이어그램 이미지를 여기에 넣어주세요*
-->

### 핵심 아키텍처 포인트
1. **완전 관리형 서버리스 (NoOps)**
   - EC2 없는 아키텍처: Lambda, DynamoDB, S3, CloudFront 조합으로 관리 포인트 최소화.
   - **비용 효율**: 트래픽이 0이면 비용도 0원인 'Zero-Base' 아키텍처 구현.
   
2. **이벤트 기반 아키텍처 (EDA)**
   - 사용자 경험을 해치지 않는 비동기 처리: `Lambda -> EventBridge -> SQS -> Lambda` 파이프라인.
   - 이미지 리사이징 및 AI 처리가 백그라운드에서 수행됨.

3. **계층형 모노레포 구조**
   - Frontend(Next.js), Backend(Hono), Infra(CDK)를 Turborepo로 통합 관리.
   - 의존성 격리와 빌드 캐싱을 통한 개발 생산성 향상.

---

## 💡 기술적 챌린지 & 해결 과정 (Troubleshooting)

### 1. Lambda Cold Start 최적화 (성능)
- **문제**: 초기 페이지 진입 시 TTFB(Time to First Byte)가 4초 이상 소요됨.
- **분석**: AWS X-Ray 트레이싱 결과, Docker 컨테이너 로딩 및 초기화가 병목임을 식별.
- **해결**: 
    - **Multi-stage Build**: 러너 이미지 크기를 최적화.
    - **Keep-Warm 전략**: EventBridge Scheduler로 핵심 람다를 주기적으로 핑(Ping)하여 Warm 상태 유지.
- **결과**: Cold Start 빈도 90% 감소, 초기 로딩 **3.8초 → 2초 미만** 단축.

### 2. 비용 제로에 도전하는 FinOps (비용)
- **문제**: 사이드 프로젝트 특성상 고정 비용 최소화 필요.
- **접근**:
    - **Compute**: x86 대비 20% 저렴한 **AWS Graviton(ARM64)** 프로세서 전면 도입.
    - **CI/CD**: GitHub Actions 유료 러너 대신, 프리티어가 적용되는 `t4g.small`에 **Self-hosted Runner** 구축.
    - **Storage**: S3 수명 주기 정책 및 이미지 **WebP 변환**으로 스토리지/전송 비용 70% 절감.
- **결과**: 도메인 비용을 제외한 순수 인프라 비용 **$0 유지 달성**.

### 3. 보안 사고를 원천 차단하는 CI/CD (보안)
- **문제**: 장기 Access Key 사용에 따른 키 유출 보안 위협.
- **해결**: **OIDC(OpenID Connect)** 기반 인증 도입.
    - GitHub Actions가 AWS로부터 임시 토큰(STS)을 발급받아 배포 수행.
    - 하드코딩된 자격 증명(Secrets) 제거.

---

## 🛠️ 기술 스택

| 영역 | 기술 스택 | 선정 이유 |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 16**, React 19, TypeScript | App Router 기반의 최신 렌더링 패턴 및 SEO 최적화 |
| **Backend** | **Hono**, Zod, AWS SDK v3 | Express 대비 5배 가벼운 초경량 프레임워크로 Lambda 성능 극대화 |
| **Infra (IaC)** | **AWS CDK** (TypeScript) | 인프라를 프로그래밍 언어로 정의하여 버전 관리 및 재사용성 확보 |
| **Database** | **DynamoDB**, OpenSearch | Single Table Design으로 NoSQL 성능 극대화 및 전문 검색 지원 |
| **DevOps** | **GitHub Actions**, Docker | 불변 배포(Immutable Deployment) 및 자동화된 검증 파이프라인 |
| **Monitoring** | **AWS X-Ray**, Sentry | 분산 트레이싱을 통한 병목 구간 시각화 및 실시간 에러 추적 |

---

## 🚦 배포 파이프라인 (CI/CD)

**"인프라부터 앱까지, Git Push 한 번으로 끝나는 배포"**

```mermaid
graph LR
    Push[Code Push] --> Detect{변경 감지}
    Detect -->|Frontend| BuildApp[Build & Dockerize]
    Detect -->|Infra| BuildInfra[CDK Synth]
    BuildApp --> Deploy[AWS CDK Deploy]
    BuildInfra --> Deploy
    Deploy --> Assets[Static Assets Sync]
    Assets --> Smoke[Smoke Test (검증)]
```

1. **빌드 & 패키징**: `turbo`를 통해 변경된 패키지만 빌드, Docker Multi-stage 빌드로 경량 이미지 생성.
2. **보안 인증**: OIDC를 통해 안전하게 AWS 권한 획득.
3. **불변 배포**: 고유 Release ID를 기반으로 정적 자산 격리 배포 (`/_next/static/RELEASE_ID/...`).
4. **자동 검증 (Smoke Test)**: 배포 직후 HTTP 상태 및 자산 접근성을 `curl`로 자동 검증하여 '성공했지만 접속 안 되는' 사태 방지.

---

## 📂 프로젝트 구조

```
new-blog/
├── apps/
│   ├── frontend/        # Next.js 16 (App Router)
│   ├── backend/         # Hono API (Lambda)
│   ├── image-processor/ # Sharp 이미지 처리 (Lambda)
│   └── infra/           # AWS CDK 코드 (IaC)
├── packages/            # 공통 라이브러리 (Shared)
├── .github/workflows/   # CI/CD 파이프라인 정의
└── turbo.json           # 모노레포 빌드 설정
```

---

## 🏃‍♂️ 로컬 실행 가이드

1. **설치**
   ```bash
   pnpm install
   ```

2. **환경 변수 설정**
   `apps/frontend/.env.local`, `apps/backend/.env` 파일 생성 (예제 참고)

3. **개발 서버 실행**
   ```bash
   pnpm run dev
   # Frontend: http://localhost:3000
   # Backend: http://localhost:4000
   ```

4. **테스트 실행**
   ```bash
   pnpm --filter backend test
   ```

---

## 📬 Contact
- **Email**: jungyuya@gmail.com
- **Issues**: [GitHub Issues](https://github.com/jungyuya/new-blog/issues)

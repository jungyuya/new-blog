# 파일 위치: apps/frontend/Dockerfile
# 최종 수정일: 2025년 8월 6일 (궁극의 최종 완결본 - v3)
# 역할: pnpm 모노레포 환경에 최적화된 다단계 빌드(Multi-stage Build) 레시피

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계
# ===================================================================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.14.0

# 프로젝트의 기본 설정 파일들을 먼저 복사하여 Docker 캐시를 활용합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# 'apps' 디렉토리는 항상 존재하므로 직접 복사합니다.
COPY --link apps ./apps

# [핵심 1차 수정] '|| true'를 제거하고, 조건부 복사를 위해 RUN 명령어로 대체합니다.
# 'packages' 디렉토리가 빌드 컨텍스트에 존재할 경우에만 복사를 수행합니다.
RUN if [ -d "packages" ]; then cp -a packages . ; fi

# pnpm install을 실행하여 frontend와 관련된 모든 의존성을 설치합니다.
RUN pnpm install --frozen-lockfile --filter=frontend...

# frontend 애플리케이션을 빌드합니다.
RUN pnpm --filter frontend run build

# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계
# ===================================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# 환경 변수를 설정합니다.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# Builder 스테이지에서 생성된 실행에 필요한 파일들만 복사합니다.
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# [핵심 2차 수정] '-arm64' 접미사를 제거한, 멀티-아키텍처를 지원하는 공식 태그를 사용합니다.
# Docker buildx가 --platform 옵션에 맞춰 올바른 아키텍처를 자동으로 선택합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# 서버를 시작하는 최종 명령어를 정의합니다.
CMD ["node", "server.js"]
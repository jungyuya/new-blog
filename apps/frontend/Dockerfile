# 파일 위치: apps/frontend/Dockerfile
# 최종 수정일: 2025년 8월 6일 (공식 문서 기반 Web Adapter 경로 수정)
# 역할: pnpm 모노레포 환경에 최적화된 다단계 빌드(Multi-stage Build) 레시피

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계 (변경 없음)
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.14.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter=frontend...
RUN pnpm --filter frontend run build

# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (최종 수정)
# ===================================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# [핵심 최종 수정] '진실의 원천(Source of Truth)'인 공식 GitHub 저장소에서 확인한,
# 검증된 ECR Public 이미지 주소를 사용합니다.
# 태그로 'latest'를 사용하면, Docker가 빌드 환경(linux/arm64)에 맞는
# 아키텍처 이미지를 자동으로 가져옵니다.
COPY --from=public.ecr.aws/aws-lambda-adapter/adapter:latest /opt/extensions/ /opt/extensions/

CMD ["node", "server.js"]
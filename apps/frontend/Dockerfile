# 파일 위치: apps/frontend/Dockerfile
# 버전: v3.0.0 (The Masterpiece)
# 역할: 빌드 타임 정규화, 멱등성 보장, 디버깅 편의성까지 모두 갖춘 최종 결정판

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.14.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY --link apps ./apps
RUN if [ -d "packages" ]; then cp -a packages . ; fi
RUN pnpm install --frozen-lockfile --filter=frontend...
RUN pnpm --filter frontend run build


# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계
# ===================================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [마스터피스 개선 1] 멱등성 보장: 'ln -sf'를 사용하여 심볼릭 링크를 안전하게 덮어씁니다.
# [마스터피스 개선 2] 디버깅 편의성: 실패 시 'ls' 명령으로 현재 상태를 출력합니다.
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && ech
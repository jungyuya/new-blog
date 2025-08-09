# 파일 위치: apps/frontend/Dockerfile
# 최종 수정일: 2025년 8월 7일 (정확한 경로 설정 최종본)

# ... Stage 1은 변경 없습니다 ...
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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (최종 완성본)
# ===================================================================================
FROM node:22-alpine AS runner

# [핵심 1] 작업 디렉토리를 /app으로 단순화하여 예측 가능성을 높입니다.
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# [핵심 2] standalone 폴더 '자체'를 /app 안으로 복사합니다.
# 결과적으로 실행 파일의 경로는 /app/standalone/server.js가 됩니다.
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone

# [핵심 3] public과 static 폴더도 일관성을 위해 /app 아래에 위치시킵니다.
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Lambda Web Adapter를 설치합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [핵심 4] server.js 파일의 '절대 경로'를 사용하여 실행 명령을 내립니다.
# 이렇게 하면 WORKDIR 설정에 관계없이 항상 정확한 파일을 실행할 수 있습니다.
CMD ["node", "/app/standalone/apps/frontend/server.js"]
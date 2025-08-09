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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (수정본)
# ===================================================================================
FROM node:22-alpine AS runner

# [핵심 수정 1] 작업 디렉토리를 /app으로 단순화하고 통일합니다.
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# [핵심 수정 2] Builder 스테이지에서 생성된 standalone 빌드 결과물 전체를
# Runner 스테이지의 작업 디렉토리(/app)로 복사합니다.
COPY --from=builder /app/apps/frontend/.next/standalone /app

# [핵심 수정 3] public 폴더와 static 에셋도 최종 실행 위치에 맞게 복사합니다.
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Lambda Web Adapter를 설치합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [핵심 수정 4] /app 디렉토리에 복사된 server.js를 실행합니다.
CMD ["node", "server.js"]
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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (궁극의 최종본)
# ===================================================================================
FROM node:22-alpine AS runner

# [핵심 1] 작업 디렉토리를 /app으로 단순화하고 통일합니다. (기존과 동일)
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# [핵심 2: "궁극의 수정"] standalone 폴더 '안의 내용물'을 /app으로 복사합니다.
# 소스 경로 끝에 '/.' 를 추가하면, Docker는 디렉토리 자체가 아닌,
# 그 안의 모든 파일과 하위 디렉토리를 지정된 위치로 복사합니다.
# 즉, /app/apps/frontend/.next/standalone/apps/frontend/server.js -> /app/server.js 로 경로가 단순화됩니다.
COPY --from=builder /app/apps/frontend/.next/standalone/apps/frontend/. /app/

# [핵심 3] public과 static 폴더도 최종 실행 위치에 맞게 복사합니다.
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Lambda Web Adapter를 설치합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [핵심 4] 이제, 단순하고 예측 가능한 경로의 server.js를 실행합니다.
CMD ["node", "server.js"]
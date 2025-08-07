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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계
# ===================================================================================
FROM node:22-alpine AS runner

# [핵심 1차 수정] 작업 디렉토리를 /app/apps/frontend로 변경합니다.
# standalone 빌드의 결과물이 이 경로를 기준으로 생성되기 때문입니다.
WORKDIR /app/apps/frontend

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# [핵심 2차 수정] standalone 폴더의 내용물을 프로젝트 루트(/app)로 복사합니다.
# 이렇게 하면 'apps/frontend/server.js' 등의 파일이 올바른 위치에 자리잡게 됩니다.
COPY --from=builder /app/apps/frontend/.next/standalone /app

# [핵심 3차 수정] public 폴더와 static 에셋도 올바른 최종 위치로 복사합니다.
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# Lambda Web Adapter는 그대로 /opt/extensions에 복사합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [핵심 4차 수정] 변경된 작업 디렉토리(/app/apps/frontend)에서 server.js를 실행합니다.
# 이제 Node.js는 이 경로에서 server.js를 정확히 찾을 수 있습니다.
CMD ["node", "server.js"]
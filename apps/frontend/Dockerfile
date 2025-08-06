# 파일 위치: apps/frontend/Dockerfile
# 최종 수정일: 2025년 8월 6일 (Web Adapter 경로 오류 수정)
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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (수정됨)
# ===================================================================================
FROM node:22-alpine AS runner
WORKDIR /app

# [수정 1] 불필요하고 혼란을 야기했던 npm install 라인을 제거합니다.
# Web Adapter는 아래 COPY 명령어를 통해 직접 가져오는 것이 더 효율적입니다.
# RUN npm install -g @aws-lambda-adapter/core@0.8.3

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# [수정 2] 'aws-lambda-adapter'라는 잘못된 별명 대신,
# AWS ECR Public에 있는 Web Adapter의 정확한 공식 이미지 주소를 사용합니다.
COPY --from=public.ecr.aws/aws-lambda-adapter/adapter:latest /opt/extensions/ /opt/extensions/

CMD ["node", "server.js"]
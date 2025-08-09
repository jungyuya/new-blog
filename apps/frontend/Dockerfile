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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (최종 수정본)
# ===================================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# [핵심 최종 수정] standalone 폴더 '안의 모든 내용물(*)'을 /app으로 복사합니다.
# 소스 경로 끝에 '/.' 를 추가하는 것이 가장 명시적인 방법입니다.
COPY --from=builder /app/apps/frontend/.next/standalone/. /app/

# public 폴더와 static 에셋도 최종 실행 위치에 맞게 복사합니다.
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

EXPOSE 3000

CMD ["node", "server.js"]
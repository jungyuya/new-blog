# apps/frontend/Dockerfile (주소 수정 최종본)

# ... (Stage 1: Builder 부분은 변경 없습니다) ...
# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드
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
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지
# ===================================================================================
FROM node:22-alpine AS runner
WORKDIR /app

# [핵심 수정] Lambda Web Adapter를 npm install로 설치하는 대신,
# AWS가 제공하는 공식 ECR Public 이미지를 COPY --from 구문으로 가져옵니다.
# 이것이 가장 안정적이고 권장되는 방식입니다.
# Stage 1에서 설치했던 @aws-lambda-adapter/core는 더 이상 필요 없습니다.

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# [핵심 수정] 잘못된 주소를 Lambda Web Adapter의 정확한 공식 주소로 변경합니다.
# arm64 아키텍처에 맞는 최신 버전을 명시적으로 사용합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3-arm64 /opt/extensions/ /opt/extensions/

CMD ["node", "server.js"]
# 파일 위치: apps/frontend/Dockerfile
# 최종 버전: v2025.08.08-ReturnToTheSource
# 역할: 외부 의존성을 최소화한, 가장 안정적인 빌드 레시피

# ===================================================================================
# STAGE 1: Builder
# ===================================================================================
# [핵심] pnpm/pnpm 대신, 가장 표준적인 공식 node 이미지를 사용합니다.
FROM --platform=linux/arm64 node:22-alpine AS builder

# 작업 디렉토리를 설정합니다.
WORKDIR /app

# [핵심] pnpm을 npm을 통해 직접 설치합니다.
# 이렇게 하면 Docker Hub Rate Limit 문제에서 완전히 자유로워집니다.
RUN npm install -g pnpm

# 의존성 관련 파일만 먼저 복사하여 캐시를 활용합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/infra/package.json ./apps/infra/

# 의존성을 설치합니다.
RUN pnpm install --frozen-lockfile

# 나머지 소스 코드를 복사합니다.
COPY . .

# 프론트엔드를 빌드합니다.
RUN pnpm --filter frontend run build

# ===================================================================================
# STAGE 2: Runner
# ===================================================================================
FROM public.ecr.aws/lambda/nodejs:22

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
WORKDIR /var/task
ENV NODE_ENV=production PORT=3000 AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

CMD ["node", "server.js"]
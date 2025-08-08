# 파일 위치: apps/frontend/Dockerfile
# 최종 버전: v2025.08.08-The-Final-Stand

# ===================================================================================
# STAGE 1: Builder (변경 없음)
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/infra/package.json ./apps/infra/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter frontend run build

# ===================================================================================
# STAGE 2: Runner (핵심 수정)
# ===================================================================================
# 기본 AWS Lambda 이미지를 사용합니다.
FROM public.ecr.aws/lambda/nodejs:22

WORKDIR /var/task

# 애플리케이션 코드를 복사합니다.
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# [핵심 수정 1] 어댑터를 확장 기능(/opt/extensions)이 아닌, 실행 파일(/opt/bin)로 복사합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/bin/lambda-adapter

# [핵심 수정 2] 컨테이너의 주 실행 프로그램을 'lambda-adapter'로 지정합니다.
ENTRYPOINT [ "/opt/bin/lambda-adapter" ]

# [핵심 수정 3] 어댑터가 실행할 실제 애플리케이션 명령어를 CMD로 지정합니다.
CMD [ "node", "server.js" ]
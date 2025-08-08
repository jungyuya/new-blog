# 파일 위치: apps/frontend/Dockerfile
# 최종 버전: v2025.08.08-The-Final-Stand

# STAGE 1: Builder (기존과 동일)
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

# STAGE 2: Runner (핵심 수정)
FROM public.ecr.aws/lambda/nodejs:22
WORKDIR /var/task
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/bin/lambda-adapter
ENTRYPOINT [ "/opt/bin/lambda-adapter" ]
CMD [ "node", "server.js" ]
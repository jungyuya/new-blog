# apps/frontend/Dockerfile (루트 컨텍스트 기준 최종안)

# ===================================================================================
# STAGE 1: Builder
# ===================================================================================
FROM public.ecr.aws/sam/build-nodejs22.x:latest AS builder

WORKDIR /app

RUN corepack enable

# [핵심] 이제 컨텍스트가 루트이므로, 모든 경로는 루트를 기준으로 합니다.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
# frontend의 package.json을 명시적으로 복사합니다.
COPY apps/frontend/package.json ./apps/frontend/

# [핵심] pnpm은 workspace 설정을 읽어, frontend의 의존성만 설치합니다.
RUN pnpm --filter frontend install --frozen-lockfile

# [핵심] 프로젝트 전체 소스 코드를 복사합니다.
COPY . .

# [핵심] frontend 워크스페이스를 명시하여 빌드를 실행합니다.
RUN pnpm --filter frontend run build


# ===================================================================================
# STAGE 2: Runner
# ===================================================================================
FROM public.ecr.aws/lambda/nodejs:22

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task

ENV PORT=3000
ENV NODE_ENV=production

# [핵심] builder 스테이지의 올바른 경로에서 standalone 결과물을 복사합니다.
COPY --from=builder /app/apps/frontend/.next/standalone .

CMD ["node", "server.js"]
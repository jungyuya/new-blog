# apps/frontend/Dockerfile (최종 완결본)

# ===================================================================================
# STAGE 1: Builder - 애플리케이션을 빌드하기 위한 "작업장"
# ===================================================================================
FROM public.ecr.aws/sam/build-nodejs22.x:latest AS builder

WORKDIR /app

RUN corepack enable

# [핵심] 빌드 컨텍스트가 프로젝트 루트이므로, 모든 경로는 루트를 기준으로 합니다.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/

# [핵심] pnpm은 workspace 설정을 읽어, frontend의 의존성만 설치합니다.
RUN pnpm --filter frontend install --frozen-lockfile

# [핵심] 프로젝트 전체 소스 코드를 복사합니다. (.dockerignore에 의해 불필요한 파일은 제외됨)
COPY . .

# [핵심] frontend 워크스페이스를 명시하여 빌드를 실행합니다.
RUN pnpm --filter frontend run build


# ===================================================================================
# STAGE 2: Runner - 실제 Lambda에서 실행될 "최종 완성품"
# ===================================================================================
FROM public.ecr.aws/lambda/nodejs:22

# Lambda Web Adapter를 설치합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task

ENV PORT=3000
ENV NODE_ENV=production

# [핵심] builder 스테이지의 올바른 경로에서 standalone 결과물을 복사합니다.
COPY --from=builder /app/apps/frontend/.next/standalone .

# Lambda가 실행될 때, Next.js 프로덕션 서버를 시작하는 명령어를 지정합니다.
CMD ["node", "server.js"]
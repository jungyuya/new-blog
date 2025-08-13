# 파일 위치: apps/frontend/Dockerfile
# 수정 버전: v4.0.0 (궁극의 멀티-스테이지 캐시 최적화)

# ===================================================================================
# 1단계: 'deps' 스테이지 - 오직 의존성 설치만을 담당합니다.
# 이 스테이지는 pnpm-lock.yaml이 변경되지 않는 한, 거의 항상 캐시됩니다.
# ===================================================================================
FROM node:22-alpine AS deps
WORKDIR /app

# 의존성 설치에 필요한 '설계도' 파일들만 먼저 복사합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json

# 소스코드 없이 오직 의존성만 설치합니다.
RUN npm install -g pnpm@10.14.0
RUN pnpm install --frozen-lockfile --filter=frontend...


# ===================================================================================
# 2단계: 'builder' 스테이지 - 애플리케이션 코드 빌드를 담당합니다.
# 소스코드가 변경되면 이 스테이지부터 다시 시작됩니다.
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# 1단계(deps)에서 이미 설치된 node_modules와 의존성 파일들을 그대로 가져옵니다.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/package.json ./package.json

# 이제 나머지 소스코드를 복사합니다.
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY --link apps ./apps

# 애플리케이션을 빌드합니다. (의존성 설치를 다시 하지 않으므로 매우 빠릅니다)
RUN npm install -g pnpm@10.14.0
RUN pnpm --filter frontend run build


# ===================================================================================
# 3단계: 'runner' 스테이지 - 최종 실행 이미지를 만듭니다.
# 가장 가볍고 깨끗한 상태를 유지합니다.
# ===================================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# builder 스테이지에서 생성된 최종 결과물만 가져옵니다.
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Next.js standalone output은 server.js가 루트에 위치합니다.
# 따라서 이전의 복잡한 심볼릭 링크 로직이 더 이상 필요 없습니다.
CMD ["node", "server.js"]
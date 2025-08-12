# ---- builder ----
# Node 버전은 workflow에서 사용하는 Node.js 버전(22)과 맞추세요.
FROM node:22-bullseye-slim AS builder

# 시스템 종속성(필요시)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl \
  && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리
WORKDIR /app

# 의존성 레이어 캐시를 위해 package 파일 먼저 복사
# (패키지 파일이 바뀌지 않으면 이 레이어는 캐시됩니다)
COPY package.json pnpm-lock.yaml ./

# BuildKit 캐시 마운트를 사용하여 pnpm 스토어를 캐시
# (docker/build-push-action를 사용할 때 cache-from/cache-to와 함께 동작)
# 이 RUN 명령은 BuildKit 전용 문법으로, GitHub Actions의 buildx에서 지원됩니다.
RUN npm i -g pnpm@8

# --mount=type=cache 를 통해 node_modules 및 pnpm store 캐시 가능
RUN --mount=type=cache,target=/root/.pnpm-store \
    --mount=type=cache,target=/app/node_modules \
    pnpm install --frozen-lockfile

# 소스 전체 복사
COPY . .

# 빌드 (프레임워크에 맞게 변경)
RUN pnpm --filter frontend run build

# ---- production image ----
FROM node:22-bullseye-slim AS runtime

# 최소 권한 사용자 생성(선택)
RUN useradd --uid 1000 --create-home appuser

WORKDIR /app

# production 시 필요한 파일만 복사
COPY --from=builder /app/apps/frontend/.next .next
COPY --from=builder /app/apps/frontend/public public
COPY --from=builder /app/apps/frontend/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# 포트(Next.js default 3000 등)
EXPOSE 3000

USER appuser

# 프레임워크에 따라 서버 시작 명령을 맞추세요. 예: next start
CMD ["pnpm", "start"]

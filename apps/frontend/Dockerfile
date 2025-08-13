# apps/frontend/Dockerfile (권장 — multi-stage builder + runner)
# Node 22 alpine 사용
FROM node:22-alpine AS builder
WORKDIR /app

# install pnpm
RUN npm install -g pnpm@10.14.0

# 복사: 루트 레벨의 잠금파일/워크스페이스 설정을 먼저 복사 (캐시 효율)
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./
COPY turbo.json ./

# 필요하면 각 패키지의 package.json도 복사 (pnpm workspace resolution 도움)
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/infra/package.json ./apps/infra/package.json

# 의존성 설치 (workspace 전체)
RUN pnpm install --frozen-lockfile

# 소스 전체 복사
COPY . .

# 빌드: frontend만 빌드 (turborepo 필터 또는 pnpm 필터 사용)
# - turborepo 사용시: pnpm -w turbo run build --filter=frontend...
# 여기서는 pnpm 필터를 사용
RUN pnpm --filter frontend run build

# 이제 builder에는 /app/apps/frontend/.next 가 생성되어 있어야 함

# -------------------------
# Runner (최종 이미지)
# -------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# 복사: 빌더에서 생성된 아티팩트만 가져온다
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# lambda adapter (원래대로)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# 정규화: server.js 위치 보장 (standalone 구조가 apps/frontend/server.js 경로일 수 있으므로)
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "symlink created"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]

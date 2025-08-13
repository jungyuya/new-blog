# 파일 위치: apps/frontend/Dockerfile
# 최종 안정화 버전: v3.0.1
# 변경 사항: 1. RUN 명령어의 셸 스크립트 문법 오류를 완벽하게 수정합니다.

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# --- Layer 1: 의존성 설치 ---
RUN npm install -g pnpm@10.14.0
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY apps/infra/package.json ./apps/infra/
RUN pnpm install --frozen-lockfile

# --- Layer 2: 소스 코드 복사 ---
# .turbo 폴더를 제외한 나머지 소스 코드를 먼저 복사합니다.
# 이렇게 하면, .turbo 폴더의 존재 여부가 다른 파일들의 캐시에 영향을 주지 않습니다.
COPY apps ./apps
COPY scripts ./scripts

# --- Layer 3: Turborepo 캐시 복사 및 빌드 ---
# [최종 수정] RUN 명령어를 사용하여, .turbo 폴더가 존재할 경우에만 복사하도록 합니다.
# 이렇게 하면 캐시가 없는 첫 빌드에서도 오류가 발생하지 않습니다.
RUN --mount=type=cache,target=/app/.turbo \
    if [ -d ".turbo" ]; then \
      echo "Found .turbo cache, copying to build context..."; \
      cp -R .turbo /app/.turbo; \
    else \
      echo "No .turbo cache found, proceeding without it."; \
    fi && \
    pnpm --filter frontend run build
# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계
# ===================================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [최종 안정화] 빌드 시점에 server.js의 위치를 확인하고,
# /app/standalone/server.js 경로로 심볼릭 링크를 생성하여 실행 경로를 정규화합니다.
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Symbolic link created: /app/standalone/server.js -> /app/standalone/apps/frontend/server.js"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

# [최종 안정화] 항상 정규화된 단일 경로를 사용하여 서버를 실행합니다.
CMD ["node", "/app/standalone/server.js"]
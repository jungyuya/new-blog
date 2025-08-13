# 파일 위치: apps/frontend/Dockerfile
# 최종 안정화 버전: v3.0.1
# 변경 사항: 1. RUN 명령어의 셸 스크립트 문법 오류를 완벽하게 수정합니다.

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계 (최적화 적용)
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.14.0

# --- [DLC 최적화 1] 의존성 관련 파일만 먼저 복사 ---
# pnpm install은 이 파일들에만 의존하므로, 소스 코드가 변경되어도 이 단계까지의 캐시는 유지됩니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json turbo.json ./
# 각 워크스페이스의 package.json도 미리 복사합니다.
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY apps/infra/package.json ./apps/infra/
COPY apps/cache-gateway/package.json ./apps/cache-gateway/

# --- [DLC 최적화 2] 의존성 설치 ---
# 이 RUN 명령어는 이제 pnpm-lock.yaml이 변경될 때만 다시 실행됩니다.
RUN pnpm install --frozen-lockfile --filter=frontend...

# --- [DLC 최적화 3] 나머지 소스 코드 전체 복사 ---
# 이제 소스 코드를 복사합니다. 이 단계부터의 캐시는 코드 변경 시 깨집니다.
COPY --link apps ./apps
RUN if [ -d "packages" ]; then cp -a packages . ; fi
COPY tsconfig.json ./

# --- [DLC 최적화 4] 애플리케이션 빌드 ---
# 항상 최신 소스 코드를 바탕으로 빌드를 실행합니다.
RUN pnpm --filter frontend run build


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
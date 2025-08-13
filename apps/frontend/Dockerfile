# 파일 위치: apps/frontend/Dockerfile
# 최종 안정화 버전: v3.0.1
# 변경 사항: 1. RUN 명령어의 셸 스크립트 문법 오류를 완벽하게 수정합니다.

# ===================================================================================
# Stage 1: Builder - 의존성 설치와 소스 코드 빌드를 분리하여 레이어 캐시를 최적화
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
COPY apps ./apps
COPY scripts ./scripts

# --- Layer 3: Turborepo 캐시를 활용한 빌드 ---
# [최종 수정] --mount를 사용하여 호스트의 .turbo 캐시를 컨테이너에 연결하고,
# 불필요한 cp 명령어 없이 즉시 빌드를 실행합니다.
RUN --mount=type=cache,target=/app/.turbo pnpm --filter frontend run build
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
# 파일 위치: apps/frontend/Dockerfile
# 수정 버전: v3.2.0  (모노레포 캐시 최적화 오류 수정)

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.14.0

# [변경 후] 1. 의존성 설치에 필요한 '모든' 설계도(package.json)를 먼저 복사합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# --- [핵심 수정] ---
# 각 workspace의 package.json을 먼저 복사하여, pnpm install이 의존성을 정확히 파악하도록 합니다.
# 이 라인들은 의존성 구조를 정의하므로, 캐시 효율에 매우 중요합니다.
COPY --link apps/frontend/package.json ./apps/frontend/package.json
COPY --link apps/backend/package.json ./apps/backend/package.json
# 참고: 만약 다른 앱(e.g., apps/admin)이 추가되면, 위와 같은 형식으로 한 줄 추가해주셔야 합니다.


# [변경 후] 2. 모든 설계도가 준비된 상태에서 의존성을 설치합니다.
# 이제 pnpm은 frontend의 'next' 패키지를 포함한 모든 것을 올바르게 설치합니다.
# 이 단계는 package.json이나 pnpm-lock.yaml이 변경될 때만 다시 실행됩니다.
RUN pnpm install --frozen-lockfile --filter=frontend...


# [변경 후] 3. 의존성 설치가 끝난 후, 자주 변경되는 나머지 소스코드를 복사합니다.
# 코드만 변경될 경우, 빌드는 이 지점부터 다시 시작됩니다.
COPY --link apps ./apps


# [변경 후] 4. 최종적으로 애플리케이션을 빌드합니다.
# 이제 pnpm은 설치된 node_modules에서 'next' 명령어를 정상적으로 찾을 수 있습니다.
RUN pnpm --filter frontend run build


# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (변경 없음)
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

RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Symbolic link created: /app/standalone/server.js -> /app/standalone/apps/frontend/server.js"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]
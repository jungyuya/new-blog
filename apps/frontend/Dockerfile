# 파일 위치: apps/frontend/Dockerfile
# 수정 버전: v3.1.0 (캐시 최적화 적용)

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.14.0

# [변경 후] 1. 의존성 정의 파일들을 먼저 복사합니다.
# 이 파일들은 소스코드보다 훨씬 덜 자주 변경됩니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# [변경 전] 이 부분에 있던 소스코드 복사 라인을 뒤로 옮깁니다.
# COPY --link apps ./apps

# [변경 후] 2. 소스코드 복사 전에 의존성을 먼저 설치합니다.
# 이로써 pnpm-lock.yaml이 변경되지 않는 한, 이 오래 걸리는 단계는 캐시되어 재사용됩니다.
RUN if [ -d "packages" ]; then cp -a packages . ; fi
RUN pnpm install --frozen-lockfile --filter=frontend...

# [변경 후] 3. 의존성 설치가 끝난 후, 자주 변경되는 소스코드를 복사합니다.
# 코드 변경 시, 빌드는 캐시된 의존성 레이어 다음인 이 지점부터 다시 시작됩니다.
COPY --link apps ./apps

# [변경 전] 이 부분에 있던 의존성 설치 라인을 위로 옮겼습니다.
# RUN pnpm install --frozen-lockfile --filter=frontend...

# [변경 후] 4. 최종적으로 애플리케이션을 빌드합니다.
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
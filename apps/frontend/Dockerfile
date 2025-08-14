# 파일 위치: apps/frontend/Dockerfile
# 버전: v3.2.0 (Legacy Deploy Flag Enabled)
# 역할: pnpm v10+의 deploy 정책에 대응하기 위해 --legacy 플래그를 추가한 최종 검증 버전.

# ===================================================================================
# Stage 1: Pruning - 프로덕션 의존성만 골라내기
# ===================================================================================
FROM node:22-alpine AS pruner
WORKDIR /app
RUN npm install -g pnpm@10.14.0

# pnpm이 lockfile을 해석하는 데 필요한 모든 파일을 복사합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/infra/package.json ./apps/infra/package.json

# [수정] --legacy 플래그를 추가하여, pnpm v10+의 새로운 deploy 정책을 명시적으로 우회합니다.
# 우리의 frontend는 다른 워크스페이스 패키지에 의존하지 않으므로, 이 플래그가 우리의 의도에 부합합니다.
RUN pnpm deploy --filter=frontend... --prod /app/prod_deps --legacy


# ===================================================================================
# Stage 2: Runner - 실제 실행 이미지
# ===================================================================================
FROM node:22-alpine AS runner
WORKDIR /app

# 환경
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# Stage 1에서 생성한, 정리된 프로덕션 의존성 폴더를 복사합니다.
COPY --from=pruner /app/prod_deps/node_modules ./node_modules

# CI가 만든 빌드 산출물(.next/standalone 등)을 그대로 복사합니다.
COPY apps/frontend/.next/standalone /app/standalone
COPY apps/frontend/.next/static /app/.next/static
COPY apps/frontend/public /app/public

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# server.js 정규화
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Symbolic link created"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]
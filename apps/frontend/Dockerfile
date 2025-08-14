# 파일 위치: apps/frontend/Dockerfile
# 버전: v3.0.0 (Monorepo Context Aware)
# 역할: pnpm 모노레포의 컨텍스트를 완벽하게 이해하고, lockfile 불일치 문제를 근본적으로 해결한 최종 버전.

# ===================================================================================
# Stage 1: Pruning - 프로덕션 의존성만 골라내기
# ===================================================================================
FROM node:22-alpine AS pruner
WORKDIR /app
RUN npm install -g pnpm@10.14.0

# [수정] pnpm이 lockfile을 해석하는 데 필요한 모든 파일을 복사합니다.
# 1. 루트 package.json, lockfile, workspace.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# 2. 모든 하위 프로젝트들의 package.json을 원래 구조 그대로 복사합니다.
#    이렇게 해야 pnpm이 전체 워크스페이스 구조를 이해할 수 있습니다.
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/infra/package.json ./apps/infra/package.json

# [수정] pnpm의 --prod 플래그는 버그가 있을 수 있으므로, deploy 명령어를 사용합니다.
# `pnpm deploy`는 lockfile을 기반으로 프로덕션 의존성만을 /app/prod_deps 디렉토리에 정확하게 설치합니다.
# 이는 모노레포 환경에서 프로덕션 의존성을 추출하는 가장 안정적인 방법입니다.
RUN pnpm deploy --prod /app/prod_deps


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

# [추가] Stage 1에서 생성한, 정리된 프로덕션 의존성 폴더를 복사합니다.
COPY --from=pruner /app/prod_deps/node_modules ./node_modules

# CI가 만든 빌드 산출물(.next/standalone 등)을 그대로 복사합니다.
# standalone 출력물은 이미 자체 node_modules를 포함할 수 있지만,
# 만약을 위해 위에서 복사한 node_modules를 먼저 배치합니다.
COPY apps/frontend/.next/standalone /app/standalone
COPY apps/frontend/.next/static /app/.next/static
COPY apps/frontend/public /app/public

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# server.js 정규화 (기존 스크립트 로직 그대로 유지)
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Symbolic link created"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]
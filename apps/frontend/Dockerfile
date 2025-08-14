# 파일 위치: apps/frontend/Dockerfile
# 버전: v2.0.0 (Path Corrected)
# 역할: pnpm-lock.yaml의 실제 위치를 정확히 참조하여 빌드 오류를 해결한 최종 버전.

FROM node:22-alpine AS runtime
WORKDIR /app

# 환경
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# pnpm 설치
RUN npm install -g pnpm@10.14.0

# [수정] 복사: package.json과 실제 경로의 pnpm-lock.yaml을 복사합니다.
# pnpm-lock.yaml은 프로젝트 루트에 있으므로, 그 경로를 그대로 사용합니다.
# Dockerfile의 COPY 명령어는 빌드 컨텍스트의 루트(프로젝트 루트)를 기준으로 경로를 해석합니다.
COPY apps/frontend/package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml

# production 의존성만 설치
# Dockerfile 내부의 WORKDIR가 /app 이므로, /app 디렉토리에서 pnpm install을 실행합니다.
RUN pnpm install --prod --frozen-lockfile

# CI가 만든 빌드 산출물(.next/standalone 등)을 그대로 복사
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
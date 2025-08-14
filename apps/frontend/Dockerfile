# apps/frontend/Dockerfile  — Build-once 패턴용 (권장)
FROM node:22-alpine AS runtime
WORKDIR /app

# 환경
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# pnpm 필요시 설치 (runtime 단계에서 prod deps 설치)
RUN npm install -g pnpm@10.14.0

# 복사: package.json (프로덕션 의존성 설치용)
COPY apps/frontend/package.json apps/frontend/pnpm-lock.yaml ./

# production 의존성만 설치 (optional: CI에서 node_modules 복사할 경우 생략 가능)
RUN pnpm install --prod --frozen-lockfile

# CI가 만든 빌드 산출물(.next/standalone 등)을 그대로 복사
# (워크플로우에서 pnpm build를 먼저 실행해야 함)
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# server.js 정규화 (귀하의 기존 스크립트 로직 그대로 유지)
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Symbolic link created"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]

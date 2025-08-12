# apps/frontend/Dockerfile
# 버전: v3.0.1-Patched-CacheSafe
# 목적: 빌드 레이어 캐시 효율을 최대화 하여 반복 배포 속도 단축.
# 안전성: 빌드 실패 시 명확한 에러 출력 / server.js 위치 확인 로직 포함.

# -------------------------
# Stage: builder
# -------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# install pnpm globally
RUN npm install -g pnpm@10.14.0

# 1) copy package manifests (cached layer)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# Use a dedicated store path inside image to maximize layer cache reuse
ENV PNPM_STORE_PATH=/pnpm-store

RUN mkdir -p "${PNPM_STORE_PATH}" \
    && pnpm install --frozen-lockfile --store-dir "${PNPM_STORE_PATH}"

# 2) copy source code (less likely to change lockfile)
COPY --link apps ./apps
RUN if [ -d "packages" ]; then cp -a packages . ; fi

# 3) build frontend only
RUN pnpm --filter frontend run build

# -------------------------
# Stage: runner (final image)
# -------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# Copy Next standalone output (Next.js standalone build)
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Copy lambda adapter from its image (allowed via --from=image)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Ensure server.js exists at normalized path. Create symlink if necessary.
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Symbolic link created: /app/standalone/server.js -> /app/standalone/apps/frontend/server.js"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

# Final command: use normalized single path (stable)
CMD ["node", "/app/standalone/server.js"]

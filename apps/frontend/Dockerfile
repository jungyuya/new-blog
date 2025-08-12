# apps/frontend/Dockerfile
# 버전: v3.0.1-Patched-CacheSafe-FINAL
# 목적: monorepo(pnpm) 환경에서 frontend만 안전하게 설치/빌드하고
#       빌드 캐시를 최대한 활용하여 반복 배포 시간을 단축.
# 주의: 이 파일은 builder stage에서 devDependencies(예: next)가 설치되도록
#       NODE_ENV를 production으로 설정하지 않습니다.

# -------------------------
# Stage: builder
# -------------------------
FROM node:22-alpine AS builder
# set a stable working directory
WORKDIR /app

# Install pnpm globally
# pin to a known-good pnpm version
RUN npm install -g pnpm@10.14.0

# Copy root manifests (package manifests + pnpm workspace) and frontend package.json
# -> 이유: workspace 패키지 manifest를 미리 복사하면 pnpm이 워크스페이스 의존성을 올바르게 해석하여
#          frontend 의존성만 설치하도록 --filter frontend... 옵션으로 동작합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
# (선택) 만약 frontend에 .npmrc가 있다면 아래 라인 추가:
# COPY apps/frontend/.npmrc ./apps/frontend/.npmrc

# Use a dedicated pnpm store directory inside the image to maximize cache reuse between builds
ENV PNPM_STORE_PATH=/pnpm-store

# Create store dir and install only frontend workspace dependencies (includes devDeps needed for build)
RUN mkdir -p "${PNPM_STORE_PATH}" \
    && pnpm install --frozen-lockfile --store-dir "${PNPM_STORE_PATH}" --filter frontend...

# SAFETY CHECK: ensure 'next' (build tool) is available for frontend
# - pnpm --filter frontend exec -- node -e "require('next')" will succeed only if next is resolvable
# - if missing, print helpful diagnostics and fail early to avoid later obscure errors
RUN set -euo pipefail; \
    echo "Verifying 'next' is available for frontend..."; \
    if ! pnpm --filter frontend exec -- node -e "require('next'); console.log('next OK');" > /tmp/next_check.log 2>&1; then \
      echo "ERROR: 'next' not found after pnpm install. Dumping diagnostics:" >&2; \
      echo "------ /app/apps/frontend/package.json ------" >&2; cat /app/apps/frontend/package.json || true; \
      echo "------ Listing potential frontend node_modules (.pnpm, node_modules) ------" >&2; ls -la ./apps/frontend || true; ls -la ./apps/frontend/node_modules || true; ls -la ./node_modules || true; \
      echo "------ PNPM store contents (top-level) ------" >&2; ls -la ${PNPM_STORE_PATH} || true; \
      echo "Contents of /tmp/next_check.log:" >&2; cat /tmp/next_check.log || true; \
      echo "Failing build to avoid producing a broken image." >&2; \
      exit 1; \
    else \
      echo "SAFETY: 'next' available - proceeding with source copy and build."; \
    fi

# Copy full source now (less likely to change lockfile)
# Note: avoid --link for maximum compatibility across Docker versions; use plain COPY
COPY apps ./apps
# If you use a packages folder in monorepo, copy it too
RUN if [ -d "packages" ]; then cp -a packages . ; fi

# Build frontend (this runs the script declared in apps/frontend/package.json)
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

# Copy Next standalone output + public + static assets (Next standalone mode expected)
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Bring in lambda adapter required by your runtime (if used)
# (this copies from a public image)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Normalize server.js path: if Next standalone nested path differs, create symlink to a single known path
RUN set -euo pipefail; \
    if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Created symlink for server.js"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

# Final command: run the Next standalone server from normalized path
CMD ["node", "/app/standalone/server.js"]

# apps/frontend/Dockerfile
# Multi-stage: deps (optional cache image), builder (빌드), runner (런타임)
# - Keep manifests COPY -> install -> COPY . pattern for cache efficiency.
# - Builder runs pnpm install itself to ensure workspace links are correct.

# -----------------------
# Stage: deps (optional) - used by CI to push deps-cache:<lock-hash>
# -----------------------
FROM node:22-alpine AS deps
WORKDIR /app

# ensure pnpm exists in this stage
RUN npm install -g pnpm@10.14.0

# Copy lockfiles and package manifests only (so this layer can be cached)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/infra/package.json ./apps/infra/package.json

# Install dependencies (creates node_modules and .pnpm store)
RUN pnpm install --frozen-lockfile

# -----------------------
# Stage: builder - build the frontend
# -----------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Ensure pnpm present in builder as well
RUN npm install -g pnpm@10.14.0

# Copy manifests first (to maximize install layer cacheability)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/infra/package.json ./apps/infra/package.json

# Install dependencies inside builder so PNPM workspace links are created correctly for this stage
RUN pnpm install --frozen-lockfile

# Now copy full repository (source), won't invalidate the install layer above
COPY . .

# Build frontend
RUN pnpm --filter frontend run build

# Optional: remove build trace(s) that can change across runs and break caching
RUN rm -rf /app/apps/frontend/.next/trace || true

# -----------------------
# Stage: runner - minimal runtime image
# -----------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# Copy only the final build artifacts
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Lambda adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Ensure server.js path is normalized
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "symlink created"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]

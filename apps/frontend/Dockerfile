# apps/frontend/Dockerfile
# Multi-stage with deps stage to improve cache reuse

# -----------------------
# Stage: deps (의존성 전용)
# -----------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.14.0

# Copy lockfiles and package manifests first for cache efficiency
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/infra/package.json ./apps/infra/package.json

# Install workspace dependencies (creates node_modules in /app)
RUN pnpm install --frozen-lockfile

# -----------------------
# Stage: builder (소스 복사 후 빌드)
# -----------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Reuse node_modules from deps stage to maximize cache hits
COPY --from=deps /app/node_modules /app/node_modules

# Copy the rest of the repository
COPY . .

# Build only frontend (using pnpm workspace filter)
RUN pnpm --filter frontend run build

# -----------------------
# Stage: runner (최종, 가벼운 이미지)
# -----------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# Copy build artifacts from builder
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# Lambda adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Ensure server.js path is standardized
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "symlink created"; \
    else \
      echo "ERROR: server.js not found in standalone output. Listing /app/standalone contents:" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]

# apps/frontend/Dockerfile (optimized for layer cache)
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm (single layer)
RUN npm install -g pnpm@10.14.0

# 1) Copy only files needed for dependency resolution (minimize churn)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# Copy frontend package manifest specifically (monorepo)
COPY apps/frontend/package.json ./apps/frontend/package.json

# Ensure corepack/pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 2) Install dependencies for frontend only; use an internal store dir so layer caches
#    This layer will be cached (by docker layer/cache or registry cache)
RUN pnpm install --frozen-lockfile --store-dir /pnpm-store --filter=frontend...

# 3) Now copy the rest of the repository (source files) and build
COPY . .
WORKDIR /app/apps/frontend
RUN pnpm --filter frontend run build

# =========================
# Runtime image
# =========================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# copy standalone build output
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static
# lambda adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# normalize server.js location
RUN if [ -f /app/standalone/server.js ]; then \
      echo "server.js found at /app/standalone"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && echo "Linked server.js"; \
    else \
      echo "ERROR: server.js not found" >&2; ls -la /app/standalone || true; exit 1; \
    fi

CMD ["node", "/app/standalone/server.js"]

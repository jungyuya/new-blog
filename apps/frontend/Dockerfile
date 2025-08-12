# apps/frontend/Dockerfile
# 최종 안정화 버전 (Next.js standalone 기반, non-root 실행)
# Stage 1: Builder
FROM node:22-alpine AS builder

# 작업 디렉토리
WORKDIR /app

# pnpm 최신 버전(프로젝트 요구에 맞춰 버전 조정 가능)
RUN npm install -g pnpm@10.14.0

# 패키지 메타파일 우선 복사 (의존성 레이어 캐시 목적)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# 소스의 apps 디렉토리만 먼저 복사 (빌드 속도/캐시 향상)
# --link 옵션은 로컬 환경에서만 의미가 있으므로 빌드 환경에 따라 필요 시 제거 가능
COPY --link apps ./apps
RUN if [ -d "packages" ]; then cp -a packages . ; fi

# 의존성 설치 (프로젝트 의존성에 따라 --filter 옵션 조정)
RUN pnpm install --frozen-lockfile --filter=frontend...

# 프론트엔드 빌드 (프로젝트 스크립트에 맞춰 조정)
RUN pnpm --filter frontend run build

# Stage 2: Runner (production)
FROM node:22-alpine AS runner

# 환경 변수
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

WORKDIR /app

# Lambda adapter 같은 외부 바이너리를 이미지에서 바로 가져오려면 별도 stage로 가져오거나,
# BuildKit이 허용하면 registry에서 직접 복사할 수 있습니다. (아래는 안전한 방식)
# FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 AS lambda-adapter
# COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

# builder에서 생성된 standalone 및 정적 파일 복사
COPY --from=builder /app/apps/frontend/.next/standalone /app/standalone
COPY --from=builder /app/apps/frontend/public /app/public
COPY --from=builder /app/apps/frontend/.next/static /app/.next/static

# 안전한 non-root 사용자 생성 (Alpine)
# 이미 존재하면 에러 나지 않도록 검사
RUN addgroup -S appuser || true && \
    adduser -S -G appuser -h /home/appuser -s /bin/sh appuser || true

# standalone 내부의 server.js 위치 정규화
# - 일반적으로 standalone은 /app/standalone/server.js 이거나
#   /app/standalone/apps/<pkg>/server.js 형태입니다.
RUN if [ -f /app/standalone/server.js ]; then \
      echo "Found server.js at /app/standalone/server.js"; \
    elif [ -f /app/standalone/apps/frontend/server.js ]; then \
      ln -sf /app/standalone/apps/frontend/server.js /app/standalone/server.js && \
      echo "Created symlink to /app/standalone/apps/frontend/server.js"; \
    else \
      echo "ERROR: server.js not found in /app/standalone. Listing contents:" >&2; \
      ls -la /app/standalone || true; \
      exit 1; \
    fi

# 소유권 설정: appuser에게 /app 소유권 부여
RUN chown -R appuser:appuser /app /app/standalone /app/public /app/.next || true

# 포트 노출
EXPOSE 3000

# 비루트 사용자로 전환
USER appuser

# 실행 커맨드: standalone의 server.js를 node로 실행
CMD ["node", "/app/standalone/server.js"]

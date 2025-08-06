# 파일 위치: apps/frontend/Dockerfile
# 최종 수정일: 2025년 8월 6일 (Jungyu님의 리서치 기반 최종 수정)
# 역할: pnpm 모노레포 환경에 최적화된 다단계 빌드(Multi-stage Build) 레시피

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계 (변경 없음)
# ===================================================================================
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.14.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter=frontend...
RUN pnpm --filter frontend run build

# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계 (최종 수정)
# ===================================================================================
FROM node:22-alpine AS runner
WORKDIR /app

# [변경 없음] 환경 변수는 Web Adapter의 기본 실행 방식을 따릅니다.
# 단, AWS_LAMBDA_EXEC_WRAPPER의 경로는 아래 COPY 명령어의 대상 경로와 일치해야 합니다.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# [변경 없음] 빌드 결과물 복사
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# [핵심 최종 수정] Jungyu님의 리서치를 통해 검증된 정보만을 사용합니다.
# 1. 정확한 리포지토리 경로: public.ecr.aws/awsguru/aws-lambda-adapter
# 2. 안정적인 버전 태그 명시: 0.9.1 (최신 안정 버전)
# 3. 정확한 복사 원본 및 대상: /lambda-adapter -> /opt/extensions/lambda-adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# [변경 없음] 서버 실행 명령어
CMD ["node", "server.js"]
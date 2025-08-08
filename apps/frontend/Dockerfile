# 파일 위치: apps/frontend/Dockerfile
# 최종 버전: v2025.08.08-Masterpiece
# 역할: pnpm 모노레포 환경에서 Next.js 앱을 빌드하는 가장 견고하고 최적화된 레시피

# ===================================================================================
# STAGE 1: Builder - 의존성 설치 및 애플리케이션 빌드
# ===================================================================================
# pnpm이 공식적으로 제공하는 이미지를 사용하여, 버전 충돌 가능성을 원천 차단합니다.
FROM pnpm/pnpm:10 AS builder

# 작업 디렉토리를 설정합니다.
WORKDIR /app

# [최적화] 전체 소스코드를 복사하기 전에, 의존성 관련 파일만 먼저 복사하여
# pnpm install 레이어가 캐시될 수 있도록 합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# [최적화] apps와 packages 디렉토리의 package.json 파일들만 먼저 복사합니다.
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/infra/package.json ./apps/infra/

# 의존성을 설치합니다. --filter를 사용하여 빌드에 필요한 최소한의 의존성만 설치할 수도 있지만,
# 모노레포의 일관성을 위해 전체 설치하는 것이 더 안정적입니다.
RUN pnpm install --frozen-lockfile

# 나머지 전체 소스 코드를 복사합니다.
COPY . .

# pnpm과 turbo를 사용하여, frontend 워크스페이스를 빌드합니다.
RUN pnpm --filter frontend run build

# ===================================================================================
# STAGE 2: Runner - 실제 서비스 실행을 위한 최종 이미지
# ===================================================================================
# AWS Lambda가 공식적으로 제공하는 Node.js 22 런타임 이미지를 사용합니다.
FROM public.ecr.aws/lambda/nodejs:22

# Lambda Web Adapter를 설치합니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task

# 환경 변수를 설정합니다.
ENV NODE_ENV=production \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# builder 스테이지에서 생성된, 실행에 필요한 최소한의 파일만 복사합니다.
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# Next.js 프로덕션 서버를 시작하는 명령어를 지정합니다.
CMD ["node", "server.js"]
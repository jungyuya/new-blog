# 파일 위치: apps/frontend/Dockerfile
# 최종 수정일: 2025년 8월 6일
# 역할: pnpm 모노레포 환경에 최적화된 다단계 빌드(Multi-stage Build) 레시피

# ===================================================================================
# Stage 1: Builder - 의존성 설치 및 애플리케이션 빌드 단계
# "재료 손질용 도마"에 해당합니다. 개발에 필요한 모든 도구를 사용합니다.
# ===================================================================================

# 1. 베이스 이미지 선택: node:22-alpine 버전을 'builder'라는 별명으로 지정합니다.
# 'alpine'은 매우 가벼운 리눅스 배포판으로, 이미지 크기를 줄이는 데 도움이 됩니다.
FROM node:22-alpine AS builder

# 2. 작업 디렉토리 설정: 이미지 안의 /app 이라는 폴더에서 모든 작업을 수행합니다.
WORKDIR /app

# 3. pnpm 설치: 전역(-g)으로 우리 프로젝트 버전과 동일한 pnpm을 설치합니다.
RUN npm install -g pnpm@10.14.0

# 4. 의존성 관련 파일 우선 복사:
# package.json, lockfile 등 의존성 정의 파일들을 먼저 복사합니다.
# Docker는 레이어(Layer) 기반으로 캐싱을 수행하는데, 이 파일들이 변경되지 않으면
# 다음 단계인 'pnpm install' 과정을 건너뛰어 빌드 속도를 크게 향상시킵니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json turbo.json ./

# 5. 전체 소스 코드 복사:
# 'apps'와 'packages' 디렉토리 전체를 이미지 안으로 복사합니다.
COPY apps ./apps
COPY packages ./packages

# 6. 의존성 설치 (pnpm 최적화):
# --frozen-lockfile: pnpm-lock.yaml과 정확히 일치하는 버전만 설치하여 예기치 않은 버전 변경을 막습니다.
# --filter=frontend...: 모노레포 전체가 아닌, 'frontend' 앱과 그에 필요한 공통 패키지만을 설치하여 빌드 시간을 단축하고 불필요한 의존성을 배제합니다.
RUN pnpm install --frozen-lockfile --filter=frontend...

# 7. 프론트엔드 애플리케이션 빌드:
# pnpm의 filter 기능을 사용하여 'frontend' 앱의 'build' 스크립트를 실행합니다.
# 이 명령이 성공적으로 끝나면 .next 폴더에 실행 가능한 결과물이 생성됩니다.
RUN pnpm --filter frontend run build


# ===================================================================================
# Stage 2: Runner - 실제 서비스 실행을 위한 최종 이미지 단계
# "손님에게 나갈 최종 접시"에 해당합니다. 실행에 필요한 최소한의 파일만 담습니다.
# ===================================================================================

# 1. 베이스 이미지 선택: 다시 깨끗한 node:22-alpine 이미지를 'runner'라는 별명으로 지정합니다.
FROM node:22-alpine AS runner

# 2. 작업 디렉토리 설정: 최종 실행 환경의 작업 디렉토리도 /app 으로 설정합니다.
WORKDIR /app

# 3. Lambda Web Adapter 설치:
# 이 도구는 일반적인 Node.js 웹 애플리케이션(Next.js)을 Lambda 환경에서 실행될 수 있도록 변환해주는 마법 같은 역할을 합니다.
# https://github.com/awslabs/aws-lambda-web-adapter
RUN npm install -g @aws-lambda-adapter/core@0.8.3

# 4. 환경 변수 설정:
# NODE_ENV=production: Next.js를 프로덕션 모드로 실행하여 성능을 최적화합니다.
# NEXT_TELEMETRY_DISABLED=1: 불필요한 원격 측정 데이터 전송을 비활성화합니다.
# PORT=3000: Next.js 서버가 이미지 내부에서 3000번 포트를 사용하도록 지정합니다.
# AWS_LAMBDA_EXEC_WRAPPER: Lambda가 실행될 때, 먼저 Web Adapter를 실행하도록 지정하는 핵심 설정입니다.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter

# 5. 빌드 결과물 선택적 복사 (다단계 빌드의 핵심):
# '--from=builder' 옵션을 사용하여, 첫 번째 'builder' 스테이지에서 생성된 파일들만 골라서 가져옵니다.
# 5-1. Standalone 서버 파일 복사: .next/standalone 폴더에는 서버 실행에 필요한 최소한의 파일들이 들어있습니다.
COPY --from=builder /app/apps/frontend/.next/standalone ./
# 5-2. Public 폴더 복사: 이미지, 폰트 등 정적 파일들을 복사합니다.
COPY --from=builder /app/apps/frontend/public ./public
# 5-3. 정적 에셋 복사: .next/static 폴더의 파일들(CSS, JS 등)을 복사합니다. 이 파일들은 나중에 CDK가 S3로 업로드할 때도 사용됩니다.
COPY --from=builder /app/apps/frontend/.next/static ./.next/static

# 6. Lambda Web Adapter 실행 파일 복사:
# Web Adapter 이미지에 미리 포함된 실행 파일을 우리 이미지의 /opt/extensions 폴더로 복사합니다.
COPY --from=aws-lambda-adapter /opt/extensions/ /opt/extensions/

# 7. 서버 실행 명령어 정의:
# 이 이미지가 컨테이너로 실행될 때, 'node server.js' 명령어를 자동으로 실행하도록 설정합니다.
# server.js는 Next.js standalone 모드의 기본 진입점입니다.
CMD ["node", "server.js"]
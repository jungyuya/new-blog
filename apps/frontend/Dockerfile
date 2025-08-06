# ===================================================================================
# STAGE 1: Builder - 애플리케이션을 빌드하기 위한 "작업장"
# 여기서는 빌드에 필요한 모든 도구(pnpm, typescript 등)를 포함하는 무거운 이미지를 사용합니다.
# ===================================================================================
FROM public.ecr.aws/sam/build-nodejs22.x:latest AS builder

WORKDIR /app

# pnpm 설치를 위해 corepack 활성화
RUN corepack enable

# 의존성 설치 레이어를 캐싱하기 위해, 먼저 package 관련 파일만 복사합니다.
COPY package.json pnpm-lock.yaml ./
# 모노레포의 다른 패키지를 참조할 수 있도록 워크스페이스 설정 파일도 복사합니다.
COPY ../../pnpm-workspace.yaml ./

# --frozen-lockfile을 사용하여 lock 파일과 정확히 일치하는 의존성만 설치합니다.
RUN pnpm install --frozen-lockfile

# 나머지 모든 소스 코드를 복사합니다.
COPY . .

# next build --standalone 명령어를 실행하여, .next/standalone 폴더를 생성합니다.
RUN pnpm run build


# ===================================================================================
# STAGE 2: Runner - 실제 Lambda에서 실행될 "최종 완성품"
# 여기서는 실행에 필요한 최소한의 것만 담는 가벼운 이미지를 사용합니다.
# ===================================================================================
FROM public.ecr.aws/lambda/nodejs:22

# Lambda Web Adapter를 설치합니다. (AWS 공식 권장)
# 이것이 Next.js 서버와 Lambda 이벤트를 연결해주는 "만능 번역기"입니다.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task

# 환경 변수 설정
# Lambda Web Adapter가 Next.js 서버를 찾을 수 있도록 포트를 지정합니다.
ENV PORT=3000
# Next.js가 프로덕션 모드로 실행되도록 합니다.
ENV NODE_ENV=production

# [핵심] Builder 스테이지의 빌드 결과물 중에서, 오직 '.next/standalone' 폴더만 복사해옵니다.
# 이를 통해 빌드에만 필요했던 무거운 파일들은 최종 이미지에서 제외됩니다.
COPY --from=builder /app/.next/standalone .

# Lambda가 실행될 때, Next.js 프로덕션 서버를 시작하는 명령어를 지정합니다.
# Web Adapter가 이 서버로 들어오는 요청을 자동으로 프록시해줍니다.
CMD ["node", "server.js"]
import type { NextConfig } from 'next';

const config: NextConfig = {
  // 기존 설정이 있다면 그대로 둡니다.
  // 이 옵션은 'next build' 실행 시, .next/standalone 디렉토리 안에
  // 프로덕션 서버 실행에 필요한 최소한의 파일들(node_modules 포함)만 모아서 출력해줍니다.
  // AWS Amplify Hosting과 같은 컨테이너 기반 배포 환경에서 이미지 크기를 최소화하고 안정성을 높이는 데 필수적입니다.
  output: 'standalone',
};

export default config;
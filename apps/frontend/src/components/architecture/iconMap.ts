// 파일 위치: apps/frontend/src/components/architecture/iconMap.ts
import { StaticImageData } from 'next/image';

// [수정] require 대신 동적 import()를 사용합니다.
// 이는 코드 스플리팅을 가능하게 하여, 필요한 아이콘만 클라이언트가 다운로드하도록 합니다.
export const iconMap: { [key: string]: () => Promise<{ default: StaticImageData }> } = {
  // AWS Icons
  ApiGateway: () => import('@/assets/icons/aws/ApiGateway.png'),
  Bedrock: () => import('@/assets/icons/aws/Bedrock.png'),
  Cdk: () => import('@/assets/icons/aws/Cdk.png'),
  CloudFront: () => import('@/assets/icons/aws/CloudFront.png'),
  CloudWatch: () => import('@/assets/icons/aws/CloudWatch.png'),
  Cognito: () => import('@/assets/icons/aws/Cognito.png'),
  DynamoDb: () => import('@/assets/icons/aws/DynamoDb.png'),
  Ec2: () => import('@/assets/icons/aws/Ec2.png'),
  Ecr: () => import('@/assets/icons/aws/Ecr.png'),
  EventBridge: () => import('@/assets/icons/aws/EventBridge.png'),
  Iam: () => import('@/assets/icons/aws/Iam.png'),
  Lambda: () => import('@/assets/icons/aws/Lambda.png'),
  OpenSearch: () => import('@/assets/icons/aws/OpenSearch.png'),
  Polly: () => import('@/assets/icons/aws/Polly.png'),
  S3: () => import('@/assets/icons/aws/S3.png'),
  Sns: () => import('@/assets/icons/aws/Sns.png'),
  XRay: () => import('@/assets/icons/aws/XRay.png'),

  // Generic Icons
  Docker: () => import('@/assets/icons/generic/Docker.png'),
  Github: () => import('@/assets/icons/generic/Github.png'),
  Globe: () => import('@/assets/icons/generic/Globe.png'),
  Sentry: () => import('@/assets/icons/generic/Sentry.png'),
  ShieldCheck: () => import('@/assets/icons/generic/ShieldCheck.png'),
};
#!/usr/-bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/InfraStack';

const app = new cdk.App();

new InfraStack(app, 'BlogInfraStack', {
  // [핵심] 리전 간 참조(Cross-Region Reference)를 활성화하기 위해,
  // 스택이 배포될 리전을 명시적으로 지정합니다.
  // 계정 ID는 CI/CD 환경 변수에서 자동으로 가져오도록 그대로 둡니다.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-northeast-2',
  },
  // [추가] 스택 이름에 대한 설명을 추가하여 가독성을 높입니다.
  description: 'Full-stack infrastructure for the new-blog project',
});
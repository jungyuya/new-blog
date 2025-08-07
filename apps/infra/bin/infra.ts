#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/InfraStack';

const app = new cdk.App();

// [핵심 최종 수정]
// 스택에 배포 대상 계정(account)과 지역(region)을 명시적으로 전달합니다.
// process.env.CDK_DEFAULT_ACCOUNT와 process.env.CDK_DEFAULT_REGION는
// CDK 실행 환경(로컬 CLI, GitHub Actions)에서 자동으로 주입되는 환경 변수입니다.
// 이 설정을 통해 CDK는 리전 간 리소스(예: us-east-1의 ACM 인증서) 조회를
// 안정적으로 수행할 수 있게 됩니다.
new InfraStack(app, 'BlogInfraStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
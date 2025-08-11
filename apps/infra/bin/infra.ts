#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlogStack } from '../lib/blog-stack';
import { CiCdStack } from '../lib/cicd-stack';

const app = new cdk.App();

// 환경 변수를 통해 배포 대상 계정과 리전을 명확히 합니다.
// 이는 리전 간 리소스(예: us-east-1의 ACM 인증서) 조회를 위해 필수적입니다.
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// 블로그 애플리케이션 인프라를 정의하는 스택
new BlogStack(app, 'BlogInfraStack', {
  env: env,
  description: 'Stack for the main blog application infrastructure (Frontend, Backend, DB, etc.)',
});

// CI/CD 지원 인프라를 정의하는 스택
new CiCdStack(app, 'CiCdStack', {
  env: env,
  description: 'Stack for the CI/CD support infrastructure (EC2 Self-Hosted Runner)',
});
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/InfraStack';

const app = new cdk.App();

// AWS 계정 ID와 리전을 환경 변수에서 가져오거나, 명시적으로 지정
// 우리는 이미 aws configure로 리전을 ap-northeast-2로 설정했으므로 생략 가능합니다.
// 하지만 계정 ID는 보안상 환경 변수로 관리하는 것이 좋습니다.
// 또는 cdk bootstrap 명령에서 계정 ID를 명시했으므로, 여기서는 hardcoding 대신 환경 변수 사용을 권장합니다.
// 그러나 첫 배포의 편의를 위해 여기에 직접 계정 ID를 입력하겠습니다.
const accountId = process.env.CDK_DEFAULT_ACCOUNT || '<YOUR_AWS_ACCOUNT_ID>'; // AWS 계정 ID 입력!
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-2'; // 서울 리전

new InfraStack(app, 'BlogInfraStack', {
  env: {
    account: accountId,
    region: region,
  },
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and Context lookups will not work.
   */

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlogStack } from '../lib/blog-stack';
// [추가] ImageProcessorStack을 import 합니다.
import { ImageProcessorStack } from '../lib/image-processor.stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// 1. BlogStack을 먼저 생성하고, 그 결과를 변수에 담습니다.
//    (나중에 ImageProcessorStack에 S3 버킷을 전달하기 위해 필요합니다.)
const blogStack = new BlogStack(app, 'BlogInfraStack', {
  env: env,
  description: 'Stack for the main blog application infrastructure (Frontend, Backend, DB, etc.)',
});

// 3. [신규 추가] ImageProcessorStack을 생성하고, blogStack의 의존성을 주입합니다.
new ImageProcessorStack(app, 'ImageProcessorStack', {
  env: env,
  description: 'Stack for the image processing microservice (Sharp Layer, Lambda)',
  // [핵심] BlogStack의 imageBucket을 sourceBucket prop으로 전달합니다.
  sourceBucket: blogStack.imageBucket,
});
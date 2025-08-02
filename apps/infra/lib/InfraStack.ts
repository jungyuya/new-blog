// ~/projects/new-blog/apps/infra/lib/InfraStack.ts
// [프로젝트 헌법] 제1조: 인프라 구성법 (최종 확정안)
// 최종 수정일: 2025년 8월 2일

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- 1. Cognito User Pool 정의 (사용자 인증 관리) ---
    const userPool = new cognito.UserPool(this, 'BlogUserPool', {
      userPoolName: `BlogUserPool-${this.stackName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('BlogAppClient', {
      userPoolClientName: 'WebAppClient',
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },

      // 기본값은 액세스 토큰 60분, ID 토큰 60분, 리프레시 토큰 30일입니다.
      // 테스트 편의를 위해 유효 시간을 늘립니다. (프로덕션 환경에서는 보안 정책에 맞게 조절해야 합니다.)
      accessTokenValidity: Duration.days(1), // 액세스 토큰 유효 시간을 1일로 설정
      idTokenValidity: Duration.days(1),     // ID 토큰 유효 시간을 1일로 설정
      refreshTokenValidity: Duration.days(90), // 리프레시 토큰 유효 시간을 90일로 설정

      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000', `https://blog.jungyu.store`],
        logoutUrls: ['http://localhost:3000', `https://blog.jungyu.store`],
      },
    });

    // --- 2. DynamoDB Table 정의 (싱글 테이블 디자인 적용) ---
    // ⭐ [헌법 수정] 제1항: DynamoDB 설계를 '싱글 테이블 디자인'으로 변경
    // 기존: postId를 Partition Key로 사용하는 단순 테이블
    // 변경: PK와 SK를 사용하는 복합 키 테이블로 변경하고, 3개의 GSI 추가
    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${this.stackName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // GSI 1: 특정 사용자의 게시물 최신순 조회용
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1_SK', type: dynamodb.AttributeType.STRING },
    });

    // GSI 2: 태그별 게시물 조회용
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2_SK', type: dynamodb.AttributeType.STRING },
    });

    // GSI 3: 전체 게시물 최신순 조회용
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3_SK', type: dynamodb.AttributeType.STRING },
    });


    // --- 3. Lambda Function (백엔드 API 로직) ---
    const monorepoRoot = path.join(__dirname, '..', '..', '..'); // infra -> apps -> root

    const backendApiLambda = new NodejsFunction(this, 'BackendApiLambda', {
      functionName: `blog-backend-api-${this.stackName}`,
      entry: path.join(monorepoRoot, 'apps', 'backend', 'src', 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        REGION: this.region,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        externalModules: [], // AWS SDK v3는 번들에 포함되어야 함
      },
    });

    // --- 4. Lambda 함수에 권한 부여 ---
    // DynamoDB 테이블 및 모든 GSI에 대한 읽기/쓰기 권한 부여
    postsTable.grantReadWriteData(backendApiLambda);

    // Cognito User Pool에 대한 권한 부여
    backendApiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:SignUp',
          'cognito-idp:InitiateAuth',
          'cognito-idp:GlobalSignOut',
          // 필요한 최소 권한만 부여하는 것이 원칙
        ],
        resources: [userPool.userPoolArn],
      })
    );

    // --- 5. API Gateway (HTTP API) 및 통합 ---
    const httpApi = new HttpApi(this, 'BlogHttpApiGateway', {
      apiName: `BlogHttpApi-${this.stackName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['*'],
        allowCredentials: true,
      },
    });

    const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', backendApiLambda);

    // ⭐ [헌법 수정] 제2항: API Gateway 라우팅을 '프록시 통합'으로 변경
    // 기존: 개별 경로를 CDK에서 모두 정의
    // 변경: 모든 경로({proxy+})와 모든 메서드(ANY)를 Lambda로 전달하여
    //       라우팅 책임을 Hono 프레임워크에 완전히 위임.
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // --- 6. CloudFormation Outputs (배포 결과물 출력) ---
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: httpApi.url!,
      description: 'HTTP API Gateway endpoint URL',
      exportName: `BlogApiGatewayUrl-${this.stackName}`,
    });
    new CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `BlogUserPoolId-${this.stackName}`,
    });
    new CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool App Client ID',
      exportName: `BlogUserPoolClientId-${this.stackName}`,
    });
    new CfnOutput(this, 'RegionOutput', {
      value: this.region,
      description: 'AWS Region',
      exportName: `BlogRegion-${this.stackName}`,
    });

    // --- 7. CloudWatch Alarms (모니터링 및 관측 가능성) ---
    backendApiLambda.metricErrors({ period: Duration.minutes(5) })
      .createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'Lambda function errors detected!',
      });

    httpApi.metricServerError({ period: Duration.minutes(5) })
      .createAlarm(this, 'ApiGatewayServerErrorAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'API Gateway 5xx server errors detected!',
      });
  }
}
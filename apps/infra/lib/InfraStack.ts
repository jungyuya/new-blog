// ~/projects/new-blog/apps/infra/lib/InfraStack.ts

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';

// AWS Lambda 관련 임포트
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

// AWS API Gateway v2 관련 임포트
// ⭐ 완벽 수정: Jungyu님께서 제시해주신 정확한 임포트 경로입니다. ⭐
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

// AWS Cognito 관련 임포트
import * as cognito from 'aws-cdk-lib/aws-cognito';

// AWS DynamoDB 관련 임포트
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// AWS IAM (Identity and Access Management) 관련 임포트
import * as iam from 'aws-cdk-lib/aws-iam';

// Node.js path 모듈 임포트 (파일 경로 처리)
import * as path from 'path';

// AWS S3 (Simple Storage Service) 관련 임포트
import * as s3 from 'aws-cdk-lib/aws-s3';

// AWS CloudWatch (모니터링) 관련 임포트
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

// Construct 라이브러리 임포트 (CDK의 기본 빌딩 블록)
import { Construct } from 'constructs';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- 1. Cognito User Pool 정의 (사용자 인증 관리) ---
    // Cognito User Pool은 사용자 계정을 관리하고 인증 기능을 제공하는 서비스입니다.
    const userPool = new cognito.UserPool(this, 'BlogUserPool', {
      userPoolName: `BlogUserPool-${cdk.Aws.ACCOUNT_ID}`, // 계정 ID를 포함하여 고유한 이름 생성
      selfSignUpEnabled: true, // 사용자가 직접 회원가입할 수 있도록 허용
      signInAliases: { email: true, username: false }, // 이메일로 로그인하고, 사용자 이름은 사용하지 않음
      autoVerify: { email: true }, // 이메일 주소 자동 인증 (회원가입 후 확인 이메일 발송)
      standardAttributes: {
        email: { required: true, mutable: true }, // 이메일은 필수 속성이며 변경 가능
      },
      passwordPolicy: { // 비밀번호 정책 설정 (보안 강화)
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 스택 삭제 시 User Pool도 함께 삭제 (개발 환경에서만 사용)
    });

    // User Pool에 연결될 클라이언트 앱 (프론트엔드 앱) 정의
    const userPoolClient = userPool.addClient('BlogAppClient', {
      userPoolClientName: 'WebAppClient',
      generateSecret: false, // 클라이언트 시크릿을 생성하지 않음 (일반적인 웹 앱에서는 불필요)
      authFlows: { userSrp: true, userPassword: true }, // Amplify SDK와 연동 시 필요
      // OAuth 설정 (선택 사항이지만, 소셜 로그인 연동 등을 고려할 때 유용)
      oAuth: {
        flows: { authorizationCodeGrant: true }, // 권한 부여 코드 흐름 사용
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000', 'https://blog.jungyu.store'], // 로그인 후 리다이렉트될 URL
        logoutUrls: ['http://localhost:3000', 'https://blog.jungyu.store'], // 로그아웃 후 리다이렉트될 URL
      },
    });

    // --- 2. DynamoDB Posts Table 정의 (게시물 데이터 저장) ---
    // DynamoDB는 서버리스 NoSQL 데이터베이스로, 사용량에 따라 과금되어 비용 효율적입니다.
    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${cdk.Aws.ACCOUNT_ID}`, // 계정 ID를 포함하여 고유한 테이블 이름 생성
      partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING }, // 'postId'를 기본 키로 설정
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 요청 시 지불 모드 (트래픽에 따라 비용 지불)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 스택 삭제 시 테이블도 함께 삭제 (개발 환경에서만 사용)
    });

    // --- 3. S3 버킷 정의 (Lambda 코드 에셋 업로드용) ---
    // CDK가 Lambda 코드를 S3에 업로드할 때 사용하는 내부 버킷입니다.
    const artifactBucketName = `blog-lambda-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;
    const artifactBucket = new s3.Bucket(this, 'BlogArtifactBucket', {
      bucketName: artifactBucketName,
      versioned: true, // 버전 관리 활성화 (코드 변경 이력 추적에 용이)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 스택 삭제 시 버킷도 삭제 (개발 환경)
      autoDeleteObjects: true, // 버킷 내 객체도 함께 자동 삭제 (개발 환경)
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // 모든 퍼블릭 접근 차단 (보안 강화)
      lifecycleRules: [{ enabled: true, expiration: Duration.days(30) }], // 30일 후 객체 자동 삭제 (비용 절감)
    });

    // --- 4. IAM Role 정의 및 권한 부여 (Lambda 함수가 AWS 서비스에 접근하기 위한 권한) ---
    const backendApiLambdaRole = new iam.Role(this, 'BackendApiLambdaServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // Lambda 서비스가 이 역할을 맡을 수 있도록 허용
      managedPolicies: [
        // Lambda 기본 실행 권한 (CloudWatch Logs에 로그를 쓸 수 있는 권한)
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // DynamoDB 테이블에 대한 읽기/쓰기 권한 부여
    postsTable.grantReadWriteData(backendApiLambdaRole);
    
    // Cognito User Pool에 대한 권한 부여 (사용자 인증 API 호출을 위함)
    backendApiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          // 모든 IAM 권한은 최소 권한 원칙(Least Privilege Principle)을 따르는 것이 중요합니다.
          // 현재는 개발 단계이므로 넓은 권한을 부여하지만, 프로덕션 환경에서는 필요한 권한만 부여해야 합니다.
          'cognito-idp:SignUp',
          'cognito-idp:InitiateAuth',
          'cognito-idp:RespondToAuthChallenge',
          'cognito-idp:GlobalSignOut',
          'cognito-idp:AdminInitiateAuth', 
          'cognito-idp:AdminRespondToAuthChallenge',
          'cognito-idp:AdminUserGlobalSignOut',
        ],
        resources: [userPool.userPoolArn], // 특정 User Pool에만 권한 부여
      })
    );

    // --- 5. Lambda Function (NodejsFunction을 사용하여 코드 번들링 및 업로드) ---
    // NodejsFunction은 TypeScript 코드를 자동으로 번들링하고 Lambda에 최적화하여 배포해줍니다.
    // 이는 모노레포 구조에서 백엔드 코드를 효율적으로 관리하고 배포하는 데 큰 이점이 있습니다.
    const monorepoRoot = path.join(__dirname, '../../../'); // 모노레포의 최상위 경로를 계산 (apps/infra/lib -> apps/infra -> apps -> new-blog)

    const backendApiLambda = new NodejsFunction(this, 'BackendApiLambda', {
      functionName: 'blog-backend-api-lambda', // Lambda 함수 이름 (AWS 콘솔에서 식별 용이)
      entry: path.join(
        monorepoRoot,
        'apps',
        'backend',
        'src',
        'index.ts'
      ), // Lambda 핸들러 파일의 경로 (반드시 존재해야 함)
      handler: 'handler', // 핸들러 함수 이름 (index.ts 파일의 export const handler)
      runtime: Runtime.NODEJS_22_X, // ⭐ Node.js 런타임을 22.x로 설정합니다. ⭐
      memorySize: 256, // 람다 함수 메모리 설정 (기본 128MB, 필요시 증가시켜 성능 향상)
      timeout: Duration.seconds(30), // 람다 함수 타임아웃 설정 (최대 15분, 적절히 조절)
      environment: { // 람다 함수 내에서 사용할 환경 변수 정의
        NODE_ENV: 'production', // 운영 환경임을 나타냄
        TABLE_NAME: postsTable.tableName, // DynamoDB 테이블 이름을 Lambda에서 사용
        USER_POOL_ID: userPool.userPoolId, // Cognito User Pool ID를 Lambda에서 사용
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId, // Cognito User Pool Client ID를 Lambda에서 사용
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1', // AWS SDK 연결 재사용 활성화 (콜드 스타트 성능 최적화)
      },
      tracing: lambda.Tracing.ACTIVE, // AWS X-Ray 트레이싱 활성화 (Lambda 함수 호출 및 서비스 간 연동 추적)
      role: backendApiLambdaRole, // 위에서 정의한 IAM Role 부여
      bundling: { // 코드 번들링 설정 (esbuild를 사용)
        minify: true, // 코드 압축 (파일 크기 감소 및 콜드 스타트 시간 단축)
        // ⭐ 완벽 수정: externalModules를 비워 Lambda 번들에 모든 의존성 포함 ⭐
        // AWS SDK v3는 람다 런타임에 기본 포함되지 않으므로, 번들에 포함되어야 합니다.
        // 'uuid'는 필요한 경우 번들에 포함시키거나 별도 레이어로 관리합니다.
        // 현재는 'uuid'도 번들에 포함되도록 externalModules에서 제거합니다.
        externalModules: [], // 이제 어떤 외부 모듈도 명시적으로 제외하지 않습니다.
        // ⭐ 완벽 수정: depsLockFilePath 및 projectRoot 속성 제거 (오류 발생 원인) ⭐
        // 이 속성들은 NodejsFunction의 BundlingOptions에 존재하지 않아 오류를 발생시킵니다.
        // pnpm 모노레포 환경에서도 NodejsFunction은 대부분의 경우 이 속성 없이 의존성을 올바르게 번들링합니다.
      },
    });

    // --- 6. API Gateway (HTTP API) 및 통합 ---
    // HttpApi는 RestApi (v1)에 비해 더 간단하고, 비용 효율적이며, 최신 웹 API에 적합합니다.
    const httpApi = new HttpApi(this, 'BlogHttpApiGateway', {
      apiName: `BlogHttpApi-${cdk.Aws.ACCOUNT_ID}`, // API 이름 (AWS 콘솔에서 식별 용이)
      // CORS(Cross-Origin Resource Sharing) 설정: 웹 브라우저 보안 정책에 따라 다른 도메인에서의 API 호출을 허용
      corsPreflight: { 
        allowOrigins: ['http://localhost:3000', 'https://blog.jungyu.store'], // 허용할 프론트엔드 도메인
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ], // 허용할 HTTP 메서드
        allowHeaders: ['*'], // 모든 헤더 허용 (필요에 따라 구체화)
        allowCredentials: true, // 자격 증명 (쿠키, 인증 헤더) 허용 (Cognito 인증 시 필수)
      },
    });

    // Lambda 함수와 API Gateway를 연결하는 통합 정의
    const lambdaIntegration = new HttpLambdaIntegration(
      'LambdaIntegration',
      backendApiLambda
    );

    // Cognito JWT Authorizer 정의 (HttpApi용)
    const authorizer = new HttpUserPoolAuthorizer(
      'BlogUserPoolAuthorizer',
      userPool,
      {
        userPoolClients: [userPoolClient], // 이 Authorizer가 사용할 User Pool 클라이언트
        identitySource: ['$request.header.Authorization'], // 인증 토큰(JWT)을 Authorization 헤더에서 가져옴
      }
    );

    // API Gateway 라우트 정의 (경로와 HTTP 메서드)
    // 인증이 필요 없는 공개 라우트 (Public Routes)
    const publicRoutes = [
      { path: '/hello', methods: [HttpMethod.GET] },
      { path: '/auth/signup', methods: [HttpMethod.POST] },
      { path: '/auth/login', methods: [HttpMethod.POST] },
      { path: '/posts', methods: [HttpMethod.GET] },
      { path: '/posts/{id}', methods: [HttpMethod.GET] },
    ];

    publicRoutes.forEach(route => {
      httpApi.addRoutes({
        integration: lambdaIntegration,
        path: route.path,
        methods: route.methods,
      });
    });

    // 인증이 필요한 라우트 (Authenticated Routes) - Cognito Authorizer 적용
    const authenticatedRoutes = [
      { path: '/auth/logout', methods: [HttpMethod.POST] },
      { path: '/posts', methods: [HttpMethod.POST] },
      { path: '/posts/{id}', methods: [HttpMethod.PUT] },
      { path: '/posts/{id}', methods: [HttpMethod.DELETE] },
    ];

    authenticatedRoutes.forEach(route => {
      httpApi.addRoutes({
        integration: lambdaIntegration,
        path: route.path,
        methods: route.methods,
        authorizer, // 위에서 정의한 Authorizer 적용
      });
    });

    // --- 7. CloudFormation Outputs (프론트엔드에서 사용할 백엔드 정보) ---
    // CfnOutput은 CloudFormation 스택 배포 후 외부에 노출되는 값들입니다.
    // 프론트엔드에서 이 값들을 사용하여 백엔드 API 및 Cognito에 연결할 수 있습니다.
    // exportName은 다른 CloudFormation 스택이나 서비스에서 이 값을 참조할 수 있도록 합니다.
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: httpApi.url!, // HttpApi의 URL (마지막 '!'는 TypeScript에게 값이 항상 존재함을 알림)
      description: 'HTTP API Gateway endpoint URL',
      exportName: 'BlogApiGatewayUrl', // 프론트엔드에서 참조할 이름 (Amplify CLI가 자동 가져올 때 사용)
    });
    new CfnOutput(this, 'ApiGatewayId', {
      value: httpApi.apiId, // HttpApi의 ID
      description: 'HTTP API Gateway ID',
      exportName: 'BlogHttpApiId', 
    });
    new CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'BlogUserPoolId',
    });
    new CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool App Client ID',
      exportName: 'BlogUserPoolClientId',
    });
    new CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName,
      description: 'S3 bucket name for Lambda artifacts',
      exportName: 'BlogArtifactBucketName',
    });

    // --- 8. CloudWatch Alarms (모니터링 및 관측 가능성 강화) ---
    // 이 알람들은 AWS CloudWatch에서 설정되며, 특정 임계값을 넘으면 알림을 받을 수 있습니다.
    // Lambda 함수 오류 알람
    backendApiLambda
      .metricErrors({ period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
        threshold: 1, // 5분 동안 1회 이상 오류 발생 시 알람
        evaluationPeriods: 1, 
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'blog-backend-api-lambda function errors detected!',
      });

    // API Gateway 5xx 서버 에러 알람
    httpApi
      .metricServerError({ period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'ApiGatewayServerErrorAlarm', {
        threshold: 1, // 5분 동안 1회 이상 5xx 에러 발생 시 알람
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'API Gateway 5xx server errors detected!',
      });

    // DynamoDB 테이블 읽기/쓰기 스로틀링 알람 (성능 문제 감지)
    // 스로틀링은 DynamoDB가 설정된 용량을 초과하여 요청을 처리할 수 없을 때 발생합니다.
    postsTable
      .metric('ReadThrottleEvents', { period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'PostsTableReadThrottleAlarm', {
        threshold: 1, // 5분 동안 1회 이상 읽기 스로틀링 발생 시 알람
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'DynamoDB PostsTable read throttled!',
      });

    postsTable
      .metric('WriteThrottleEvents', {
        period: Duration.minutes(5),
        statistic: 'Sum',
      })
      .createAlarm(this, 'PostsTableWriteThrottleAlarm', {
        threshold: 1, // 5분 동안 1회 이상 쓰기 스로틀링 발생 시 알람
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'DynamoDB PostsTable write throttled!',
      });
  }
}
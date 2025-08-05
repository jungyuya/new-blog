// apps/infra/lib/InfraStack.ts
// [프로젝트 헌법] 제1조 및 제3조: 인프라 구성법 (Phase 5: 재건축 최종안)
// 최종 수정일: 2025년 8월 5일
// 'Nextjs' Construct를 포기하고, CDK 기본 요소를 사용하여 명시적으로 인프라를 제어합니다.

// ---------------------------
// 1. CDK 및 AWS 서비스 모듈 Import
// ---------------------------
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

// --- 백엔드 리소스 ---
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as iam from 'aws-cdk-lib/aws-iam';

// --- 프론트엔드 리소스 (재건축의 핵심) ---
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';

// --- 모니터링 ---
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

// ---------------------------
// 2. CDK 스택 클래스 정의
// ---------------------------
export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const projectRoot = path.join(__dirname, '..', '..', '..');

    // [핵심] CI/CD 파이프라인으로부터 Lambda Layer의 ARN을 전달받기 위한 파라미터를 정의합니다.
    const layerArnParameter = new CfnParameter(this, 'layerArn', {
      type: 'String',
      description: 'The ARN of the Lambda Layer containing frontend node_modules.',
    });

    // ===================================================================================
    // SECTION 1: 백엔드 리소스 정의 (변경 없음)
    // 이 섹션은 기존과 동일하게 안정적으로 동작합니다.
    // ===================================================================================

    // --- 1.1. Cognito User Pool (사용자 인증 시스템) ---
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
      accessTokenValidity: Duration.days(1),
      idTokenValidity: Duration.days(1),
      refreshTokenValidity: Duration.days(90),
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000', `https://blog.jungyu.store`],
        logoutUrls: ['http://localhost:3000', `https://blog.jungyu.store`],
      },
    });

    // --- 1.2. DynamoDB Table (데이터 저장소) ---
    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${this.stackName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // [핵심 수정] 첫 배포를 위해 모든 GSI 정의를 잠시 주석 처리합니다.
    // 나중에 필요할 때, 하나씩 주석을 해제하고 배포하면 됩니다.
    /*
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1_SK', type: dynamodb.AttributeType.STRING },
    });
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2_SK', type: dynamodb.AttributeType.STRING },
    });
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3_SK', type: dynamodb.AttributeType.STRING },
    });
    */

    // --- 1.3. Lambda Function (API 비즈니스 로직) ---
    const backendPackageJsonPath = path.join(projectRoot, 'apps', 'backend', 'package.json');
    const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
    const backendVersion = backendPackageJson.version;

    const backendApiLambda = new NodejsFunction(this, 'BackendApiLambda', {
      functionName: `blog-backend-api-${this.stackName}`,
      entry: path.join(projectRoot, 'apps', 'backend', 'src', 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        REGION: this.region,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        BACKEND_VERSION: backendVersion,
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: { minify: true, externalModules: [] },
    });

    // --- 1.4. Lambda IAM Permissions (권한 부여) ---
    postsTable.grantReadWriteData(backendApiLambda);
    backendApiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${postsTable.tableArn}/index/*`],
      })
    );
    backendApiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:SignUp', 'cognito-idp:InitiateAuth', 'cognito-idp:GlobalSignOut'],
        resources: [userPool.userPoolArn],
      })
    );

    // --- 1.5. API Gateway (외부 통신 게이트웨이) ---
    const httpApi = new HttpApi(this, 'BlogHttpApiGateway', {
      apiName: `BlogHttpApi-${this.stackName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE, CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });
    const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', backendApiLambda);
    const authorizer = new HttpUserPoolAuthorizer('BlogUserPoolAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
      identitySource: ['$request.header.Authorization'],
    });

    httpApi.addRoutes({ path: '/auth/signup', methods: [HttpMethod.POST], integration: lambdaIntegration });
    httpApi.addRoutes({ path: '/auth/login', methods: [HttpMethod.POST], integration: lambdaIntegration });
    httpApi.addRoutes({ path: '/posts', methods: [HttpMethod.GET], integration: lambdaIntegration });
    httpApi.addRoutes({ path: '/posts/{postId}', methods: [HttpMethod.GET], integration: lambdaIntegration });
    httpApi.addRoutes({ path: '/hello', methods: [HttpMethod.GET], integration: lambdaIntegration });
    httpApi.addRoutes({ path: '/auth/logout', methods: [HttpMethod.POST], integration: lambdaIntegration, authorizer });
    httpApi.addRoutes({ path: '/posts', methods: [HttpMethod.POST], integration: lambdaIntegration, authorizer });
    httpApi.addRoutes({ path: '/posts/{postId}', methods: [HttpMethod.PUT, HttpMethod.DELETE], integration: lambdaIntegration, authorizer });


    // ===================================================================================
    // SECTION 2: 프론트엔드 리소스 정의 (전면 재설계 - 버전 호환 최종안)
    // ===================================================================================

    // --- 2.0. 도메인 및 인증서 준비 ---
    const domainName = 'jungyu.store';
    const siteDomain = `blog.${domainName}`;
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName });
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', 'arn:aws:acm:us-east-1:786382940028:certificate/d8aa46d8-b8dc-4d1b-b590-c5d4a52b7081');

    // --- 2.1. S3 Bucket:  ---
    const assetsBucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    // --- 2.2. Next.js Server Lambda Function ---
    const serverLambda = new lambda.Function(this, 'FrontendServerLambda', {
      functionName: `blog-frontend-server-${this.stackName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      // [핵심] 코드 경로는 이제 node_modules가 제외된, 순수한 애플리케이션 코드만 담고 있습니다.
      code: lambda.Code.fromAsset(path.join(projectRoot, 'apps/frontend/.open-next/server-functions/default')),
      memorySize: 1024,
      timeout: Duration.seconds(10),
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'DependenciesLayer', layerArnParameter.valueAsString)
      ],
      environment: {
        NEXT_PUBLIC_API_ENDPOINT: httpApi.url!,
        NEXT_PUBLIC_REGION: this.region,
        NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
    assetsBucket.grantRead(serverLambda);

    // --- 2.2.1. Lambda 함수 URL 생성 ---
    const serverLambdaUrl = serverLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // --- 2.3. CloudFront Distribution ---
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      domainNames: [siteDomain],
      certificate: certificate,
      defaultBehavior: {
        origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', serverLambdaUrl.url))),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      additionalBehaviors: {
        '_next/*': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        'assets/*': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });

    // --- 2.4. S3 Bucket Deployment ---
    new s3deploy.BucketDeployment(this, 'DeployFrontendAssets', {
      // [핵심 최종 수정] 여기도 마찬가지로, Docker 번들링을 제거하고 단순 경로 지정을 사용합니다.
      sources: [s3deploy.Source.asset(path.join(projectRoot, 'apps/frontend/.open-next/assets'))],
      destinationBucket: assetsBucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });
    // --- 2.5. Route 53 Record 생성 ---
    new route53.ARecord(this, 'SiteARecord', {
      recordName: siteDomain,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // ===================================================================================
    // SECTION 3: 스택 출력 및 모니터링
    // ===================================================================================

    // --- 3.1. CloudFormation Outputs (배포 결과물) ---
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: httpApi.url!,
      description: 'HTTP API Gateway endpoint URL',
    });
    new CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });
    new CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool App Client ID',
    });
    new CfnOutput(this, 'RegionOutput', {
      value: this.region,
      description: 'AWS Region',
    });
    new CfnOutput(this, 'FrontendURL', {
      value: `https://${distribution.distributionDomainName}`, // CloudFront 도메인을 출력
      description: 'URL of the frontend CloudFront distribution',
    });

    // --- 3.2. CloudWatch Alarms (모니터링) ---
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
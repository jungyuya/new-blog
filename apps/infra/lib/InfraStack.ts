// apps/infra/lib/InfraStack.ts
// [프로젝트 헌법] 제1조 및 제3조: 인프라 구성법 (Phase 5: 최종 완성본)
// 최종 수정일: 2025년 8월 6일
// CDK가 Docker 이미지를 직접 빌드하고 ECR에 푸시하며, 모든 인프라를 원자적으로 관리합니다.

// ---------------------------
// 1. CDK 및 AWS 서비스 모듈 Import
// ---------------------------
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const projectRoot = path.join(__dirname, '..', '..', '..');

    const imageTag = new CfnParameter(this, 'ImageTag', {
      type: 'String',
      description: 'The ECR image tag to deploy.',
    });

    // ===================================================================================
    // SECTION 1: 백엔드 리소스 정의 (변경 없음)
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

    // [핵심] 첫 배포를 위해 모든 GSI정의를 잠시 주석 처리합니다.
    /*
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1_SK', type: dynamodb.AttributeType.STRING },
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
    // SECTION 2: 프론트엔드 리소스 정의 (CDK 직접 빌드 최종안)
    // ===================================================================================

    // --- 2.0. 도메인 및 인증서 준비 (변경 없음) ---
    const domainName = 'jungyu.store';
    const siteDomain = `blog.${domainName}`;

    // [핵심 최종 수정] fromLookup 대신 fromHostedZoneAttributes를 사용합니다.
    // CI/CD 환경에서 불안정한 fromLookup의 자동 조회를 포기하고,
    // 우리가 이미 알고 있는 정확한 Hosted Zone ID를 직접 주입합니다.
    // 이를 통해 불확실성을 완전히 제거합니다.
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z0802600EUJ1KX823IZ7', // Jungyu님의 'jungyu.store' Hosted Zone ID
      zoneName: domainName,
    });

    // 인증서 조회는 fromCertificateArn이 비교적 안정적이므로 그대로 둡니다.
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', 'arn:aws:acm:us-east-1:786382940028:certificate/d8aa46d8-b8dc-4d1b-b590-c5d4a52b7081');
    // --- 2.1. S3 Bucket for Static Assets (변경 없음) ---
    const assetsBucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    // [핵심 변경 2] ECR 저장소를 이름으로 참조합니다.
    // CDK는 더 이상 저장소를 직접 만들거나 관리하지 않고, 이미 존재하는 저장소를 이름으로 찾아옵니다.
    // 'new-blog-frontend'는 우리가 Step 1에서 콘솔로 생성한 리포지토리 이름과 정확히 일치해야 합니다.
    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'FrontendEcrRepo', 'new-blog-frontend');

    // --- 2.2. Next.js Server Lambda (CDK가 직접 빌드) ---
    // [주의!] 이 부분은 아직 수정 전의 코드입니다. Part 2에서 최종 수정될 예정입니다.
    const serverLambda = new lambda.DockerImageFunction(this, 'FrontendServerLambda', {
      functionName: `blog-frontend-server-${this.stackName}`,

      // [핵심 최종 변경] fromImageAsset을 fromEcrImage로 교체합니다.
      // 이제 CDK는 빌드 과정에 전혀 관여하지 않고, 오직 ECR에 이미 존재하는 이미지를
      // 이름과 "송장 번호(imageTag)"를 사용하여 참조하기만 합니다.
      code: lambda.DockerImageCode.fromEcr(ecrRepository, {
        tagOrDigest: imageTag.valueAsString,
      }),

      memorySize: 1024,
      timeout: Duration.seconds(30),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        // AWS_LAMBDA_EXEC_WRAPPER와 PORT는 Dockerfile에서 이미 설정했으므로 여기서도 명시해 일관성을 유지합니다.
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/extensions/lambda-adapter',
        PORT: '3000',
        // 나머지 환경변수는 그대로 유지합니다.
        NEXT_PUBLIC_API_ENDPOINT: httpApi.url!,
        NEXT_PUBLIC_REGION: this.region,
        NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
    assetsBucket.grantRead(serverLambda);
    const serverLambdaUrl = serverLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
    // --- 2.3. CloudFront Distribution ---
    // [핵심 수정] Lambda Function URL에서 'https://' 프로토콜 부분을 제거합니다.
    // 이렇게 하면 CDK의 HttpOrigin이 이 주소를 일반적인 웹 서버 도메인으로 인식하여,
    // Origin Type을 'Custom Origin'으로 올바르게 설정합니다.
    const serverUrl = cdk.Fn.select(2, cdk.Fn.split('/', serverLambdaUrl.url));

    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      domainNames: [siteDomain],
      certificate: certificate,
      defaultBehavior: {
        // [핵심 수정] HttpOrigin 생성자에 가공된 URL을 전달합니다.
        origin: new origins.HttpOrigin(serverUrl, {
          // [핵심 추가] Lambda Function URL은 HTTPS만 지원하므로, 프로토콜 정책을 명시합니다.
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // [핵심 수정] 캐시 정책과 원본 요청 정책을 Lambda Web Adapter 권장안으로 변경합니다.
        // 이 정책들은 인증 헤더(Authorization)와 같은 중요한 정보들을 Lambda로 안전하게 전달합니다.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      // ... additionalBehaviors 부분은 변경 없습니다 ...
      additionalBehaviors: {
        '/_next/static/*': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/assets/*': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/api/*': {
          origin: new origins.HttpOrigin(httpApi.url!.replace('https://', '').replace('/', '')),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });


    // --- 2.4. S3 Bucket Deployment (변경 없음) ---
    const deployment = new s3deploy.BucketDeployment(this, 'DeployFrontendAssets', {
      sources: [s3deploy.Source.asset(path.join(projectRoot, 'apps/frontend/.next/static'))],
      destinationBucket: assetsBucket,
      destinationKeyPrefix: '_next/static',
      distribution: distribution,
      distributionPaths: ['/_next/static/*'],
    });

    // [핵심 최종 수정] 명시적인 의존성을 추가합니다.
    deployment.node.addDependency(distribution);

    // --- 2.5. Route 53 Record 생성 (변경 없음) ---
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
      value: `https://${distribution.distributionDomainName}`,
      description: 'URL of the frontend CloudFront distribution',
    });

    // --- 3.2. CloudWatch Alarms (모니터링) ---
    backendApiLambda.metricErrors({ period: Duration.minutes(5) })
      .createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'Lambda function errors detected!',
      });
    httpApi.metricServerError({ period: Duration.minutes(5) })
      .createAlarm(this, 'ApiGatewayServerErrorAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'API Gateway 5xx server errors detected!',
      });
  }
}
// 파일 위치: apps/infra/lib/InfraStack.ts
// 최종 버전: v2025.08.08-GrandFinale
// 역할: 프로젝트의 모든 AWS 인프라를 정의하는, 보안과 모범 사례가 집대성된 단 하나의 진실 공급원

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // CI/CD 파이프라인으로부터 Docker 이미지 태그를 전달받기 위한 CloudFormation 파라미터
    const imageTag = new CfnParameter(this, 'ImageTag', {
      type: 'String',
      description: 'The ECR image tag to deploy for the frontend server.',
    });

    // ===================================================================================
    // SECTION 1: 백엔드 리소스 정의
    // ===================================================================================

    // --- 1.1. Cognito User Pool: 사용자 인증 및 관리 ---
    const userPool = new cognito.UserPool(this, 'BlogUserPool', {
      userPoolName: `BlogUserPool-${this.stackName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
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

    // --- 1.2. DynamoDB Table: 애플리케이션 데이터 저장소 ---
    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${this.stackName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // GSI는 AWS 제약에 따라 단계적으로 생성합니다.
    // 현재 백엔드 코드가 전체 게시물 조회를 위해 'GSI3'를 즉시 필요로 하므로,
    // 이번 초기 배포에서는 GSI3만 먼저 생성합니다.
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3_SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- 1.3. 백엔드 Lambda 함수: API 비즈니스 로직 ---
    const projectRoot = path.join(__dirname, '..', '..', '..');
    const backendPackageJsonPath = path.join(projectRoot, 'apps', 'backend', 'package.json');
    const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
    const backendVersion = backendPackageJson.version;

    const backendApiLambda = new NodejsFunction(this, 'BackendApiLambda', {
      functionName: `blog-backend-api-${this.stackName}`,
      description: 'Handles all backend API logic (CRUD, Auth, etc.) via Hono.',
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
    });
    postsTable.grantReadWriteData(backendApiLambda);
    backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:SignUp', 'cognito-idp:InitiateAuth', 'cognito-idp:GlobalSignOut'],
      resources: [userPool.userPoolArn],
    }));

    // --- 1.4. API Gateway: 백엔드 API를 외부에 노출 ---
    const httpApi = new HttpApi(this, 'BlogHttpApiGateway', {
      apiName: `BlogHttpApi-${this.stackName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    httpApi.addRoutes({ path: '/{proxy+}', integration: new HttpLambdaIntegration('LambdaIntegration', backendApiLambda) });

    // ===================================================================================
    // SECTION 2: 프론트엔드 리소스 정의
    // ===================================================================================
    const domainName = 'jungyu.store';
    const siteDomain = `blog.${domainName}`;
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', { hostedZoneId: 'Z0802600EUJ1KX823IZ7', zoneName: domainName });
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', 'arn:aws:acm:us-east-1:786382940028:certificate/d8aa46d8-b8dc-4d1b-b590-c5d4a52b7081');

    const assetsBucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'FrontendEcrRepo', 'new-blog-frontend');

    const serverLambda = new lambda.DockerImageFunction(this, 'FrontendServerLambda', {
      functionName: `blog-frontend-server-${this.stackName}`,
      description: 'Renders the Next.js frontend application (SSR).',
      code: lambda.DockerImageCode.fromEcr(ecrRepository, { tagOrDigest: imageTag.valueAsString }),
      memorySize: 1024,
      timeout: Duration.seconds(30),
      architecture: lambda.Architecture.X86_64,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/extensions/lambda-adapter',
        PORT: '3000',
        NEXT_PUBLIC_API_ENDPOINT: httpApi.url!,
        NEXT_PUBLIC_REGION: this.region,
        NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
    const serverLambdaUrl = serverLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      // [추가] CORS 설정을 Function URL 수준에서도 명시적으로 허용합니다.
      // CloudFront 외에 로컬 테스트 등 다른 환경에서의 호출 가능성을 열어둡니다.
      cors: {
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
        allowedHeaders: ['*'],
      }
    });

    const oac = new cloudfront.CfnOriginAccessControl(this, 'LambdaOriginAccessControl', {
      originAccessControlConfig: {
        name: `OAC-for-Lambda-${this.stackName}`,
        originAccessControlOriginType: 'lambda',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // [핵심 수정 2] Lambda Origin을 생성합니다.
    const lambdaOrigin = new origins.FunctionUrlOrigin(serverLambdaUrl);

    const s3Origin = new origins.S3Origin(assetsBucket);

    const distribution = new cloudfront.Distribution(this, 'NewFrontendDistribution', {
      domainNames: [siteDomain],
      certificate: certificate,
      comment: `Distribution for ${siteDomain}`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: lambdaOrigin, // 기본 Origin은 Lambda
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin: s3Origin, // 정적 파일은 S3 Origin
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/assets/*': {
          origin: s3Origin, // 에셋 파일도 S3 Origin
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    // [핵심 수정 4] 생성된 Distribution(L2)의 내부 CfnDistribution(L1) 속성을 직접 덮어씁니다.
    // 이것이 바로 L2 구성 요소에 L1의 세부 설정을 주입하는 정석적인 방법입니다.
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;

    // Lambda Origin에 OAC ID를 설정합니다. (Origin 목록의 첫 번째가 Lambda Origin)
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', oac.attrId);

    // S3 Origin에는 OAC를 사용하지 않으므로, 명시적으로 빈 문자열로 설정하여 OAI와의 혼동을 방지합니다.
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.OriginAccessControlId', '');
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.2.OriginAccessControlId', '');

    // S3 Origin에 대해서는 기존의 OAI를 사용하지 않도록 S3OriginConfig를 제거합니다.
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity', '');
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.2.S3OriginConfig.OriginAccessIdentity', '');

    new route53.ARecord(this, 'NewSiteARecord', {
      recordName: 'blog',
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // ===================================================================================
    // SECTION 3: CI/CD 파이프라인을 위한 권한 부여
    // ===================================================================================
    const GITHUB_ACTIONS_ROLE_NAME_FOR_CONTENT = 'ContentDeployRole';
    const contentDeployRole = iam.Role.fromRoleName(this, 'ContentDeployRole', GITHUB_ACTIONS_ROLE_NAME_FOR_CONTENT);

    // S3 버킷에 대한 읽기/쓰기 권한을 부여합니다. (이 부분은 정상 작동)
    assetsBucket.grantReadWrite(contentDeployRole);

    // [핵심 최종 수정] CloudFront 캐시 무효화 권한을 수동으로, 그리고 명시적으로 부여합니다.
    // distribution.grantInvalidate(contentDeployRole); // 이 메서드는 존재하지 않으므로 삭제합니다.

    // 새로운 IAM 정책을 생성합니다.
    const invalidatePolicy = new iam.Policy(this, 'InvalidatePolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cloudfront:CreateInvalidation'],
          // 이 정책이 적용될 리소스, 즉 우리의 CloudFront 배포의 ARN을 정확히 지정합니다.
          resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
        }),
      ],
    });

    // 생성된 정책을, 우리가 참조한 contentDeployRole에 연결(attach)합니다.
    contentDeployRole.attachInlinePolicy(invalidatePolicy);

    // ===================================================================================
    // SECTION 4: 스택 출력
    // ===================================================================================
    new CfnOutput(this, 'ApiGatewayEndpoint', { value: httpApi.url!, description: 'HTTP API Gateway endpoint URL' });
    new CfnOutput(this, 'FrontendURL', { value: `https://${distribution.distributionDomainName}`, description: 'URL of the frontend CloudFront distribution' });
    new CfnOutput(this, 'FrontendAssetsBucketName', { value: assetsBucket.bucketName, description: 'Name of the S3 bucket for frontend static assets.' });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId, description: 'ID of the CloudFront distribution for the frontend.' });
  }
}
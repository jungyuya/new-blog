// 파일 위치: apps/infra/lib/blog-stack.ts (v4.0 - L2 최종 안정화 버전)
// 역할: L1 Construct의 모든 문제를 해결하고, CDK의 모범 사례를 따르는 최종 인프라 구성

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
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

export class BlogStack extends Stack {
  // 다른 스택(ImageProcessorStack)에서 참조할 수 있도록 public 속성으로 선언
  public readonly imageBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const projectRoot = path.join(__dirname, '..', '..', '..');
    const siteDomain = 'blog.jungyu.store';
    const domainName = 'jungyu.store'; // Route 53 호스팅 영역 이름

    // ===================================================================================
    // SECTION 1: 백엔드 및 공유 리소스 정의
    // ===================================================================================

    // --- 1.1. 인증 리소스 (Cognito) ---
    const userPool = new cognito.UserPool(this, 'BlogUserPool', {
      userPoolName: `BlogUserPool-${this.stackName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireDigits: true, requireSymbols: true, requireUppercase: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('BlogAppClient', {
      userPoolClientName: 'WebAppClient',
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        callbackUrls: [`https://${siteDomain}`, 'http://localhost:3000'],
        logoutUrls: [`https://${siteDomain}`, 'http://localhost:3000'],
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN,
        ],
      },
      accessTokenValidity: Duration.days(1),
      idTokenValidity: Duration.days(1),
      refreshTokenValidity: Duration.days(90),
    });

    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      groupName: 'Admins',
      userPoolId: userPool.userPoolId,
      description: 'Administrators with full access permissions',
      precedence: 0,
    });

    // --- 1.2. 데이터베이스 리소스 (DynamoDB) ---
    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${this.stackName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['postId', 'title', 'authorNickname', 'status', 'visibility', 'thumbnailUrl', 'summary', 'viewCount', 'tags'],
    });

    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3_SK', type: dynamodb.AttributeType.STRING },
    });

    // --- 1.3. 이미지 S3 저장소 리소스 ---
    this.imageBucket = new s3.Bucket(this, 'BlogImageBucket', {
      bucketName: `blog-image-bucket-${this.stackName.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['http://localhost:3000', `https://${siteDomain}`],
          allowedHeaders: ['*'],
        },
      ],
      eventBridgeEnabled: true,
    });

    // --- 1.4. 백엔드 컴퓨팅 리소스 (Lambda) ---
    const backendApiLambda = new NodejsFunction(this, 'BackendApiLambda', {
      functionName: `blog-backend-api-${this.stackName}`,
      description: 'Handles all backend API logic via Hono.',
      entry: path.join(projectRoot, 'apps', 'backend', 'src', 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        REGION: this.region,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        IMAGE_BUCKET_NAME: this.imageBucket.bucketName,
        SITE_DOMAIN: siteDomain,
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // 백엔드 Lambda에 필요한 권한 부여
    postsTable.grantReadWriteData(backendApiLambda);
    this.imageBucket.grantPut(backendApiLambda, 'uploads/*');
    this.imageBucket.grantDelete(backendApiLambda, 'images/*');
    this.imageBucket.grantDelete(backendApiLambda, 'thumbnails/*');

    // --- 1.5. API 게이트웨이 리소스 ---
    const httpApi = new HttpApi(this, 'BlogHttpApiGateway', {
      apiName: `BlogHttpApi-${this.stackName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', `https://${siteDomain}`],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE, CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
      defaultIntegration: new HttpLambdaIntegration('DefaultIntegration', backendApiLambda),
    });

    // ===================================================================================
    // SECTION 2: 프론트엔드 리소스 정의
    // ===================================================================================
    const imageTag = new cdk.CfnParameter(this, 'ImageTag', {
      type: 'String',
      description: 'The ECR image tag for the frontend server to deploy.',
    });

    // --- 2.1. 프론트엔드 정적 에셋 S3 저장소 ---
    const assetsBucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
      // 버킷 이름은 CDK가 자동으로 고유하게 생성하도록 하여 충돌을 방지합니다.
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // --- 2.2. 프론트엔드 컴퓨팅 리소스 (Lambda) ---
    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'FrontendEcrRepo', 'new-blog-frontend');

    const serverLambda = new lambda.DockerImageFunction(this, 'FrontendServerLambda', {
      functionName: `blog-frontend-server-${this.stackName}`,
      description: 'Next.js server for frontend rendering',
      code: lambda.DockerImageCode.fromEcr(ecrRepository, {
        tagOrDigest: imageTag.valueAsString,
      }),
      memorySize: 1024,
      timeout: Duration.seconds(30),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/extensions/lambda-adapter',
        PORT: '3000',
        NEXT_PUBLIC_API_ENDPOINT: '/api',
        INTERNAL_API_ENDPOINT: `${httpApi.url!}api`,
        NEXT_PUBLIC_REGION: this.region,
        NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        NEXT_PUBLIC_ASSET_PREFIX: `/${imageTag.valueAsString}`,
        // [추가] Next.js 이미지 최적화를 위해 S3 버킷 이름을 전달합니다.
        IMAGE_BUCKET_NAME: this.imageBucket.bucketName,
        ASSETS_BUCKET_NAME: assetsBucket.bucketName,
      },
    });

    // 프론트엔드 Lambda가 S3 버킷들을 읽을 수 있도록 권한 부여
    this.imageBucket.grantRead(serverLambda);
    assetsBucket.grantRead(serverLambda);

    const serverLambdaUrl = serverLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // ===================================================================================
    // SECTION 3: 프론트엔드 리소스 (CloudFront & Route53) - 최종 안정화 버전
    // ===================================================================================
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z0802600EUJ1KX823IZ7',
      zoneName: domainName,
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', 'arn:aws:acm:us-east-1:786382940028:certificate/d8aa46d8-b8dc-4d1b-b590-c5d4a52b7081');

    // --- 3.1. CloudFront Distribution (L2 Construct) ---
    // [핵심] 논리적 ID를 'NewFrontendDistribution'으로 유지하여, '생성'이 아닌 '수정'을 유도합니다.
    const distribution = new cloudfront.Distribution(this, 'NewFrontendDistribution', {
      comment: `Distribution for ${siteDomain} - v5.0 Final L2`,
      defaultBehavior: {
        origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', serverLambdaUrl.url)), {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(cdk.Fn.select(0, cdk.Fn.split('/', cdk.Fn.select(1, cdk.Fn.split('://', httpApi.url!))))),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // [핵심] S3Origin은 OAC와 버킷 정책을 자동으로 처리합니다. 수동 설정이 필요 없습니다.
        '/*/_next/static/*': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/images/*': {
          origin: new origins.S3Origin(this.imageBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/thumbnails/*': {
          origin: new origins.S3Origin(this.imageBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/default-avatar.png': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/favicon.ico': {
          origin: new origins.S3Origin(assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      domainNames: [siteDomain],
      certificate: certificate,
    });

    // --- 3.2. Route 53 DNS 레코드 ---
    // [핵심] 논리적 ID를 'NewSiteARecord'로 유지합니다.
    new route53.ARecord(this, 'NewSiteARecord', {
      recordName: siteDomain,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // ===================================================================================
    // SECTION 4: 스택 출력
    // ===================================================================================
    new CfnOutput(this, 'ApiGatewayEndpoint', { value: httpApi.url! });
    new CfnOutput(this, 'FrontendURL', { value: `https://${siteDomain}` });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'ImageBucketName', { value: this.imageBucket.bucketName });
    new CfnOutput(this, 'FrontendAssetsBucketName', { value: assetsBucket.bucketName });
    new CfnOutput(this, 'UserPoolIdOutput', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientIdOutput', { value: userPoolClient.userPoolClientId });
  }
}
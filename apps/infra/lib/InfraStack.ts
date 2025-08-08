// 파일 위치: apps/infra/lib/InfraStack.ts
// 최종 버전: v2025.08.08-TrueMasterpiece
// 역할: 프로젝트의 모든 AWS 인프라를 정의하는, 보안과 모범 사례가 집대성된 단 하나의 진실 공급원

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { HttpApi, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
    // Phase 5.6에서는 백엔드가 즉시 필요로 하는 GSI3만 활성화합니다.
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3_SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // GSI1과 GSI2는 향후 기능 개발 단계(Phase 6+)에서 점진적으로 추가될 예정입니다.
    /*
    postsTable.addGlobalSecondaryIndex({ indexName: 'GSI1', ... });
    postsTable.addGlobalSecondaryIndex({ indexName: 'GSI2', ... });
    */

    // --- 1.3. 백엔드 Lambda 함수 "껍데기" 정의 ---
    const backendApiLambda = new lambda.Function(this, 'BackendApiLambda', {
      functionName: `blog-backend-api-${this.stackName}`,
      description: 'Handles all backend API logic. Code is deployed via GitHub Actions.',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => "Placeholder for backend";'),
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        REGION: this.region,
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

    // --- 2.1. 프론트엔드 Lambda 함수 "껍데기" 정의 ---
    const serverLambda = new lambda.Function(this, 'FrontendServerLambda', {
      functionName: `blog-frontend-server-${this.stackName}`,
      description: 'Renders the Next.js frontend. Code is deployed via GitHub Actions.',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => "Placeholder for frontend";'),
      memorySize: 1024,
      timeout: Duration.seconds(30),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        S3_BUCKET_NAME: assetsBucket.bucketName,
        NEXT_PUBLIC_API_ENDPOINT: httpApi.url!,
      },
    });
    const serverLambdaUrl = serverLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM });

    // --- 2.2. CloudFront Distribution: CDN, 보안 및 트래픽 라우팅 ---
    const functionOrigin = new origins.FunctionUrlOrigin(serverLambdaUrl);

    const distribution = new cloudfront.Distribution(this, 'NewFrontendDistribution', {
      domainNames: [siteDomain],
      certificate: certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      comment: `Distribution for ${siteDomain}`,
      defaultBehavior: {
        origin: functionOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
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
      },
    });

    // --- 2.3. Route 53: 커스텀 도메인 연결 ---
    new route53.ARecord(this, 'NewSiteARecord', {
      recordName: 'blog',
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // ===================================================================================
    // SECTION 3: 스택 출력
    // ===================================================================================
    new CfnOutput(this, 'ApiGatewayEndpoint', { value: httpApi.url!, description: 'HTTP API Gateway endpoint URL' });
    new CfnOutput(this, 'FrontendURL', { value: `https://${distribution.distributionDomainName}`, description: 'URL of the frontend CloudFront distribution' });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId, description: 'ID of the CloudFront distribution for the frontend.' });
    new CfnOutput(this, 'FrontendAssetsBucketName', { value: assetsBucket.bucketName, description: 'Name of the S3 bucket for frontend static assets.' });
  }
}
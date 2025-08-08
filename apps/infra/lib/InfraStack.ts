// 파일 위치: apps/infra/lib/InfraStack.ts
// 최종 버전: v2025.08.08-Restore-the-Forest

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
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z0802600EUJ1KX823IZ7',
      zoneName: domainName,
    });
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'SiteCertificate',
      'arn:aws:acm:us-east-1:786382940028:certificate/d8aa46d8-b8dc-4d1b-b590-c5d4a52b7081',
    );

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
      cors: {
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
        allowedHeaders: ['*'],
      },
    });

    // [수정 1] Lambda와 S3를 위한 OAC를 각각 L1 수준에서 명확하게 생성합니다.
    const lambdaOac = new cloudfront.CfnOriginAccessControl(this, 'LambdaOAC', {
      originAccessControlConfig: {
        name: `OAC-for-Lambda-${this.stackName}`,
        originAccessControlOriginType: 'lambda',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    const s3Oac = new cloudfront.CfnOriginAccessControl(this, 'S3OAC', {
      originAccessControlConfig: {
        name: `OAC-for-S3-${this.stackName}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // [수정 2] CloudFront 배포 전체를 L1 Construct인 CfnDistribution으로 직접 정의합니다.
    const distribution = new cloudfront.CfnDistribution(this, 'NewFrontendDistribution', {
      distributionConfig: {
        comment: `Distribution for ${siteDomain}`,
        enabled: true,
        httpVersion: 'http2',
        priceClass: 'PriceClass_200',
        aliases: [siteDomain],
        viewerCertificate: {
          acmCertificateArn: certificate.certificateArn,
          sslSupportMethod: 'sni-only',
          minimumProtocolVersion: 'TLSv1.2_2021',
        },
        // Origin들을 직접 정의합니다.
        origins: [
          {
            id: 'LambdaOrigin',
            domainName: cdk.Fn.select(2, cdk.Fn.split('/', serverLambdaUrl.url)),
            originAccessControlId: lambdaOac.attrId,
            customOriginConfig: {
              originProtocolPolicy: 'https-only',
              originSslProtocols: ['TLSv1.2'],
            },
          },
          {
            id: 'S3Origin',
            domainName: assetsBucket.bucketRegionalDomainName,
            originAccessControlId: s3Oac.attrId,
            s3OriginConfig: {
              // OAC를 사용할 때는 OAI를 비워야 합니다.
              originAccessIdentity: '',
            },
          },
        ],
        // 기본 동작을 정의합니다.
        defaultCacheBehavior: {
          targetOriginId: 'LambdaOrigin', // Lambda Origin을 기본으로 사용
          viewerProtocolPolicy: 'redirect-to-https',
          allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
          cachedMethods: ['GET', 'HEAD'],
          // 캐시 및 헤더 전달 정책을 명시적으로 지정합니다.
          cachePolicyId: cloudfront.CachePolicy.CACHING_DISABLED.cachePolicyId,
          originRequestPolicyId: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER.originRequestPolicyId,
        },
        // 추가 동작들을 정의합니다.
        cacheBehaviors: [
          {
            pathPattern: '/_next/static/*',
            targetOriginId: 'S3Origin',
            viewerProtocolPolicy: 'redirect-to-https',
            cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          },
          {
            pathPattern: '/assets/*',
            targetOriginId: 'S3Origin',
            viewerProtocolPolicy: 'redirect-to-https',
            cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          },
        ],
      },
    });

    // [수정 3] S3 버킷 정책을 'distribution'이 선언된 후에 추가하여 순서 문제를 해결합니다.
    assetsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject'],
        resources: [assetsBucket.arnForObjects('*')],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          // L1 distribution의 ID는 .ref로 올바르게 참조합니다.
          StringEquals: { 'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.ref}` },
        },
      })
    );

    // [수정 4] Route53 A 레코드를 L1 CfnDistribution에 직접 연결하는 올바른 방법으로 수정합니다.
    new route53.CfnRecordSet(this, 'NewSiteARecord', {
      name: siteDomain,
      type: 'A',
      hostedZoneId: hostedZone.hostedZoneId,
      aliasTarget: {
        // CloudFront의 공식 Hosted Zone ID는 상수 값입니다.
        hostedZoneId: 'Z2FDTNDATAQYW2',
        dnsName: distribution.attrDomainName,
      },
    });

    // ===================================================================================
    // SECTION 3: CI/CD 파이프라인을 위한 권한 부여
    // ===================================================================================
    const GITHUB_ACTIONS_ROLE_NAME_FOR_CONTENT = 'ContentDeployRole';
    const contentDeployRole = iam.Role.fromRoleName(this, 'ContentDeployRole', GITHUB_ACTIONS_ROLE_NAME_FOR_CONTENT);

    // S3 버킷에 대한 읽기/쓰기 권한을 부여합니다. (이 부분은 정상 작동)
    assetsBucket.grantReadWrite(contentDeployRole);

    // 새로운 IAM 정책을 생성합니다.
    const invalidatePolicy = new iam.Policy(this, 'InvalidatePolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cloudfront:CreateInvalidation'],
          // [수정 5] L1 distribution의 ARN을 올바르게 구성합니다.
          resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.ref}`],
        }),
      ],
    });

    // 생성된 정책을, 우리가 참조한 contentDeployRole에 연결(attach) 합니다.
    contentDeployRole.attachInlinePolicy(invalidatePolicy);

    // ===================================================================================
    // SECTION 4: 스택 출력
    // ===================================================================================
    new CfnOutput(this, 'ApiGatewayEndpoint', { value: httpApi.url!, description: 'HTTP API Gateway endpoint URL' });
    // [수정 6] L1 distribution의 속성을 올바르게 참조합니다.
    new CfnOutput(this, 'FrontendURL', { value: `https://${distribution.attrDomainName}`, description: 'URL of the frontend CloudFront distribution' });
    new CfnOutput(this, 'FrontendAssetsBucketName', { value: assetsBucket.bucketName, description: 'Name of the S3 bucket for frontend static assets.' });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.ref, description: 'ID of the CloudFront distribution for the frontend.' });
  }
}
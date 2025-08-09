// 파일 위치: apps/infra/lib/InfraStack.ts
// 최종 버전: v2025.08.09-TheUltimateMasterpiece
// 역할: 모든 디버깅의 교훈을 담아 완성한, 안정성과 명확성을 최우선으로 하는 최종 인프라 구성

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
import * as logs from 'aws-cdk-lib/aws-logs'; // aws_logs 모듈 import 추가

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const projectRoot = path.join(__dirname, '..', '..', '..');

    const imageTag = new CfnParameter(this, 'ImageTag', {
      type: 'String',
      description: 'The ECR image tag to deploy.',
    });

    // ===================================================================================
    // SECTION 1: 백엔드 리소스 정의
    // ===================================================================================
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
      authFlows: { userSrp: true, userPassword: true },
      accessTokenValidity: Duration.days(1),
      idTokenValidity: Duration.days(1),
      refreshTokenValidity: Duration.days(90),
    });

    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${this.stackName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

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
      tracing: lambda.Tracing.ACTIVE,
      bundling: { minify: true, externalModules: [] },
    });
    cdk.Tags.of(backendApiLambda).add('Purpose', 'Application Logic');
    cdk.Tags.of(backendApiLambda).add('Tier', 'Backend');

    postsTable.grantReadWriteData(backendApiLambda);
    backendApiLambda.addToRolePolicy(new iam.PolicyStatement({ actions: ['dynamodb:Query'], resources: [`${postsTable.tableArn}/index/*`] }));
    backendApiLambda.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:SignUp', 'cognito-idp:InitiateAuth', 'cognito-idp:GlobalSignOut'], resources: [userPool.userPoolArn] }));

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
    httpApi.addRoutes({ path: '/{proxy+}', methods: [HttpMethod.ANY], integration: lambdaIntegration });

    // ===================================================================================
    // SECTION 2: 프론트엔드 리소스 정의 (리서치 기반 최종 완성본)
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
      architecture: lambda.Architecture.ARM_64,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/extensions/lambda-adapter',
        PORT: '3000',
        NEXT_PUBLIC_API_ENDPOINT: httpApi.url!,
        NEXT_PUBLIC_REGION: this.region,
        NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
    cdk.Tags.of(serverLambda).add('Purpose', 'Application Logic');
    cdk.Tags.of(serverLambda).add('Tier', 'Frontend');
    assetsBucket.grantRead(serverLambda);
    const serverLambdaUrl = serverLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // [핵심 1] S3 Origin을 위한 OAC를 L2 수준에서, '올바른 속성 이름'으로 생성합니다.
    const s3Oac = new cloudfront.S3OriginAccessControl(this, 'S3OAC', {
      // originAccessControlName is the correct prop name
      originAccessControlName: `OAC-for-S3-${this.stackName}`,
      // 명시적으로 서명 동작 지정 (선택) — 필요에 따라 변경 가능
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    // [핵심 2] S3Origin을 생성할 때, L2 헬퍼를 통해 OAC를 연결합니다.
    // 직접 origins.S3Origin(..., { originAccessControl: ... }) 형태는 타입이 맞지 않아 에러가 발생합니다.
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetsBucket, {
      originAccessControl: s3Oac,
    });

    const distribution = new cloudfront.Distribution(this, 'NewFrontendDistribution', {
      domainNames: [siteDomain],
      certificate: certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: new origins.HttpOrigin(cdk.Fn.parseDomainName(serverLambdaUrl.url)),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin: s3Origin, // [핵심 3] OAC와 연결된 S3 Origin을 사용합니다.
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/assets/*': {
          origin: s3Origin, // [핵심 3] 여기도 동일하게 사용합니다.
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/api/*': {
          origin: new origins.HttpOrigin(cdk.Fn.parseDomainName(httpApi.url!)),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // [핵심 3] CDK의 자동 정책 생성을 믿지 않고, OAC를 위한 버킷 정책을 '직접' 추가합니다.
    // 이것이 리서치 문서에서 권장하는 가장 확실한 방법입니다.
    assetsBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [assetsBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    }));

    const deployment = new s3deploy.BucketDeployment(this, 'DeployFrontendAssets', {
      sources: [s3deploy.Source.asset(path.join(projectRoot, 'apps/frontend/.next/static'))],
      destinationBucket: assetsBucket,
      destinationKeyPrefix: '_next/static',
      distribution: distribution,
      distributionPaths: ['/_next/static/*'],
    });
    deployment.node.addDependency(distribution);

    serverLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:Invoke'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${httpApi.apiId}/*`],
    }));

    new route53.ARecord(this, 'NewSiteARecord', {
      recordName: siteDomain,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // ===================================================================================
    // SECTION 3: 스택 출력 및 모니터링
    // ===================================================================================
    new CfnOutput(this, 'ApiGatewayEndpoint', { value: httpApi.url!, description: 'HTTP API Gateway endpoint URL' });
    new CfnOutput(this, 'UserPoolIdOutput', { value: userPool.userPoolId, description: 'Cognito User Pool ID' });
    new CfnOutput(this, 'UserPoolClientIdOutput', { value: userPoolClient.userPoolClientId, description: 'Cognito User Pool App Client ID' });
    new CfnOutput(this, 'RegionOutput', { value: this.region, description: 'AWS Region' });
    new CfnOutput(this, 'FrontendURL', { value: `https://${distribution.distributionDomainName}`, description: 'URL of the frontend CloudFront distribution' });

    backendApiLambda.metricErrors({ period: Duration.minutes(5) }).createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
      threshold: 1, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, alarmDescription: 'Lambda function errors detected!',
    });
    httpApi.metricServerError({ period: Duration.minutes(5) }).createAlarm(this, 'ApiGatewayServerErrorAlarm', {
      threshold: 1, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, alarmDescription: 'API Gateway 5xx server errors detected!',
    });
  }
}

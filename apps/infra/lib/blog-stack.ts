// 파일 위치: apps/infra/lib/blog-stack.ts
// 최종 버전: v2025.09.03-The-Purified-Masterpiece - GSI2 수정

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnUserPoolGroup } from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';



export class BlogStack extends Stack {
  public readonly imageBucket: s3.IBucket;
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

    // --- 1.1. 인증 리소스 ---
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

    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      groupName: 'Admins', // 그룹 이름
      userPoolId: userPool.userPoolId, // 이 그룹이 속할 User Pool의 ID
      description: 'Administrators with full access permissions', // 그룹에 대한 설명
      precedence: 0, // 우선순위 (숫자가 낮을수록 높음)
    });

    // --- 1.2. 데이터베이스 리소스 (핵심 수정 영역) ---
    const postsTable = new dynamodb.Table(this, 'BlogPostsTable', {
      tableName: `BlogPosts-${this.stackName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE, // [추가] DynamoDB Stream 활성화
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // --- GSI 3 (전체 게시물 최신순 조회용) ---
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3_SK', type: dynamodb.AttributeType.STRING },
      // [핵심 수정 1] PostCard 목록 조회 시 '좋아요' 수를 함께 가져오기 위해
      // projectionType을 INCLUDE로 변경하고 nonKeyAttributes에 likeCount를 추가합니다.
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        'postId', 'title', 'authorNickname', 'status', 'visibility',
        'thumbnailUrl', 'summary', 'viewCount', 'tags', 'authorBio',
        'authorAvatarUrl', 'createdAt', 'commentCount', 'likeCount', 'isDeleted'
      ]
    });

    // --- GSI 2 (태그별 게시물 최신순 조회용) ---
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        'postId', 'title', 'authorNickname', 'status', 'visibility',
        'thumbnailUrl', 'summary', 'viewCount', 'tags', 'authorBio',
        // [핵심 수정 2] 태그별 게시물 목록에서도 '좋아요' 수를 표시하기 위해
        // nonKeyAttributes에 likeCount를 추가합니다.
        'likeCount'
      ],
    });

    // --- [신규 추가] GSI 4 ('좋아요' 기능 전용) ---
    // 특정 사용자가 '좋아요'를 누른 모든 게시물을 효율적으로 조회하기 위한 인덱스입니다.
    postsTable.addGlobalSecondaryIndex({
      indexName: 'GSI4',
      partitionKey: { name: 'GSI4_PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI4_SK', type: dynamodb.AttributeType.STRING },
      // '좋아요' 여부만 확인하거나, 나중에 '좋아요'한 글 목록을 만들 때
      // 기본 정보만 필요하므로 INCLUDE 타입을 사용합니다.
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['postId', 'title', 'thumbnailUrl', 'summary']
    });

    // --- [신규 추가] CDK를 사용하여 DynamoDB 초기 데이터(SITE_CONFIG) Seeding ---
    new cr.AwsCustomResource(this, 'SiteConfigSeeder', {
      onCreate: { // 스택이 처음 생성될 때 이 작업을 수행합니다.
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: postsTable.tableName,
          Item: {
            PK: { S: 'SITE_CONFIG' },
            SK: { S: 'METADATA' },
            // [중요] 여기에 Hero로 지정할 실제 postId를 입력하세요.
            heroPostId: { S: '9a67ca18-a7e0-498b-a527-6efa7e4902b0' }
          }
        },
        physicalResourceId: cr.PhysicalResourceId.of('SiteConfigSeeder-Initial-Data'),
      },
      onUpdate: { // 스택이 업데이트될 때도 동일한 작업을 수행하여 데이터가 유지되도록 합니다.
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: postsTable.tableName,
          Item: {
            PK: { S: 'SITE_CONFIG' },
            SK: { S: 'METADATA' },
            heroPostId: { S: '9a67ca18-a7e0-498b-a527-6efa7e4902b0' }
          }
        },
      },
      // 이 커스텀 리소스가 DynamoDB 테이블에 PutItem 작업을 수행할 권한을 부여합니다.
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['dynamodb:PutItem'],
          resources: [postsTable.tableArn],
        }),
      ]),
    });

    // --- 1.3. 이미지 S3저장소 리소스 ---
    this.imageBucket = new s3.Bucket(this, 'BlogImageBucket', {
      bucketName: `blog-image-bucket-${this.stackName.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.GET],
          allowedOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      eventBridgeEnabled: true,

      // --- S3 수명 주기(Lifecycle) 규칙 ---
      lifecycleRules: [
        {
          id: 'AbortIncompleteUploadsAfter7Days',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          enabled: true,
        },
        {
          id: 'ExpireUploadsAfter1Day',
          // ↓ 여기: filters 대신 prefix 사용
          prefix: 'uploads/',
          expiration: cdk.Duration.days(1),
          enabled: true,
        },
        // (선택 사항) 나중에 images/나 thumbnails/ 폴더의 고아 객체도 정리할 수 있습니다.
        // {
        //   description: 'Delete incomplete multipart uploads after 7 days',
        //   abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
        // }
      ],
    });

    // --- 1.4 백엔드 컴퓨팅 리소스 ---
    const backendApiLambda = new NodejsFunction(this, 'BackendApiLambda', {
      functionName: `blog-backend-api-${this.stackName}`,
      description: 'Handles all backend API logic (CRUD, Auth, etc.) via Hono.',
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
      },
      tracing: lambda.Tracing.ACTIVE,

      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // --- Lambda 함수에 비용 추적을 위한 태그를 추가 ---
    cdk.Tags.of(backendApiLambda).add('blog-project-cost', 'bedrock-caller');

    cdk.Tags.of(backendApiLambda).add('Purpose', 'Application Logic');
    cdk.Tags.of(backendApiLambda).add('Tier', 'Backend');

    // --- 1.5. API 게이트웨이 리소스 ---
    const httpApi = new HttpApi(this, 'BlogHttpApiGateway', {
      apiName: `BlogHttpApi-${this.stackName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE, CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
      defaultIntegration: new HttpLambdaIntegration('DefaultIntegration', backendApiLambda),
    });

    // ===================================================================================
    // SECTION 2: 권한 부여 및 관계 설정 (Grant permissions and define relationships)
    // ===================================================================================
    postsTable.grantReadWriteData(backendApiLambda);
    backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query'],
      // [핵심 수정 3] 새로 추가된 GSI4에 대한 쿼리 권한을 부여합니다.
      resources: [
        `${postsTable.tableArn}/index/GSI2`,
        `${postsTable.tableArn}/index/GSI3`,
        `${postsTable.tableArn}/index/GSI4`
      ],
    }));
    backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:SignUp', 'cognito-idp:InitiateAuth', 'cognito-idp:GetUser'],
      resources: [userPool.userPoolArn],
    }));

    // --- Bedrock 모델 호출을 위한 IAM 권한을 부여합니다. ---
    backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      // "최소 권한의 원칙"에 따라, 모든 모델이 아닌 Claude 3 Haiku 모델에 대한
      // 호출 권한만 최소한으로 부여하여 보안을 강화합니다.
      resources: [`arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`],
    }));

    this.imageBucket.grantPut(backendApiLambda, 'uploads/*');
    this.imageBucket.grantDelete(backendApiLambda, 'images/*');
    this.imageBucket.grantDelete(backendApiLambda, 'thumbnails/*');

    // ===================================================================================
    // SECTION 3: 프론트엔드 리소스 정의 (정화된 최종 완성본)
    // ===================================================================================
    const domainName = 'jungyu.store';
    const siteDomain = `blog.${domainName}`;
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', { hostedZoneId: 'Z0802600EUJ1KX823IZ7', zoneName: domainName });
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', 'arn:aws:acm:us-east-1:786382940028:certificate/d8aa46d8-b8dc-4d1b-b590-c5d4a52b7081');

    const assetsBucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'FrontendEcrRepo', 'new-blog-frontend');

    const githubUrlParameter = ssm.StringParameter.valueForStringParameter(
      this,
      '/new-blog/frontend/github-url' // Step 1.1에서 생성한 파라미터 이름
    );

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
        NEXT_PUBLIC_API_ENDPOINT: '/api',
        INTERNAL_API_ENDPOINT: `${httpApi.url!.replace(/\/$/, '')}/api`,
        NEXT_PUBLIC_REGION: this.region,
        NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
        NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        NEXT_PUBLIC_GITHUB_URL: githubUrlParameter,
      },
    });
    this.imageBucket.grantRead(serverLambda);

    cdk.Tags.of(serverLambda).add('Purpose', 'Application Logic');
    cdk.Tags.of(serverLambda).add('Tier', 'Frontend');
    assetsBucket.grantRead(serverLambda);
    const serverLambdaUrl = serverLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    const s3Oac = new cloudfront.CfnOriginAccessControl(this, 'S3OAC', {
      originAccessControlConfig: {
        name: `OAC-for-S3-${this.stackName}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    const distribution = new cloudfront.CfnDistribution(this, 'NewFrontendDistribution', {
      distributionConfig: {
        comment: `Distribution for ${siteDomain} - V2`,
        enabled: true,
        httpVersion: 'http2',
        priceClass: 'PriceClass_200',
        aliases: [siteDomain],
        viewerCertificate: { acmCertificateArn: certificate.certificateArn, sslSupportMethod: 'sni-only', minimumProtocolVersion: 'TLSv1.2_2021' },
        origins: [
          {
            id: 'FrontendServerOrigin',
            domainName: cdk.Fn.select(2, cdk.Fn.split('/', serverLambdaUrl.url)),
            customOriginConfig: { originProtocolPolicy: 'https-only', originSslProtocols: ['TLSv1.2'] },
          },
          {
            id: 'FrontendAssetsOrigin',
            domainName: assetsBucket.bucketRegionalDomainName,
            originAccessControlId: s3Oac.attrId,
            s3OriginConfig: {},
          },
          {
            id: 'BackendApiOrigin',
            domainName: cdk.Fn.select(0, cdk.Fn.split('/', cdk.Fn.select(1, cdk.Fn.split('://', httpApi.url!)))),
            customOriginConfig: { originProtocolPolicy: 'https-only', originSslProtocols: ['TLSv1.2'] },
          },
        ],
        defaultCacheBehavior: {
          targetOriginId: 'FrontendServerOrigin',
          viewerProtocolPolicy: 'redirect-to-https',
          allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
          cachedMethods: ['GET', 'HEAD'],
          cachePolicyId: cloudfront.CachePolicy.CACHING_DISABLED.cachePolicyId,
          originRequestPolicyId: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER.originRequestPolicyId,
        },
        cacheBehaviors: [
          {
            pathPattern: '/*.*', // 점(.)이 포함된 모든 파일 경로 (예: .webp, .ico, .png)
            targetOriginId: 'FrontendAssetsOrigin', // S3 버킷으로 요청을 보냅니다.
            viewerProtocolPolicy: 'redirect-to-https',
            allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
            cachedMethods: ['GET', 'HEAD'],
            compress: true,
            cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          },
          {
            pathPattern: '/*/_next/static/*',
            targetOriginId: 'FrontendAssetsOrigin',
            viewerProtocolPolicy: 'redirect-to-https',
            allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
            cachedMethods: ['GET', 'HEAD'],
            compress: true,
            cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          },
          // 기존 규칙들은 만약을 위해 유지하거나, 위 규칙으로 통합 후 삭제할 수 있습니다.
          // 여기서는 안정성을 위해 유지합니다. 
          {
            pathPattern: '/_next/static/*',
            targetOriginId: 'FrontendAssetsOrigin',
            viewerProtocolPolicy: 'redirect-to-https',
            allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
            cachedMethods: ['GET', 'HEAD'],
            compress: true,
            cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          },
          {
            pathPattern: '/assets/*',
            targetOriginId: 'FrontendAssetsOrigin',
            viewerProtocolPolicy: 'redirect-to-https',
            allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
            cachedMethods: ['GET', 'HEAD'],
            compress: true,
            cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          },
          {
            pathPattern: '/api/*',
            targetOriginId: 'BackendApiOrigin',
            viewerProtocolPolicy: 'redirect-to-https',
            allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
            cachePolicyId: cloudfront.CachePolicy.CACHING_DISABLED.cachePolicyId,
            originRequestPolicyId: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER.originRequestPolicyId,
          },
        ],
      },
    });

    assetsBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [assetsBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.ref}`,
          'AWS:SourceAccount': this.account,
        },
      },
    }));

    const distributionTarget = cloudfront.Distribution.fromDistributionAttributes(this, 'ImportedDistribution', {
      distributionId: distribution.ref,
      domainName: distribution.attrDomainName,
    });

    new route53.ARecord(this, 'NewSiteARecord', {
      recordName: siteDomain,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distributionTarget)),
    });

    // ===================================================================================
    // SECTION 5: SEARCH INFRASTRUCTURE (오픈서치)
    // ===================================================================================

    // --- 5.1. OpenSearch 도메인 정의 및 Nori 패키지 조건부 연결 ---
    const searchDomain = new opensearch.Domain(this, 'BlogSearchDomain', {
      domainName: `blog-search-${this.stackName.toLowerCase()}`,
      version: opensearch.EngineVersion.openSearch('3.1'), // [수정] 최신 지원 버전으로 업그레이드
      ebs: {
        volumeSize: 10, // 프리티어 EBS 한도 (10GB)
        volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
      encryptionAtRest: {
        enabled: true,
      },
      capacity: {
        dataNodes: 1, // 단일 노드로 설정하여 프리티어 준수
        dataNodeInstanceType: 't3.small.search', // 프리티어 인스턴스 타입
      },
      removalPolicy: RemovalPolicy.DESTROY, // 프로덕션에서는 DESTROY를 사용하지 않도록 주의
    });

    // --- 5.2. 인덱싱 실패를 위한 Dead-Letter Queue (DLQ) ---
    const indexingDlq = new sqs.Queue(this, 'IndexingDlq', {
      queueName: `blog-indexing-dlq-${this.stackName}`,
      retentionPeriod: Duration.days(14), // 실패한 메시지를 14일간 보관
    });

    // --- 5.3. 검색 기능 관련 IAM Role 정의 ---

    // 5.3.1. 인덱싱 Lambda를 위한 역할
    const indexingLambdaRole = new iam.Role(this, 'IndexingLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Lambda function that indexes data from DynamoDB to OpenSearch',
    });

    // 5.3.2. 검색 API Lambda를 위한 역할
    const searchApiLambdaRole = new iam.Role(this, 'SearchApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Lambda function that handles search API requests',
    });

    // --- 5.4. OpenSearch 도메인 접근 정책 설정 ---
    // 오직 위에서 만든 두 Lambda 역할(Role)만이 이 도메인에 접근할 수 있도록 허용
    searchDomain.addAccessPolicies(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['es:ESHttp*'], // OpenSearch에 대한 모든 HTTP 요청 허용
        resources: [searchDomain.domainArn + '/*'],
        principals: [
          indexingLambdaRole.grantPrincipal,
          searchApiLambdaRole.grantPrincipal,
        ],
      })
    );

    // [추가] 새로운 규칙: 나의 IP 주소에서의 접근을 추가로 허용 (Dev Tools 접근용)
    searchDomain.addAccessPolicies(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['es:ESHttp*'],
        resources: [searchDomain.domainArn + '/*'],
        principals: [new iam.AnyPrincipal()], // 모든 사용자에게 열어두되,
        conditions: {
          // IP 주소 조건으로 강력하게 제한
          'IpAddress': {
            'aws:SourceIp': ['58.232.52.98/32'] // <-- 여기에 공인 IP 주소를 입력
          }
        }
      })
    );

    // --- 5.5. 각 IAM Role에 필요한 최소 권한 부여 ---

    // 인덱싱 역할에 권한 추가
    indexingLambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')); // CloudWatch Logs 기본 권한
    postsTable.grantStreamRead(indexingLambdaRole); // DynamoDB Stream 읽기 권한
    indexingDlq.grantSendMessages(indexingLambdaRole); // DLQ에 메시지 보내기 권한

    // 검색 API 역할에 권한 추가
    searchApiLambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')); // CloudWatch Logs 기본 권한

    // --- 5.6. 신규 Lambda 함수들의 로그 그룹 보존 기간 설정 ---
    new logs.LogGroup(this, 'IndexingLambdaLogGroup', {
      logGroupName: `/aws/lambda/blog-indexing-handler-${this.stackName}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'SearchApiLambdaLogGroup', {
      logGroupName: `/aws/lambda/blog-search-handler-${this.stackName}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- 5.7. 신규 Lambda 함수 정의 및 트리거 연결 ---

    // 5.7.1. 인덱싱 Lambda 함수
    const indexingLambda = new NodejsFunction(this, 'IndexingLambda', {
      functionName: `blog-indexing-handler-${this.stackName}`,
      entry: path.join(projectRoot, 'apps', 'backend', 'src', 'indexing-handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: indexingLambdaRole, // Step 1.1에서 만든 역할 할당
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        OPENSEARCH_ENDPOINT: `https://${searchDomain.domainEndpoint}`,
        DLQ_URL: indexingDlq.queueUrl,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      bundling: { minify: true, externalModules: ['@aws-sdk/*'] },
      logGroup: logs.LogGroup.fromLogGroupName(this, 'IndexingLambdaLogGroupRef', `/aws/lambda/blog-indexing-handler-${this.stackName}`),
    });

    // DynamoDB Stream과 인덱싱 Lambda 연결 (트리거)
    indexingLambda.addEventSource(new DynamoEventSource(postsTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 100, // 한 번에 최대 100개의 레코드를 처리
      bisectBatchOnError: true, // 오류 발생 시 배치를 나눠서 재시도
      onFailure: new cdk.aws_lambda_event_sources.SqsDlq(indexingDlq), // 최종 실패 시 DLQ로 전송
      retryAttempts: 3, // 최대 3번 재시도
    }));

    // 5.7.2. 검색 API Lambda 함수
    const searchApiLambda = new NodejsFunction(this, 'SearchApiLambda', {
      functionName: `blog-search-handler-${this.stackName}`,
      entry: path.join(projectRoot, 'apps', 'backend', 'src', 'search-handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: searchApiLambdaRole, // Step 1.1에서 만든 역할 할당
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        OPENSEARCH_ENDPOINT: `https://${searchDomain.domainEndpoint}`,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      bundling: { minify: true, externalModules: ['@aws-sdk/*'] },
      logGroup: logs.LogGroup.fromLogGroupName(this, 'SearchApiLambdaLogGroupRef', `/aws/lambda/blog-search-handler-${this.stackName}`),
    });

    // --- 5.8. API Gateway 라우팅 추가 ---
    httpApi.addRoutes({
      path: '/search',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('SearchIntegration', searchApiLambda),
    });


    // ===================================================================================
    // SECTION 6: 스택 출력 및 모니터링 (기존 SECTION 4에서 이름 변경 및 내용 추가 & 통합)
    // ===================================================================================
    new CfnOutput(this, 'ApiGatewayEndpoint', { value: httpApi.url!, description: 'HTTP API Gateway endpoint URL' });
    new CfnOutput(this, 'UserPoolIdOutput', { value: userPool.userPoolId, description: 'Cognito User Pool ID' });
    new CfnOutput(this, 'UserPoolClientIdOutput', { value: userPoolClient.userPoolClientId, description: 'Cognito User Pool App Client ID' });
    new CfnOutput(this, 'RegionOutput', { value: this.region, description: 'AWS Region' });
    new CfnOutput(this, 'FrontendURL', { value: `https://${siteDomain}`, description: 'URL of the frontend CloudFront distribution' });
    new CfnOutput(this, 'FrontendAssetsBucketName', { value: assetsBucket.bucketName, description: 'S3 Bucket for frontend assets' });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.ref, description: 'ID of the CloudFront distribution' });
    new cdk.CfnOutput(this, 'ImageBucketName', { value: this.imageBucket.bucketName, description: 'S3 Bucket for storing blog images' });

    // [신규 추가] OpenSearch 도메인 엔드포인트 출력
    new CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: searchDomain.domainEndpoint,
      description: 'Endpoint for the OpenSearch domain',
    });

    backendApiLambda.metricErrors({ period: Duration.minutes(5) }).createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
      threshold: 1, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, alarmDescription: 'Lambda function errors detected!',
    });
    httpApi.metricServerError({ period: Duration.minutes(5) }).createAlarm(this, 'ApiGatewayServerErrorAlarm', {
      threshold: 1, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, alarmDescription: 'API Gateway 5xx server errors detected!',
    });
  }
}
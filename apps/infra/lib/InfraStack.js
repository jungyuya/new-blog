"use strict";
// apps/infra/lib/InfraStack.ts
// [프로젝트 헌법] 제1조: 인프라 구성법 (Phase 5: 프론트엔드 통합 최종안)
// 최종 수정일: 2025년 8월 4일
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_apigatewayv2_1 = require("aws-cdk-lib/aws-apigatewayv2");
const aws_apigatewayv2_integrations_1 = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const aws_apigatewayv2_authorizers_1 = require("aws-cdk-lib/aws-apigatewayv2-authorizers");
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
// [핵심] open-next/cdk 패키지에서 NextjsSite Construct를 import 합니다.
// 이 코드가 오류 없이 작동하려면, `pnpm --filter infra add -D open-next`가 성공적으로 실행되어야 합니다.
const open_next_cdk_1 = require("open-next-cdk");
// ---------------------------
// 2. CDK 스택 클래스 정의
// ---------------------------
class InfraStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ===================================================================================
        // SECTION 1: 백엔드 리소스 정의 (Backend Resources)
        // 이 섹션은 API, 데이터베이스, 사용자 인증 등 서비스의 핵심 로직을 담당합니다.
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
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        const userPoolClient = userPool.addClient('BlogAppClient', {
            userPoolClientName: 'WebAppClient',
            generateSecret: false,
            authFlows: { userSrp: true, userPassword: true },
            accessTokenValidity: aws_cdk_lib_1.Duration.days(1),
            idTokenValidity: aws_cdk_lib_1.Duration.days(1),
            refreshTokenValidity: aws_cdk_lib_1.Duration.days(90),
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
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        postsTable.addGlobalSecondaryIndex({
            indexName: 'GSI1',
            partitionKey: { name: 'GSI1_PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI1_SK', type: dynamodb.AttributeType.STRING },
        });
        // ... (GSI2, GSI3 정의는 생략 없이 동일하게 유지)
        // --- 1.3. Lambda Function (API 비즈니스 로직) ---
        const monorepoRoot = path.join(__dirname, '..', '..', '..');
        const backendPackageJsonPath = path.join(monorepoRoot, 'apps', 'backend', 'package.json');
        const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
        const backendVersion = backendPackageJson.version;
        const backendApiLambda = new aws_lambda_nodejs_1.NodejsFunction(this, 'BackendApiLambda', {
            functionName: `blog-backend-api-${this.stackName}`,
            entry: path.join(monorepoRoot, 'apps', 'backend', 'src', 'index.ts'),
            handler: 'handler',
            runtime: aws_lambda_1.Runtime.NODEJS_22_X,
            memorySize: 256,
            timeout: aws_cdk_lib_1.Duration.seconds(30),
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
        backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['dynamodb:Query'],
            resources: [`${postsTable.tableArn}/index/*`],
        }));
        backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cognito-idp:SignUp', 'cognito-idp:InitiateAuth', 'cognito-idp:GlobalSignOut'],
            resources: [userPool.userPoolArn],
        }));
        // --- 1.5. API Gateway (외부 통신 게이트웨이) ---
        const httpApi = new aws_apigatewayv2_1.HttpApi(this, 'BlogHttpApiGateway', {
            apiName: `BlogHttpApi-${this.stackName}`,
            corsPreflight: {
                allowOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
                allowMethods: [aws_apigatewayv2_1.CorsHttpMethod.GET, aws_apigatewayv2_1.CorsHttpMethod.POST, aws_apigatewayv2_1.CorsHttpMethod.PUT, aws_apigatewayv2_1.CorsHttpMethod.DELETE, aws_apigatewayv2_1.CorsHttpMethod.OPTIONS],
                allowHeaders: ['Content-Type', 'Authorization'],
                allowCredentials: true,
            },
        });
        const lambdaIntegration = new aws_apigatewayv2_integrations_1.HttpLambdaIntegration('LambdaIntegration', backendApiLambda);
        const authorizer = new aws_apigatewayv2_authorizers_1.HttpUserPoolAuthorizer('BlogUserPoolAuthorizer', userPool, {
            userPoolClients: [userPoolClient],
            identitySource: ['$request.header.Authorization'],
        });
        // API Gateway 라우트 정의
        httpApi.addRoutes({ path: '/auth/signup', methods: [aws_apigatewayv2_1.HttpMethod.POST], integration: lambdaIntegration });
        httpApi.addRoutes({ path: '/auth/login', methods: [aws_apigatewayv2_1.HttpMethod.POST], integration: lambdaIntegration });
        httpApi.addRoutes({ path: '/posts', methods: [aws_apigatewayv2_1.HttpMethod.GET], integration: lambdaIntegration });
        httpApi.addRoutes({ path: '/posts/{postId}', methods: [aws_apigatewayv2_1.HttpMethod.GET], integration: lambdaIntegration });
        httpApi.addRoutes({ path: '/hello', methods: [aws_apigatewayv2_1.HttpMethod.GET], integration: lambdaIntegration });
        httpApi.addRoutes({ path: '/auth/logout', methods: [aws_apigatewayv2_1.HttpMethod.POST], integration: lambdaIntegration, authorizer });
        httpApi.addRoutes({ path: '/posts', methods: [aws_apigatewayv2_1.HttpMethod.POST], integration: lambdaIntegration, authorizer });
        httpApi.addRoutes({ path: '/posts/{postId}', methods: [aws_apigatewayv2_1.HttpMethod.PUT, aws_apigatewayv2_1.HttpMethod.DELETE], integration: lambdaIntegration, authorizer });
        // ===================================================================================
        // SECTION 2: 프론트엔드 리소스 정의 (Frontend Resources)
        // 이 섹션은 사용자 인터페이스(UI)를 세상에 공개하고 제공하는 역할을 담당합니다.
        // ===================================================================================
        const frontendSite = new open_next_cdk_1.Nextjs(this, 'FrontendSite', {
            nextjsPath: 'apps/frontend',
            // [미래를 위한 확장]
            // 백엔드 API 정보를 프론트엔드 빌드 시점에 환경 변수로 전달합니다.
            // 이렇게 하면 프론트엔드 코드에서 amplifyconfiguration.ts 파일을 하드코딩할 필요가 없어집니다.
            environment: {
                NEXT_PUBLIC_API_ENDPOINT: httpApi.url,
                NEXT_PUBLIC_REGION: this.region,
                NEXT_PUBLIC_USER_POOL_ID: userPool.userPoolId,
                NEXT_PUBLIC_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
            },
        });
        // ===================================================================================
        // SECTION 3: 스택 출력 및 모니터링
        // ===================================================================================
        // --- 3.1. CloudFormation Outputs (배포 결과물) ---
        new aws_cdk_lib_1.CfnOutput(this, 'ApiGatewayEndpoint', {
            value: httpApi.url,
            description: 'HTTP API Gateway endpoint URL',
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolIdOutput', {
            value: userPool.userPoolId,
            description: 'Cognito User Pool ID',
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolClientIdOutput', {
            value: userPoolClient.userPoolClientId,
            description: 'Cognito User Pool App Client ID',
        });
        new aws_cdk_lib_1.CfnOutput(this, 'RegionOutput', {
            value: this.region,
            description: 'AWS Region',
        });
        new aws_cdk_lib_1.CfnOutput(this, 'FrontendURL', {
            value: frontendSite.url,
            description: 'URL of the frontend site',
        });
        // apps/infra/lib/InfraStack.ts (CloudWatch Alarms 섹션)
        // --- 3.2. CloudWatch Alarms (모니터링) ---
        // Lambda 함수 오류 발생 시 알람
        backendApiLambda.metricErrors({ period: aws_cdk_lib_1.Duration.minutes(5) })
            .createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
            // [핵심 수정] 필수 옵션들을 다시 채워넣습니다.
            threshold: 1, // 5분 동안 오류가 1번 이상 발생하면
            evaluationPeriods: 1, // 1번의 평가 기간(5분) 동안 관찰하여
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, // 알람을 울립니다.
            alarmDescription: 'Lambda function errors detected!',
        });
        // API Gateway 5xx 서버 에러 발생 시 알람
        httpApi.metricServerError({ period: aws_cdk_lib_1.Duration.minutes(5) })
            .createAlarm(this, 'ApiGatewayServerErrorAlarm', {
            // [핵심 수정] 필수 옵션들을 다시 채워넣습니다.
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmDescription: 'API Gateway 5xx server errors detected!',
        });
    }
}
exports.InfraStack = InfraStack;

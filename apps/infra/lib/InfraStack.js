"use strict";
// ~/projects/new-blog/apps/infra/lib/InfraStack.ts
// [프로젝트 헌법] 제1조: 인프라 구성법 (CORS 문제 해결 최종안)
// 최종 수정일: 2025년 8월 3일
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
// [CORS 수정] HttpUserPoolAuthorizer를 import 합니다.
const aws_apigatewayv2_authorizers_1 = require("aws-cdk-lib/aws-apigatewayv2-authorizers");
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const fs = __importStar(require("fs")); // Node.js의 파일 시스템 모듈을 import 합니다.
const path = __importStar(require("path"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
class InfraStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // --- 1. Cognito User Pool 정의 (사용자 인증 관리) ---
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
        // --- 2. DynamoDB Table 정의 (싱글 테이블 디자인 적용) ---
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
        // --- 3. Lambda Function (백엔드 API 로직) ---
        const monorepoRoot = path.join(__dirname, '..', '..', '..');
        const backendPackageJsonPath = path.join(monorepoRoot, 'apps', 'backend', 'package.json');
        const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
        const backendVersion = backendPackageJson.version;
        console.log(`Backend version detected: ${backendVersion}`); // CDK 실행 시 터미널에 버전이 출력되도록 함
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
                // [핵심 수정] 코드의 버전을 환경 변수로 주입합니다.
                BACKEND_VERSION: backendVersion,
            },
            tracing: lambda.Tracing.ACTIVE,
            bundling: {
                minify: true,
                externalModules: [],
            },
        });
        // --- 4. Lambda 함수에 권한 부여 ---
        // DynamoDB 테이블 자체에 대한 읽기/쓰기 권한을 부여합니다.
        postsTable.grantReadWriteData(backendApiLambda);
        // [핵심 수정] 모든 GSI에 대한 읽기(Query) 권한을 명시적으로 추가합니다.
        // grantReadWriteData가 GSI 권한을 충분히 부여하지 못하는 경우를 대비한 방어적 코드입니다.
        backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['dynamodb:Query'],
            resources: [
                // 테이블 ARN 뒤에 '/index/*'를 붙여 모든 인덱스를 지칭합니다.
                `${postsTable.tableArn}/index/*`,
            ],
        }));
        // Cognito User Pool에 대한 권한 부여 (이전과 동일)
        backendApiLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cognito-idp:SignUp', 'cognito-idp:InitiateAuth', 'cognito-idp:GlobalSignOut'],
            resources: [userPool.userPoolArn],
        }));
        // --- 5. API Gateway (HTTP API) 및 통합 ---
        const httpApi = new aws_apigatewayv2_1.HttpApi(this, 'BlogHttpApiGateway', {
            apiName: `BlogHttpApi-${this.stackName}`,
            // [CORS 수정] CORS 설정을 여기서 다시 명확하게 정의합니다.
            // 이 설정은 API Gateway가 OPTIONS 사전 요청에 대해 자동으로 응답하도록 지시합니다.
            corsPreflight: {
                allowOrigins: ['http://localhost:3000', `https://blog.jungyu.store`],
                allowMethods: [
                    aws_apigatewayv2_1.CorsHttpMethod.GET,
                    aws_apigatewayv2_1.CorsHttpMethod.POST,
                    aws_apigatewayv2_1.CorsHttpMethod.PUT,
                    aws_apigatewayv2_1.CorsHttpMethod.DELETE,
                    aws_apigatewayv2_1.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: ['Content-Type', 'Authorization'], // 프론트엔드에서 보내는 주요 헤더를 명시
                allowCredentials: true,
            },
        });
        const lambdaIntegration = new aws_apigatewayv2_integrations_1.HttpLambdaIntegration('LambdaIntegration', backendApiLambda);
        // [CORS 수정] Cognito Authorizer를 명시적으로 생성합니다.
        const authorizer = new aws_apigatewayv2_authorizers_1.HttpUserPoolAuthorizer('BlogUserPoolAuthorizer', userPool, {
            userPoolClients: [userPoolClient],
            identitySource: ['$request.header.Authorization'],
        });
        // [CORS 수정] 라우팅을 '프록시 통합'에서 '명시적 경로 정의'로 변경합니다.
        // 이는 OPTIONS 요청에 Authorizer가 적용되는 것을 막기 위한 가장 확실하고 제어 가능한 방법입니다.
        // 인증이 필요 없는 공개 라우트 (Authorizer 없음)
        httpApi.addRoutes({
            path: '/auth/signup',
            methods: [aws_apigatewayv2_1.HttpMethod.POST],
            integration: lambdaIntegration,
        });
        httpApi.addRoutes({
            path: '/auth/login',
            methods: [aws_apigatewayv2_1.HttpMethod.POST],
            integration: lambdaIntegration,
        });
        httpApi.addRoutes({
            path: '/posts',
            methods: [aws_apigatewayv2_1.HttpMethod.GET],
            integration: lambdaIntegration,
        });
        httpApi.addRoutes({
            path: '/posts/{postId}',
            methods: [aws_apigatewayv2_1.HttpMethod.GET],
            integration: lambdaIntegration,
        });
        httpApi.addRoutes({
            path: '/hello',
            methods: [aws_apigatewayv2_1.HttpMethod.GET],
            integration: lambdaIntegration,
        });
        // 인증이 필요한 보호된 라우트 (Authorizer 적용)
        httpApi.addRoutes({
            path: '/auth/logout',
            methods: [aws_apigatewayv2_1.HttpMethod.POST],
            integration: lambdaIntegration,
            authorizer,
        });
        httpApi.addRoutes({
            path: '/posts',
            methods: [aws_apigatewayv2_1.HttpMethod.POST],
            integration: lambdaIntegration,
            authorizer,
        });
        httpApi.addRoutes({
            path: '/posts/{postId}',
            methods: [aws_apigatewayv2_1.HttpMethod.PUT, aws_apigatewayv2_1.HttpMethod.DELETE],
            integration: lambdaIntegration,
            authorizer,
        });
        // --- 6. CloudFormation Outputs (배포 결과물 출력) ---
        new aws_cdk_lib_1.CfnOutput(this, 'ApiGatewayEndpoint', {
            value: httpApi.url,
            description: 'HTTP API Gateway endpoint URL',
            exportName: `BlogApiGatewayUrl-${this.stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolIdOutput', {
            value: userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: `BlogUserPoolId-${this.stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolClientIdOutput', {
            value: userPoolClient.userPoolClientId,
            description: 'Cognito User Pool App Client ID',
            exportName: `BlogUserPoolClientId-${this.stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, 'RegionOutput', {
            value: this.region,
            description: 'AWS Region',
            exportName: `BlogRegion-${this.stackName}`,
        });
        // --- 7. CloudWatch Alarms (모니터링 및 관측 가능성) ---
        backendApiLambda.metricErrors({ period: aws_cdk_lib_1.Duration.minutes(5) })
            .createAlarm(this, 'BackendApiLambdaErrorsAlarm', {
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmDescription: 'Lambda function errors detected!',
        });
        httpApi.metricServerError({ period: aws_cdk_lib_1.Duration.minutes(5) })
            .createAlarm(this, 'ApiGatewayServerErrorAlarm', {
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmDescription: 'API Gateway 5xx server errors detected!',
        });
    }
}
exports.InfraStack = InfraStack;

"use strict";
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
const cdk = __importStar(require("aws-cdk-lib"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_apigateway_1 = require("aws-cdk-lib/aws-apigateway");
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const path = __importStar(require("path"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class InfraStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // --- Cognito User Pool 정의 ---
        const userPool = new cognito.UserPool(this, 'BlogUserPool', {
            userPoolName: 'BlogUserPool',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
                username: false,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                requireUppercase: true,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const userPoolClient = userPool.addClient('BlogAppClient', {
            userPoolClientName: 'WebAppClient',
            generateSecret: false,
            authFlows: {
                userPassword: true,
            },
        });
        // --- DynamoDB Posts Table 정의 ---
        const postsTable = new dynamodb.Table(this, 'PostsTable', {
            tableName: 'BlogPosts',
            partitionKey: {
                name: 'postId',
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // --- Lambda Function 정의 ---
        const helloLambda = new aws_lambda_nodejs_1.NodejsFunction(this, 'HelloLambda', {
            functionName: 'blog-hello-lambda',
            entry: path.join(__dirname, '../../backend/dist/src/index.js'),
            handler: 'handler',
            runtime: aws_lambda_1.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            environment: {
                NODE_ENV: 'production',
                MY_VARIABLE: 'hello from cdk',
                TABLE_NAME: postsTable.tableName,
                USER_POOL_ID: userPool.userPoolId,
                USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
            },
            bundling: {
                externalModules: ['aws-sdk'],
                forceDockerBundling: false,
            },
        });
        // --- Lambda 함수에 권한 부여 ---
        postsTable.grantReadWriteData(helloLambda);
        helloLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'cognito-idp:SignUp',
                'cognito-idp:InitiateAuth',
                'cognito-idp:RespondToAuthChallenge',
                'cognito-idp:GlobalSignOut',
            ],
            resources: [userPool.userPoolArn],
        }));
        // --- API Gateway 정의 ---
        const api = new aws_apigateway_1.RestApi(this, 'BlogApi', {
            restApiName: 'BlogService',
            deployOptions: {
                stageName: 'dev',
            },
        });
        // --- Cognito Authorizer 정의 ---
        const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            identitySource: 'method.request.header.Authorization',
        });
        // --- Method Options 정의 ---
        const publicMethodOptions = {};
        const privateMethodOptions = {
            authorizer: cognitoAuthorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        };
        // --- Lambda 통합 ---
        const lambdaIntegration = new aws_apigateway_1.LambdaIntegration(helloLambda);
        // --- 리소스 및 메서드 등록 ---
        const helloResource = api.root.addResource('hello');
        helloResource.addMethod('GET', lambdaIntegration, publicMethodOptions);
        const postsResource = api.root.addResource('posts');
        postsResource.addMethod('GET', lambdaIntegration, publicMethodOptions);
        postsResource.addMethod('POST', lambdaIntegration, privateMethodOptions);
        const proxyResource = postsResource.addResource('{proxy+}');
        proxyResource.addMethod('GET', lambdaIntegration, publicMethodOptions);
        proxyResource.addMethod('PUT', lambdaIntegration, privateMethodOptions);
        proxyResource.addMethod('DELETE', lambdaIntegration, privateMethodOptions);
        const authResource = api.root.addResource('auth');
        authResource.addResource('signup')
            .addMethod('POST', lambdaIntegration, publicMethodOptions);
        authResource.addResource('login')
            .addMethod('POST', lambdaIntegration, publicMethodOptions);
        authResource.addResource('logout')
            .addMethod('POST', lambdaIntegration, privateMethodOptions);
        // --- CloudFormation Outputs ---
        new aws_cdk_lib_1.CfnOutput(this, 'ApiGatewayEndpoint', {
            value: api.url,
            description: 'The URL of the API Gateway endpoint',
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolId', {
            value: userPool.userPoolId,
            description: 'The ID of the Cognito User Pool',
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
            description: 'The Client ID of the Cognito User Pool App Client',
        });
    }
}
exports.InfraStack = InfraStack;

//new-blog/apps/infra/lib/InfraStack.ts

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

import { Construct } from 'constructs';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- Cognito User Pool 정의 ---
    const userPool = new cognito.UserPool(this, 'BlogUserPool', {
      userPoolName: `BlogUserPool-${cdk.Aws.ACCOUNT_ID}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true, username: false },
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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('BlogAppClient', {
      userPoolClientName: 'WebAppClient',
      generateSecret: false,
      authFlows: { userPassword: true },
    });

    // --- DynamoDB Posts Table 정의 ---
    const postsTable = new dynamodb.Table(this, 'PostsTable', {
      tableName: `BlogPosts-${cdk.Aws.ACCOUNT_ID}`,
      partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- S3 버킷 정의 (Lambda 에셋 업로드용) ---
    const artifactBucketName = `blog-lambda-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;
    const artifactBucket = new s3.Bucket(this, 'BlogArtifactBucket', {
      bucketName: artifactBucketName,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{ enabled: true, expiration: Duration.days(30) }],
    });

    // --- IAM Role 정의 및 권한 부여  ---
    const helloLambdaRole = new iam.Role(this, 'HelloLambdaServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    postsTable.grantReadWriteData(helloLambdaRole);
    // TypeScript 오류 수정: addToPolicy 사용
    helloLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:SignUp',
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:GlobalSignOut',
      ],
      resources: [userPool.userPoolArn],
    }));

    // --- Lambda Function (fromAsset으로 코드 묶음 및 업로드) ---
    const helloLambda = new NodejsFunction(this, 'HelloLambda', {
      functionName: 'blog-hello-lambda',
      entry: path.join(__dirname, '../../backend/src/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.seconds(10),
      environment: {
        NODE_ENV: 'production',
        MY_VARIABLE: 'hello from cdk',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      tracing: lambda.Tracing.ACTIVE,
      role: helloLambdaRole,
      bundling: { minify: true, externalModules: ['@aws-sdk'] },
    });

    // --- API Gateway 및 통합 ---
    const api = new RestApi(this, 'BlogApi', {
      restApiName: `BlogService-${cdk.Aws.ACCOUNT_ID}`,
      deployOptions: { stageName: 'dev', tracingEnabled: true },
    });
    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });
    const lambdaIntegration = new LambdaIntegration(helloLambda);
    const publicOpts: apigw.MethodOptions = {};
    const privateOpts: apigw.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    const helloRes = api.root.addResource('hello');
    helloRes.addMethod('GET', lambdaIntegration, publicOpts);

    const postsRes = api.root.addResource('posts');
    postsRes.addMethod('GET', lambdaIntegration, publicOpts);
    postsRes.addMethod('POST', lambdaIntegration, privateOpts);

    const proxyRes = postsRes.addResource('{proxy+}');
    proxyRes.addMethod('GET', lambdaIntegration, publicOpts);
    proxyRes.addMethod('PUT', lambdaIntegration, privateOpts);
    proxyRes.addMethod('DELETE', lambdaIntegration, privateOpts);

    const authRes = api.root.addResource('auth');
    authRes.addResource('signup').addMethod('POST', lambdaIntegration, publicOpts);
    authRes.addResource('login').addMethod('POST', lambdaIntegration, publicOpts);
    authRes.addResource('logout').addMethod('POST', lambdaIntegration, privateOpts);

    // --- CloudFormation Outputs ---
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: api.url,
      description: 'The URL of the API Gateway endpoint',
      exportName: 'BlogApiGatewayUrl',
    });
    new CfnOutput(this, 'ApiGatewayId', {
      value: api.restApiId,
      description: 'The ID of the API Gateway',
      exportName: 'BlogApiGatewayId',
    });
    new CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
      exportName: 'BlogUserPoolId',
    });
    new CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'The Client ID of the Cognito User Pool App Client',
      exportName: 'BlogUserPoolClientId',
    });
    new CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName,
      description: 'S3 Bucket name for Lambda artifacts',
      exportName: 'BlogArtifactBucketName',
    });

    // --- CloudWatch Alarms ---
    helloLambda.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'HelloLambdaErrorsAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'blog-hello-lambda function errors detected!',
      });

    api.metricServerError({ period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'ApiGatewayServerErrorAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'API Gateway 5xx server errors detected!',
      });

    postsTable.metric('ReadThrottleEvents', { period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'PostsTableReadThrottleAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'DynamoDB PostsTable read throttled!',
      });

    postsTable.metric('WriteThrottleEvents', { period: Duration.minutes(5), statistic: 'Sum' })
      .createAlarm(this, 'PostsTableWriteThrottleAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'DynamoDB PostsTable write throttled!',
      });
  }
}

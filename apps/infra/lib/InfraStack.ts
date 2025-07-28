// new-blog/apps/infra/lib/InfraStack.ts
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib'; // 'd' 오타 수정
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi, CognitoUserPoolsAuthorizer, MethodOptions, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// import * as sns from 'aws-cdk-lib/aws-sns';
// import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
// import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';


export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- Cognito User Pool 정의 ---
    const userPool = new cognito.UserPool(this, 'BlogUserPool', {
      userPoolName: `BlogUserPool-${cdk.Aws.ACCOUNT_ID}`,
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
      removalPolicy: RemovalPolicy.DESTROY,
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
      tableName: `BlogPosts-${cdk.Aws.ACCOUNT_ID}`,
      partitionKey: {
        name: 'postId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- Lambda 코드 저장을 위한 S3 버킷 정의 ---
    // 이 버킷은 CDK가 Lambda 코드 에셋을 자동으로 업로드할 때 사용합니다.
    const artifactBucketName = `blog-lambda-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;
    const artifactBucket = new s3.Bucket(this, 'BlogArtifactBucket', {
      bucketName: artifactBucketName,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(30),
        },
      ],
    });

    // --- Lambda Function을 위한 IAM Role 정의 ---
    const helloLambdaRole = new iam.Role(this, 'HelloLambdaServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    postsTable.grantReadWriteData(helloLambdaRole);

    helloLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:SignUp',
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:GlobalSignOut',
      ],
      resources: [userPool.userPoolArn],
    }));

    // --- Lambda Function 정의 ---
    const helloLambda = new NodejsFunction(this, 'HelloLambda', {
      functionName: 'blog-hello-lambda',
      entry: path.join(__dirname, '../../backend/src/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.seconds(10),
      environment: {
        NODE_ENV: 'production',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      tracing: lambda.Tracing.ACTIVE,
      role: helloLambdaRole,
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', '@aws-sdk/client-cognito-identity-provider'],
      },
    });

    // --- API Gateway 정의 ---
    const api = new RestApi(this, 'BlogApi', {
      restApiName: `BlogService-${cdk.Aws.ACCOUNT_ID}`,
      deployOptions: {
        stageName: 'dev',
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      }
    });

    // --- Cognito Authorizer 정의 ---
    const cognitoAuthorizer = new CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // --- Method Options 정의 ---
    const publicMethodOptions: MethodOptions = {};
    const privateMethodOptions: MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: AuthorizationType.COGNITO,
    };

    // --- Lambda 통합 및 리소스 등록 ---
    const lambdaIntegration = new LambdaIntegration(helloLambda);

    const apiProxy = api.root.addProxy({
        defaultIntegration: lambdaIntegration,
        defaultMethodOptions: publicMethodOptions, // 기본적으로 public, 개별적으로 private 설정
        anyMethod: false // anyMethod 비활성화하여 개별적으로 정의
    });

    api.root.addMethod('ANY', lambdaIntegration, privateMethodOptions); // /posts, /posts/123 등
    apiProxy.addMethod('ANY', lambdaIntegration, privateMethodOptions);

    // --- CloudFormation Outputs ---
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: api.url,
      description: 'The URL of the API Gateway endpoint',
      exportName: 'BlogApiGatewayUrl',
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
    helloLambda.metricErrors({
      period: Duration.minutes(5),
      statistic: 'Sum',
    }).createAlarm(this, 'HelloLambdaErrorsAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'blog-hello-lambda function errors detected!',
    });

    api.metricServerError({
      period: Duration.minutes(5),
      statistic: 'Sum',
    }).createAlarm(this, 'ApiGatewayServerErrorAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'API Gateway 5xx server errors detected!',
    });

    postsTable.metric('ReadThrottleEvents', {
      period: Duration.minutes(5),
      statistic: 'Sum',
    }).createAlarm(this, 'PostsTableReadThrottleAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'DynamoDB PostsTable read throttled!',
    });

    postsTable.metric('WriteThrottleEvents', {
      period: Duration.minutes(5),
      statistic: 'Sum',
    }).createAlarm(this, 'PostsTableWriteThrottleAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'DynamoDB PostsTable write throttled!',
    });
  }
}

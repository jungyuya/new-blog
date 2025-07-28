import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path'; // path 모듈은 더 이상 NodejsFunction의 entry에 직접 사용되지 않지만, 다른 용도로 남아있을 수 있습니다.
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3'; //S3 모듈 임포트
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'; // CloudWatch 모듈 임포트
// import * as sns from 'aws-cdk-lib/aws-sns'; // SNS 알림을 위한 모듈 (추후 SNS 설정 시 주석 해제)
// import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'; // SNS 구독을 위한 모듈 (추후 SNS 설정 시 주석 해제)
// import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'; // CloudWatch 알람 액션을 위한 모듈 (추후 SNS 설정 시 주석 해제)


export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
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

    // --- Lambda 코드 저장을 위한 S3 버킷 정의 (CI/CD 아티팩트 저장소) ---
    // S3 버킷 이름을 환경 변수에서 가져오거나, 환경 변수가 없으면 CDK에서 제공하는 계정 정보로 기본 이름을 구성합니다.
    // 이렇게 하면 코드에 AWS 계정 ID를 하드코딩하지 않아도 됩니다.
    // GitHub Actions에서 ARTIFACT_BUCKET_NAME 환경 변수를 설정하여 이 버킷 이름을 주입할 것입니다.
    const artifactBucketName = process.env.ARTIFACT_BUCKET_NAME || `blog-lambda-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;
    
    // 이 버킷은 이제 CDK가 직접 생성하고 관리하게 됩니다.
    // 따라서, 이전에 'Day 0'에서 수동으로 생성했던 버킷이 이와 이름이 같다면,
    // CI/CD 배포 전에 수동으로 생성한 버킷을 삭제해야 합니다. (아래 팁 참조)
    const artifactBucket = new s3.Bucket(this, 'BlogArtifactBucket', {
      bucketName: artifactBucketName, // 환경 변수 또는 기본값 사용
      versioned: true, // 버전 관리 활성화: Lambda 롤백 등 안정성 향상에 중요
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 스택 삭제 시 버킷과 내용도 함께 삭제 (개발 환경에서 편리)
      autoDeleteObjects: true, // 버킷 내 객체 자동 삭제 (removalPolicy: DESTROY와 함께 사용)
    });

    // --- Lambda Function 정의 (S3 버킷에서 코드 로드하도록 변경) ---
    // GITHUB_SHA는 GitHub Actions에서 제공하는 환경 변수입니다.
    // 로컬에서 테스트할 때는 'latest'로 폴백됩니다.
    const lambdaCodeS3Key = `backend/${process.env.GITHUB_SHA || 'latest'}.zip`;

    const helloLambda = new NodejsFunction(this, 'HelloLambda', {
      functionName: 'blog-hello-lambda',
      code: lambda.Code.fromBucket(artifactBucket, lambdaCodeS3Key), // S3 버킷과 키를 통해 코드 참조
      handler: 'index.handler', // apps/backend/src/index.ts의 handler 함수
      runtime: Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        NODE_ENV: 'production',
        MY_VARIABLE: 'hello from cdk',
        TABLE_NAME: postsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      tracing: lambda.Tracing.ACTIVE, //X-Ray 트레이싱 활성화 (Observability)
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
    const api = new RestApi(this, 'BlogApi', {
      restApiName: 'BlogService',
      deployOptions: {
        stageName: 'dev',
        tracingEnabled: true, // API Gateway X-Ray 트레이싱 활성화 (Observability)
      },
    });

    // --- Cognito Authorizer 정의 ---
    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // --- Method Options 정의 ---
    const publicMethodOptions: apigw.MethodOptions = {};

    const privateMethodOptions: apigw.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    // --- Lambda 통합 ---
    const lambdaIntegration = new LambdaIntegration(helloLambda);

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

    // --- CloudFormation Outputs (프론트엔드 및 CI/CD에서 참조) ---
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: api.url,
      description: 'The URL of the API Gateway endpoint',
      exportName: 'BlogApiGatewayUrl', // 프론트엔드에서 참조할 이름
    });
    new CfnOutput(this, 'ApiGatewayId', {
      value: api.restApiId,
      description: 'The ID of the API Gateway',
      exportName: 'BlogApiGatewayId', // 프론트엔드에서 참조할 이름
    });

    new CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
      exportName: 'BlogUserPoolId', // 프론트엔드에서 참조할 이름
    });
    new CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'The Client ID of the Cognito User Pool App Client',
      exportName: 'BlogUserPoolClientId', // 프론트엔드에서 참조할 이름
    });

    // S3 버킷 이름도 CfnOutput으로 내보냅니다.
    // 이제 이 버킷은 CDK가 관리하므로, GitHub Actions에서 참조할 수 있도록 Export 하는 것이 좋습니다.
    new CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName,
      description: 'S3 Bucket name for Lambda artifacts',
      exportName: 'BlogArtifactBucketName', // GitHub Actions에서 참조할 이름
    });

    // --- Observability: CloudWatch Alarms (Monitoring as Code) ---
    // Lambda 에러 알람
    helloLambda.metricErrors({
      period: Duration.minutes(5), // Metric 정의 시 period 지정
      statistic: 'Sum', // 통계 방식 지정
    }).createAlarm(this, 'HelloLambdaErrorsAlarm', {
      threshold: 1, // 1 에러 이상 발생 시
      evaluationPeriods: 1, // 1 기간 동안
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'blog-hello-lambda function errors detected!',
      // actions: [new cloudwatch_actions.SnsAction(yourSnsTopic)], // TODO: SNS Topic 생성 후 연결
    });

    // API Gateway 5xx 에러 알람 (서버 오류)
    api.metricServerError({
      period: Duration.minutes(5), // Metric 정의 시 period 지정
      statistic: 'Sum',
    }).createAlarm(this, 'ApiGatewayServerErrorAlarm', {
      threshold: 1, // 1 에러 이상 발생 시
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'API Gateway 5xx server errors detected!',
      // actions: [new cloudwatch_actions.SnsAction(yourSnsTopic)], // TODO: SNS Topic 생성 후 연결
    });

    // DynamoDB Read Throttled Requests 알람 (용량 부족     )
    postsTable.metric('ReadThrottleEvents', {
      period: Duration.minutes(5), // Metric 정의 시 period 지정
      statistic: 'Sum',
    }).createAlarm(this, 'PostsTableReadThrottleAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'DynamoDB PostsTable read throttled!',
      // actions: [new cloudwatch_actions.SnsAction(yourSnsTopic)], // TODO: SNS Topic 생성 후 연결
    });

    // DynamoDB Write Throttled Requests 알람 (용량 부족)
    postsTable.metric('WriteThrottleEvents', {
      period: Duration.minutes(5), // Metric 정의 시 period  지정
      statistic: 'Sum',
    }).createAlarm(this, 'PostsTableWriteThrottleAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'DynamoDB PostsTable write throttled!',
      // actions: [new cloudwatch_actions.SnsAction(yourSnsTopic)], //TODO: SNS Topic 생성 후 연결
    });

    // TODO: SNS Topic 정의 (알람을 받을 이메일 주소 연결)
    // const alarmSnsTopic = new sns.Topic(this, 'AlarmSnsTopic', {
    //   displayName: 'Blog Service Alarms',
    // });
    // alarmSnsTopic.addSubscription(new sns_subscriptions.EmailSubscription('your-email@example.com'));
    // 각 알람의 actions 배열에 new cloudwatch_actions.SnsAction(alarmSnsTopic) 추가

  }
}
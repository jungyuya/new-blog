import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. Lambda 함수 정의
    // 백엔드 워크스페이스의 빌드 결과물(dist)을 Lambda 코드로 사용합니다.
    const helloLambda = new NodejsFunction(this, 'HelloLambda', {
      functionName: 'blog-hello-lambda', // Lambda 함수 이름 (원하는 이름으로 변경 가능)
      entry: path.join(__dirname, '../../backend/dist/src/index.js'), // 백엔드 워크스페이스의 컴파일된 파일 경로
      handler: 'handler', // Lambda 함수 내에서 export 한 핸들러 함수의 이름 (index.ts의 export const handler)
      runtime: Runtime.NODEJS_20_X, // Node.js 20 런타임 사용
      memorySize: 128, // 람다 메모리 (기본값)
      timeout: Duration.seconds(10), // 람다 타임아웃
      environment: { // 람다 환경 변수 (필요시 추가)
        NODE_ENV: 'production',
        MY_VARIABLE: 'hello from cdk',
      },
      bundling: { // Lambda 함수 배포 시 종속성 번들링 설정
        externalModules: ['aws-sdk'], // AWS Lambda 런타임에 기본 포함된 aws-sdk는 번들링에서 제외하여 배포 크기 최적화
        forceDockerBundling: false, // 로컬 환경에 Docker가 없을 경우 false로 설정하여 로컬 Node.js로 번들링 시도
                                   // Docker가 설치되어 있고 일관된 환경을 원하면 true
      },
      // 로그 그룹 생성 및 보존 기간 설정
      // logRetention: RetentionDays.ONE_WEEK, // CloudWatch Logs 보존 기간 (선택 사항)
    });

    // 2. API Gateway 정의
    // Lambda 함수를 HTTP 엔드포인트로 노출합니다.
    const api = new RestApi(this, 'BlogApi', {
      restApiName: 'BlogService', // API Gateway 이름
      description: 'API Gateway for Blog Backend',
      deployOptions: {
        stageName: 'dev', // 배포 스테이지 이름 (개발 환경)
      },
      defaultCorsPreflightOptions: { // 모든 API Gateway 경로에 대한 CORS 사전 검사 옵션 (개발용)
        allowOrigins: ['*'], // 모든 Origin 허용
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        maxAge: Duration.days(1),
      },
    });

    // 3. API Gateway에 Lambda 통합 (GET /hello)
    // "/hello" 경로로 들어오는 GET 요청을 위에서 정의한 Lambda 함수와 연결합니다.
    const helloResource = api.root.addResource('hello'); // /hello 경로 추가
    helloResource.addMethod('GET', new LambdaIntegration(helloLambda)); // GET 메서드와 Lambda 통합

    // 4. 배포 후 API Gateway 엔드포인트 URL 출력
    // 배포가 완료되면 이 URL을 통해 Lambda 함수를 호출할 수 있습니다.
    new CfnOutput(this, 'ApiGatewayEndpoint', {
      value: api.urlForPath('/hello'), // /hello 경로에 대한 URL 출력
      description: 'The URL for the Hello Lambda API endpoint',
    });
  }
}
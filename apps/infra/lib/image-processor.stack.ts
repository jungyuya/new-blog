// 파일 위치: apps/infra/lib/image-processor.stack.ts
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';


export interface ImageProcessorStackProps extends StackProps {
    sourceBucket: s3.IBucket;
}

export class ImageProcessorStack extends Stack {
    public readonly imageProcessorFunction: lambda.IFunction;

    constructor(scope: Construct, id: string, props: ImageProcessorStackProps) {
        super(scope, id, props);

        // --- [입력] BlogStack으로부터 전달받은 S3 버킷 객체 ---
        const sourceBucket = props.sourceBucket;
        const projectRoot = path.join(__dirname, '..', '..', '..');

        // =================================================================
        // SECTION 1: [수정] 자체 빌드 Sharp Lambda Layer
        // =================================================================
        // Why: 외부 Layer의 권한 문제를 회피하고, 의존성을 완벽하게 제어하기 위해
        //      CDK의 bundling 기능을 사용하여 우리만의 Layer를 직접 빌드합니다.
        const sharpLayer = new lambda.LayerVersion(this, 'SharpLambdaLayer', {
            layerVersionName: `sharp-layer-${this.stackName}`,
            description: 'A Lambda Layer for the sharp image processing library, built from a local zip file.',

            // [핵심 수정] 이제 CDK는 빌드를 수행하지 않고, 이미 존재하는 zip 파일을 그대로 사용합니다.
            // projectRoot 변수는 JUNGYU 님의 기존 코드에 이미 정의되어 있습니다.
            code: lambda.Code.fromAsset(path.join(projectRoot, 'out', 'sharp-layer.zip')),

            compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
            compatibleArchitectures: [lambda.Architecture.ARM_64],
        });

        // =================================================================
        // SECTION 2: 이미지 처리 Lambda 함수 정의 (NodejsFunction Construct)
        // =================================================================
        // (경로만 projectRoot를 사용하도록 유지.)
        this.imageProcessorFunction = new NodejsFunction(this, 'ImageProcessorFunction', {

            functionName: `image-processor-func-${this.stackName}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.ARM_64,

            // Lambda 함수의 소스 코드 진입점은 독립 프로젝트를 가리킵니다.
            entry: path.join(projectRoot, 'image-processor-service', 'src', 'index.ts'),
            handler: 'handler',

            memorySize: 2048,
            timeout: cdk.Duration.seconds(120),

            bundling: {
                externalModules: ['sharp', '@aws-sdk/*'],
            },

            // [수정] 직접 만든 'sharpLayer'를 참조합니다.
            layers: [sharpLayer],
        });
        // =================================================================
        // SECTION 3: [수정] EventBridge 규칙 생성 및 Lambda 트리거
        // =================================================================
        // 1. 이벤트 규칙(Rule)을 생성합니다.
        const rule = new events.Rule(this, 'ImageUploadedRule', {
            // [핵심] AWS 기본 이벤트 버스를 사용합니다.
            eventBus: events.EventBus.fromEventBusName(this, 'DefaultEventBus', 'default'),
            description: 'Rule to trigger when a new image is uploaded to the S3 bucket.',

            // 2. [핵심] 이벤트 패턴(Event Pattern)을 정의합니다.
            //    이 패턴과 일치하는 이벤트만 이 규칙에 의해 포착됩니다.
            eventPattern: {
                source: ['aws.s3'], // 이벤트 소스는 S3
                detailType: ['Object Created'], // 이벤트 타입은 'Object Created'
                detail: {
                    bucket: {
                        // [핵심] 버킷 이름은 BlogStack에서 직접 참조하는 대신,
                        //        props를 통해 전달받은 이름을 사용합니다.
                        name: [props.sourceBucket.bucketName],
                    },
                    object: {
                        // 'uploads/' 폴더에 있는 객체만 대상으로 합니다.
                        key: [{ prefix: 'uploads/' }],
                    },
                },
            },
        });

        // 3. 규칙의 대상(Target)으로 우리의 Lambda 함수를 지정합니다.
        rule.addTarget(new targets.LambdaFunction(this.imageProcessorFunction));

        // 4. Lambda 함수에 S3 버킷 접근 권한을 부여합니다.
        props.sourceBucket.grantRead(this.imageProcessorFunction, 'uploads/*');
        props.sourceBucket.grantDelete(this.imageProcessorFunction, 'uploads/*');
        props.sourceBucket.grantWrite(this.imageProcessorFunction, 'images/*');
        props.sourceBucket.grantWrite(this.imageProcessorFunction, 'thumbnails/*');
    }
}
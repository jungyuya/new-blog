// 파일 위치: apps/infra/lib/cicd-stack.ts
// 최종 버전: v2025.08.12-Patched-Runner Docker Ready
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as fs from 'fs';
import * as path from 'path';

export class CiCdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ===================================================================================
    // SECTION 1: 네트워크 및 보안 그룹
    // ===================================================================================
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const runnerSg = new ec2.SecurityGroup(this, 'RunnerSecurityGroup', {
      vpc,
      description: 'Security group for the EC2 self-hosted runner',
      allowAllOutbound: true,
    });

    // ===================================================================================
    // SECTION 2: IAM 역할 및 권한
    // ===================================================================================
    const runnerRole = new iam.Role(this, 'RunnerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM Role for the self-hosted runner EC2 instance',
    });

    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    // [기존] 임시 AdministratorAccess 제거
    // runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    // [최종 수정] ECR에 대한 충분한 권한을 부여하는 관리형 정책을 추가합니다.
    // 이 정책은 이미지 푸시, 풀, 그리고 캐시 매니페스트 관리에 필요한 모든 권한을 포함합니다.
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));

    // [추가] CDK 배포를 위한 CloudFormation 권한
    runnerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameters'], // 여러 파라미터를 한 번에 가져올 수 있는 GetParameters 권장
      // 파라미터 경로의 시작 부분('/new-blog/cicd/')을 지정하여,
      // 해당 경로 아래의 모든 파라미터에 대한 접근을 허용합니다.
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/new-blog/cicd/*`],
    }));

    // [추가] S3 캐시 및 정적 에셋 동기화를 위한 권한
    // (이 부분은 BlogInfraStack에서 생성된 버킷 ARN을 참조해야 할 수 있습니다.
    //  우선은 간단하게 모든 S3에 대한 권한을 부여하고, 나중에 최소 권한으로 수정합니다.)
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));


    const githubPatSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubPatSecret', 'cicd/github-runner-pat');
    githubPatSecret.grantRead(runnerRole);

    // grantRead 메소드를 사용하여 읽기 권한을 명시적으로 부여합니다.
    githubPatSecret.grantRead(runnerRole);

    // ===================================================================================
    // SECTION 3: EC2 인스턴스 및 UserData 정의
    // ===================================================================================
    const runnerInstance = new ec2.Instance(this, 'GitHubRunnerInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        cachedInContext: true,
      }),
      securityGroup: runnerSg,
      role: runnerRole,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
          }),
        },
      ],
    });

    // (cicd-stack.ts 의 userData 부분)
    const userData = ec2.UserData.forLinux();

    // 1. 필수 패키지 설치 (root 권한)
    userData.addCommands(
      'dnf update -y',
      'dnf install -y git jq docker aws-cli',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user || true'
    );

    // 2. 외부 스크립트 파일을 읽어옵니다.
    const setupScriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'setup_runner.sh');
    const setupScriptContent = fs.readFileSync(setupScriptPath, 'utf8');

    // 3. 스크립트 내용을 Base64로 인코딩하여 UserData에 추가하고, EC2에서 디코딩하여 실행합니다.
    userData.addCommands(
      // 스크립트 파일을 /home/ec2-user 디렉토리에 생성합니다.
      `echo "${Buffer.from(setupScriptContent).toString('base64')}" | base64 -d > /home/ec2-user/setup_runner.sh`,
      // 파일 소유자와 실행 권한을 설정합니다.
      'chown ec2-user:ec2-user /home/ec2-user/setup_runner.sh',
      'chmod +x /home/ec2-user/setup_runner.sh',
      // ec2-user 권한으로 스크립트를 최종 실행합니다.
      'sudo -u ec2-user /home/ec2-user/setup_runner.sh'
    );

    runnerInstance.addUserData(userData.render());


    // ===================================================================================
    // SECTION 4: 네트워크 주소 설정
    // ===================================================================================
    const runnerEip = new ec2.CfnEIP(this, 'RunnerEIP');

    new ec2.CfnEIPAssociation(this, 'RunnerEIPAssociation', {
      eip: runnerEip.ref,
      instanceId: runnerInstance.instanceId,
    });

    // ===================================================================================
    // SECTION 5: 스택 출력
    // ===================================================================================
    new cdk.CfnOutput(this, 'RunnerPublicIP', {
      value: runnerEip.ref,
      description: 'Public IP address of the self-hosted runner EC2 instance.',
    });
  }
}

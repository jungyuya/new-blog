// 파일 위치: apps/infra/lib/cicd-stack.ts
// 최종 버전: v2025.08.13-ParameterStore-Integration
// 역할: Jun-gyu님의 안정적인 UserData 방식을 유지하면서,
//       모든 비밀 정보 관리를 Parameter Store 기반으로 전환하고,
//       필요한 모든 IAM 권한을 명시적으로 부여한 최종 완성본

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
// [수정] secretsmanager는 더 이상 필요 없으므로 주석 처리 또는 삭제
// import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'; 
import * as fs from 'fs';
import * as path from 'path';

export class CiCdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ===================================================================================
    // SECTION 1: 네트워크 및 보안 그룹 (변경 없음)
    // ===================================================================================
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const runnerSg = new ec2.SecurityGroup(this, 'RunnerSecurityGroup', {
      vpc,
      description: 'Security group for the EC2 self-hosted runner',
      allowAllOutbound: true,
    });
    // [참고] Ingress Rule은 보안 강화를 위해 CDK 코드에서 직접 관리하는 것이 좋습니다.
    // runnerSg.addIngressRule(ec2.Peer.ip('YOUR_IP/32'), ec2.Port.tcp(22), 'Allow SSH from my IP');


    // ===================================================================================
    // SECTION 2: IAM 역할 및 권한 (최종 수정)
    // ===================================================================================
    const runnerRole = new iam.Role(this, 'RunnerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM Role for the self-hosted runner EC2 instance',
    });

    // --- 기본 관리형 정책 ---
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));

    // --- [최종 수정] Parameter Store 접근 권한 ---
    // Runner가 /new-blog/cicd/ 경로 아래의 모든 파라미터를 읽을 수 있도록 허용합니다.
    const parameterStoreArn = `arn:aws:ssm:${this.region}:${this.account}:parameter/new-blog/cicd/*`;
    runnerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParametersByPath', 'ssm:GetParameter'],
      resources: [parameterStoreArn],
    }));

    // --- [최종 수정] CloudFront 캐시 무효화 권한 ---
    runnerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: ['*'], // 모든 CloudFront 배포에 대한 권한
    }));

    // --- [최종 수정] S3 및 CDK 배포를 위한 권한 ---
    // 기존의 넓은 권한을 유지하되, 나중에 최소 권한으로 수정할 것을 권장합니다.
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    runnerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudformation:*', 'iam:PassRole', 'sts:AssumeRole'],
      resources: ['*'],
    }));

    // [수정] Secrets Manager 관련 코드는 모두 삭제합니다.
    // const githubPatSecret = secretsmanager.Secret.fromSecretNameV2(...);
    // githubPatSecret.grantRead(runnerRole);


    // ===================================================================================
    // SECTION 3: EC2 인스턴스 및 UserData 정의 (변경 없음 - Jun-gyu님 방식 유지)
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

    const userData = ec2.UserData.forLinux();

    // 1. 필수 패키지 설치 (root 권한)
    userData.addCommands(
      'dnf update -y',
      'dnf install -y git jq docker', // aws-cli는 Amazon Linux 2023에 기본 포함
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user || true'
    );

    // 2. 외부 스크립트 파일을 읽어옵니다.
    const setupScriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'setup_runner.sh');
    const setupScriptContent = fs.readFileSync(setupScriptPath, 'utf8');

    // 3. 스크립트 내용을 Base64로 인코딩하여 UserData에 추가하고, EC2에서 디코딩하여 실행합니다.
    userData.addCommands(
      `echo "${Buffer.from(setupScriptContent).toString('base64')}" | base64 -d > /home/ec2-user/setup_runner.sh`,
      'chown ec2-user:ec2-user /home/ec2-user/setup_runner.sh',
      'chmod +x /home/ec2-user/setup_runner.sh',
      'sudo -u ec2-user /home/ec2-user/setup_runner.sh'
    );

    runnerInstance.addUserData(userData.render());


    // ===================================================================================
    // SECTION 4: 네트워크 주소 설정 (변경 없음)
    // ===================================================================================
    const runnerEip = new ec2.CfnEIP(this, 'RunnerEIP');

    new ec2.CfnEIPAssociation(this, 'RunnerEIPAssociation', {
      eip: runnerEip.ref,
      instanceId: runnerInstance.instanceId,
    });

    // ===================================================================================
    // SECTION 5: 스택 출력 (변경 없음)
    // ===================================================================================
    new cdk.CfnOutput(this, 'RunnerPublicIP', {
      value: runnerEip.ref,
      description: 'Public IP address of the self-hosted runner EC2 instance.',
    });
  }
}
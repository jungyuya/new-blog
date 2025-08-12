// 파일 위치: apps/infra/lib/cicd-stack.ts
// 최종 버전: v2025.08.12-Patched-RunnerDockerReady
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

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

    const secretsManagerEndpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
    });

    secretsManagerEndpoint.connections.allowDefaultPortFrom(runnerSg);

    // ===================================================================================
    // SECTION 2: IAM 역할 및 권한
    // ===================================================================================
    const runnerRole = new iam.Role(this, 'RunnerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM Role for the self-hosted runner EC2 instance',
    });

    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')); // 임시 허용 (첫배포)

    const githubPatSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubPatSecret', 'cicd/github-runner-pat');
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

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // --- 1. 필수 패키지 설치 (root 권한) ---
      'dnf update -y',
      'dnf install -y git jq docker aws-cli',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user',

      // --- 2. ec2-user로 전환하여, Git 리포지토리에서 설치 스크립트를 가져와 실행 ---
      // sudo -iu ec2-user: ec2-user로 로그인 쉘을 실행하여 환경을 완벽하게 설정합니다.
      // bash -c "...": 따옴표 안의 전체 스크립트를 단일 명령으로 실행하여 순서를 보장합니다.
      `sudo -iu ec2-user bash -c "set -euo pipefail
    echo '[INFO] Starting setup as ec2-user...'

    # Git Clone (재시도 로직 포함)
    if [ ! -d /home/ec2-user/new-blog ]; then
      until git clone https://github.com/jungyuya/new-blog.git /home/ec2-user/new-blog; do
        echo 'git clone failed, retrying in 5 seconds...'
        sleep 5
      done
    fi
    
    cd /home/ec2-user/new-blog

    # 스크립트 실행
    if [ -f ./scripts/setup_runner.sh ]; then
      echo '[INFO] Found setup_runner.sh, executing...'
      chmod +x ./scripts/setup_runner.sh
      # [최종 수정] tee를 제거하고, 스크립트가 자신의 로그를 책임지도록 합니다.
      ./scripts/setup_runner.sh
    else
      echo '[ERROR] setup_runner.sh not found in repository.'
      exit 1
    fi

    echo '[INFO] Finished setup as ec2-user.'
  "`,

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

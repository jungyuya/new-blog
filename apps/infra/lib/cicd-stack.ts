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
      // --- root 사용자로 실행되는 부분 ---
      'dnf update -y',
      'dnf install -y git jq docker',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user', // [수정] 'usod' 타이포 수정

      // --- ec2-user 사용자로 안전하게 단일 블록 실행 ---
      // sudo -iu ec2-user: ec2-user로 로그인 쉘을 실행하여 환경을 완벽하게 설정
      // bash -c "...": 따옴표 안의 전체 스크립트를 bash 쉘에서 실행
      `sudo -iu ec2-user bash -c "set -euo pipefail
    echo '--- Starting setup as ec2-user ---'

    # git clone (네트워크 오류에 대비한 재시도 루프 포함)
    if [ ! -d /home/ec2-user/new-blog ]; then
      until git clone https://github.com/jungyuya/new-blog.git /home/ec2-user/new-blog; do
        echo 'git clone failed, retrying in 5 seconds...'
        sleep 5
      done
    fi
    
    cd /home/ec2-user/new-blog

    # 스크립트가 존재하는지 확인 후, 실행 권한을 부여하고 실행
    # 모든 출력을 tee 명령어로 로그 파일과 콘솔에 동시에 기록하여 디버깅 용이성 확보
    if [ -f ./scripts/setup_runner.sh ]; then
      chmod +x ./scripts/setup_runner.sh
      ./scripts/setup_runner.sh 2>&1 | tee /home/ec2-user/setup_runner.log
    else
      echo 'ERROR: setup_runner.sh not found in repository.' | tee /home/ec2-user/setup_runner.log
      exit 1
    fi

    echo '--- Finished setup as ec2-user ---'
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

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

    // (cicd-stack.ts 의 userData 부분)
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // root 권한으로 필요한 패키지 설치
      'dnf update -y',
      'dnf install -y git jq docker aws-cli -y',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user || true',

      // per-boot wrapper 스크립트를 안전하게 생성 (heredoc: single-quoted BOOT 사용으로 변수 확장 방지)
      `cat > /var/lib/cloud/scripts/per-boot/setup_runner_wrapper.sh <<'BOOT'
#!/bin/bash
set -euo pipefail

# 안전한 로그 파일: /home/ec2-user/runner_setup.log (append)
LOGFILE="/home/ec2-user/runner_setup.log"
mkdir -p /home/ec2-user
touch "$LOGFILE"
chown ec2-user:ec2-user "$LOGFILE" || true

# 모든 출력을 로그 파일 및 syslog로 보냄 (절대 /dev/console에 직접 쓰지 않습니다)
exec > >(tee -a "$LOGFILE" | logger -t runner-setup) 2>&1

echo "[WRAPPER] $(date -u) - start"

# 안전하게 ec2-user 권한으로 repo clone/pull 수행
sudo -u ec2-user bash -lc '
  set -euo pipefail
  cd /home/ec2-user || exit 1
  if [ ! -d new-blog ]; then
    echo "[WRAPPER] cloning repository..."
    git clone --depth 1 https://github.com/jungyuya/new-blog.git new-blog
  else
    echo "[WRAPPER] repository exists, attempting git pull..."
    cd new-blog || exit 1
    git pull || echo "[WRAPPER] git pull failed, continuing"
  fi
'

# 소유권 보장
chown -R ec2-user:ec2-user /home/ec2-user/new-blog || true

# repo 내 스크립트가 존재하면 ec2-user로 실행 (스크립트가 직접 로그를 담당)
if [ -f /home/ec2-user/new-blog/scripts/setup_runner.sh ]; then
  echo "[WRAPPER] executing setup_runner.sh as ec2-user..."
  sudo -u ec2-user bash -lc '/home/ec2-user/new-blog/scripts/setup_runner.sh'
else
  echo "[WRAPPER][ERROR] setup_runner.sh not found in /home/ec2-user/new-blog/scripts"
  exit 1
fi

echo "[WRAPPER] $(date -u) - end"
BOOT`,

      // 안전: 실행권한 보장 (cloud-init는 per-boot 스크립트를 자동 실행하지만 권한 확인)
      'chmod +x /var/lib/cloud/scripts/per-boot/setup_runner_wrapper.sh || true'
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

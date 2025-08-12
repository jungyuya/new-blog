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
      // --- 1. 필수 패키지 설치 (root 권한) ---
      'dnf update -y',
      'dnf install -y git jq docker aws-cli',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user || true',

      // --- 2. Wrapper 스크립트 생성 (heredoc 사용) ---
      // per-instance 디렉토리를 사용하여, 인스턴스 생성 시 '단 한 번만' 실행되도록 보장합니다.
      `cat > /var/lib/cloud/scripts/per-instance/setup_runner_wrapper.sh <<'BOOT_WRAPPER_EOF'
#!/bin/bash
set -euo pipefail

# 안전한 로그 파일 설정
LOGFILE="/home/ec2-user/runner_setup.log"
mkdir -p /home/ec2-user
touch "$LOGFILE"
chown ec2-user:ec2-user "$LOGFILE" || true

# 모든 출력을 로그 파일 및 syslog로 보냅니다.
exec > >(tee -a "$LOGFILE" | logger -t runner-wrapper) 2>&1

echo "[WRAPPER] $(date -u) - Wrapper script started."

# ec2-user 권한으로 repo clone/pull 수행
sudo -u ec2-user bash -lc '
  set -euo pipefail
  cd /home/ec2-user || exit 1
  if [ ! -d new-blog ]; then
    echo "[WRAPPER] Cloning repository..."
    git clone --depth 1 https://github.com/jungyuya/new-blog.git new-blog
  else
    echo "[WRAPPER] Repository exists, attempting git pull..."
    cd new-blog || exit 1
    git pull || echo "[WRAPPER] git pull failed, continuing."
  fi
'

# 소유권 재확인
chown -R ec2-user:ec2-user /home/ec2-user/new-blog || true

# repo 내부의 setup_runner.sh를 ec2-user 권한으로 실행
if [ -f /home/ec2-user/new-blog/scripts/setup_runner.sh ]; then
  echo "[WRAPPER] Executing setup_runner.sh as ec2-user..."
  sudo -u ec2-user bash -lc '/home/ec2-user/new-blog/scripts/setup_runner.sh'
else
  echo "[WRAPPER][ERROR] setup_runner.sh not found in repository."
  exit 1
fi

echo "[WRAPPER] $(date -u) - Wrapper script finished."
BOOT_WRAPPER_EOF`,

      // --- 3. 생성된 Wrapper 스크립트에 실행 권한 부여 ---
      'chmod +x /var/lib/cloud/scripts/per-instance/setup_runner_wrapper.sh',

      // --- 4. Wrapper 스크립트 즉시 실행 (가장 중요한 부분) ---
      // 이 명령어가 타이밍 문제를 해결합니다.
      'bash /var/lib/cloud/scripts/per-instance/setup_runner_wrapper.sh || echo "[ERROR] Wrapper script execution failed. Check logs for details."'
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

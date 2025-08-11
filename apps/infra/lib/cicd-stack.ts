// 파일 위치: apps/infra/lib/cicd-stack.ts
// 최종 버전: v2025.08.08-Fortified (syntax-fixed)
// 역할: 동료 검토를 통해 안정성과 예측 가능성이 강화된, 최종 CI/CD 인프라 구성

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
      privateDnsEnabled: true, // VPC 내에서 secretsmanager.{region}.amazonaws.com 도메인을 사설 IP로 해석하도록 합니다.
    });

    // 엔드포인트의 보안 그룹에, Runner가 HTTPS로 접근할 수 있도록 허용 규칙을 추가합니다.
    secretsManagerEndpoint.connections.allowDefaultPortFrom(runnerSg);

    // ===================================================================================
    // SECTION 2: IAM 역할 및 권한
    // ===================================================================================
    const runnerRole = new iam.Role(this, 'RunnerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM Role for the self-hosted runner EC2 instance',
    });

    // [핵심 1] SSM 접속 권한을 추가합니다.
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    // [핵심 2] CDK 배포, ECR 푸시, S3 동기화 등 모든 작업을 수행할 수 있도록
    // AdministratorAccess 권한을 부여합니다.
    // 이것은 우리가 OIDC 역할에 부여했던 것과 동일한 권한 수준입니다.
    runnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    // Secrets Manager 읽기 권한은 AdministratorAccess에 이미 포함되어 있으므로,
    // 별도로 추가할 필요가 없습니다. 하지만 명시성을 위해 남겨두는 것도 좋습니다.
    const githubPatSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubPatSecret', 'cicd/github-runner-pat');
    githubPatSecret.grantRead(runnerRole);

    // ===================================================================================
    // SECTION 3: EC2 인스턴스 및 UserData 정의
    // ===================================================================================
    const runnerInstance = new ec2.Instance(this, 'GitHubRunnerInstance', {
      vpc,
      // [핵심 1] 인스턴스가 반드시 Public Subnet에 생성되도록 명시합니다.
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      // [핵심 2] AMI ID를 cdk.context.json에 캐싱하여, 의도치 않은 인스턴스 교체를 방지합니다.
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

    // 7. UserData (자동 시공 매뉴얼) 스크립트를 정의합니다.
    const userData = ec2.UserData.forLinux();

    // -- addCommands로 여러 문자열 인수를 전달하여 템플릿 인터폴레이션 충돌을 피합니다.
    userData.addCommands(
      // package manager 결정
      'if command -v dnf >/dev/null 2>&1; then PM=dnf; else PM=yum; fi',
      // 기본 업데이트 및 최소 필수 패키지 설치 (curl은 AMI에 기본으로 있는 경우가 많아 제외하여 충돌 회피)
      '$PM update -y',
      '$PM install -y git jq tar gzip libicu unzip sudo || true',

      // ---------- Docker 설치 (충돌 회피용: get.docker.com 사용) ----------
      // 이미 docker가 있으면 설치 스킵
      'if ! command -v docker >/dev/null 2>&1; then',
      '  echo "--- Installing Docker via get.docker.com ---"',
      '  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh || { echo "curl failed; aborting docker install" >&2; exit 1; }',
      '  sudo sh /tmp/get-docker.sh || { echo "get-docker.sh failed"; exit 1; }',
      'fi',

      // Docker 서비스 활성화 및 readiness 체크
      'sudo systemctl enable --now docker || echo "systemctl enable/start docker returned non-zero"',
      'for i in {1..30}; do',
      '  if sudo docker info >/dev/null 2>&1; then',
      '    echo "docker ready"',
      '    break',
      '  fi',
      '  echo "waiting for docker... ($i)"',
      '  sleep 2',
      'done',

      // docker 그룹에 ec2-user 추가 (있어도 무시)
      'sudo usermod -aG docker ec2-user || true',

      // ---------- AWS CLI 설치 (aarch64 zip 방식) ----------
      'if ! command -v aws >/dev/null 2>&1; then',
      '  echo "--- Installing AWS CLI v2 ---"',
      '  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "/tmp/awscliv2.zip" || { echo "awscli download failed" >&2; }',
      '  unzip -q /tmp/awscliv2.zip -d /tmp || true',
      '  sudo /tmp/aws/install || echo "aws install failed" >&2',
      '  rm -rf /tmp/aws /tmp/awscliv2.zip || true',
      'fi',

      // ---------- heredoc으로 setup_runner.sh 생성  ----------
      "cat <<'EOF' > /home/ec2-user/setup_runner.sh",
      '#!/bin/bash -xe',
      'exec > /home/ec2-user/runner_setup.log 2>&1',
      'echo "=== Runner setup started: $(date -u) ==="',
      '',
      '# 환경',
      'export HOME=/home/ec2-user',
      'export NVM_DIR="$HOME/.nvm"',
      'export RUNNER_DIR="$HOME/actions-runner"',
      'REPO_WEB_URL="https://github.com/jungyuya/new-blog"',
      'REPO_API_URL="https://api.github.com/repos/jungyuya/new-blog"',
      'SECRET_NAME="cicd/github-runner-pat"',
      'AWS_REGION="' + this.region + '"',
      '',
      '# 안전: 작업 디렉토리 보장',
      'mkdir -p "$RUNNER_DIR"',
      'chown ec2-user:ec2-user "$RUNNER_DIR"',
      '',
      '# 1) nvm, node, pnpm 설치 (이미 설치돼 있으면 건너뜀)',
      'if [ ! -d "$NVM_DIR" ]; then',
      '  echo "--- Installing nvm ---"',
      '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash',
      'fi',
      '# load nvm for current script',
      'if [ -s "$NVM_DIR/nvm.sh" ]; then',
      '  . "$NVM_DIR/nvm.sh"',
      'fi',
      'nvm install --lts || nvm install 22 || true',
      'npm install -g pnpm || true',
      '',
      '# 2) 다운로드 및 압축 해제',
      'cd "$RUNNER_DIR"',
      'LATEST_TAG=$(curl -sS --fail "https://api.github.com/repos/actions/runner/releases/latest" | jq -r .tag_name | sed \'s/^v//\')',
      'if [ -z "${LATEST_TAG}" ]; then',
      '  echo "ERROR: cannot determine latest runner version" >&2',
      '  exit 1',
      'fi',
      'TARBALL="actions-runner-linux-arm64-${LATEST_TAG}.tar.gz"',
      'if [ ! -f "${TARBALL}" ]; then',
      '  curl --fail --silent --show-error --retry 5 -L -o "${TARBALL}" "https://github.com/actions/runner/releases/download/v${LATEST_TAG}/${TARBALL}"',
      'fi',
      'tar -xzf "${TARBALL}"',
      '',
      '# 3) 설치 스크립트(의존성 설치) 실행: bin/installdependencies.sh 시도 후 실패시 수동 패키지 설치',
      'if [ -f "./bin/installdependencies.sh" ]; then',
      '  echo "--- Running provided installdependencies.sh ---"',
      '  sudo ./bin/installdependencies.sh || echo "installdependencies.sh failed or not fully supported"',
      'fi',
      '',
      '# 폴백: libicu 등 흔한 의존성 설치 (Amazon Linux 2023 등에서 필요)',
      'if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then',
      '  echo "--- Installing fallback distro packages for libicu etc. ---"',
      '  if command -v dnf >/dev/null 2>&1; then',
      '    sudo dnf install -y libicu icu libicu-devel libunwind || true',
      '  elif command -v apt-get >/dev/null 2>&1; then',
      '    sudo DEBIAN_FRONTEND=noninteractive apt-get update -y',
      '    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y libicu-dev libunwind8 || true',
      '  fi',
      'fi',
      '',
      '# 4) Secrets Manager에서 PAT 가져오기 (리전 명시)',
      'echo "--- Retrieving GitHub PAT from Secrets Manager (region: ' + this.region + ') ---"',
      '',
      '# ---------- 수정된 안전한 Secret 처리 시작 ----------',
      '# SecretString이 plain string일 수도 있고 JSON일 수도 있으므로 두 경우 모두 처리합니다.',
      'GITHUB_RAW=$(aws secretsmanager get-secret-value --secret-id "${SECRET_NAME}" --region "${AWS_REGION}" --query SecretString --output text 2>/dev/null || true)',
      'if [ -z "${GITHUB_RAW}" ]; then',
      '  echo "ERROR: Could not fetch GitHub PAT from Secrets Manager" >&2',
      '  exit 1',
      'fi',
      '# JSON이면 .GITHUB_PAT 키(우선) 또는 전체 문자열을 fallback으로 사용',
      'if echo "${GITHUB_RAW}" | jq -e . >/dev/null 2>&1; then',
      '  GITHUB_PAT=$(echo "${GITHUB_RAW}" | jq -r \'(.GITHUB_PAT // .) | tostring\')',
      'else',
      '  GITHUB_PAT="${GITHUB_RAW}"',
      'fi',
      '# 안전 로그: 실제 토큰을 노출하지 않도록 prefix만 출력 (운영에서는 이 줄 제거 권장)',
      'echo "PAT prefix: ${GITHUB_PAT:0:15} (hidden)"',
      '# ---------- 수정된 안전한 Secret 처리 끝 ----------',
      '',
      '# 5) registration token 요청 (API 경로 사용) - 재시도 로직 포함',
      'echo "--- Requesting registration token from GitHub API ---"',
      '',
      'attempts=0',
      'max_attempts=5',
      'RAW_REG_RESP=""',
      'BACKOFF=2',
      '',
      'while [ $attempts -lt $max_attempts ]; do',
      '  attempts=$((attempts+1))',
      '  RAW_REG_RESP=$(curl --silent --show-error -X POST -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${GITHUB_PAT}" -H "User-Agent: new-blog-cicd-runner-setup" --connect-timeout 10 --max-time 30 "${REPO_API_URL}/actions/runners/registration-token" 2>&1) && break || {',
      '    echo "registration-token attempt ${attempts} failed. Raw: ${RAW_REG_RESP}" >> /home/ec2-user/runner_setup.log',
      '    sleep $(( BACKOFF ** attempts ))',
      '  }',
      'done',
      '',
      'if [ -z "${RAW_REG_RESP}" ]; then',
      '  echo "ERROR: registration-token request failed after ${max_attempts} attempts" >&2',
      '  exit 1',
      'fi',
      '',
      'REG_TOKEN=$(echo "${RAW_REG_RESP}" | jq -r \'.token // empty\')',
      'if [ -z "${REG_TOKEN}" ]; then',
      '  echo "ERROR: registration token empty. Dumping raw response for debugging." >&2',
      '  echo "${RAW_REG_RESP}" >> /home/ec2-user/runner_setup.log',
      '  exit 1',
      'fi',
      '',
      'echo "Got registration token prefix: ${REG_TOKEN:0:20}..."',
      '',
      '# 6) Runner 구성 (ec2-user 권한으로 실행 - sudo 사용 금지)',
      'echo "--- Configuring runner ---"',
      '# ensure config.sh is executable',
      'chmod +x ./config.sh || true',
      '# run as ec2-user (this script runs as ec2-user because of how UserData `su - ec2-user -c` is invoked)',
      './config.sh --url "${REPO_WEB_URL}" --token "${REG_TOKEN}" --name "$(hostname)" --labels "self-hosted,linux,arm64" --unattended --replace',
      '',
      '# 7) 서비스 등록 / 시작: prefer svc.sh if present, else create systemd service',
      'if [ -f "./svc.sh" ]; then',
      '  echo "--- Installing svc.sh service ---"',
      '  sudo ./svc.sh install || true',
      '  sudo ./svc.sh start || true',
      'else',
      '  echo "--- Creating systemd service github-runner.service ---"',
      '  sudo tee /etc/systemd/system/github-runner.service > /dev/null <<SYSTEMD_EOF',
      '[Unit]',
      'Description=GitHub Actions Runner',
      'After=network.target',
      '',
      '[Service]',
      'User=ec2-user',
      'WorkingDirectory=${RUNNER_DIR}',
      'ExecStart=${RUNNER_DIR}/run.sh',
      'Restart=always',
      'RestartSec=5',
      'Environment=HOME=/home/ec2-user',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'SYSTEMD_EOF',
      '',
      '  sudo systemctl daemon-reload',
      '  sudo systemctl enable --now github-runner.service || true',
      'fi',
      '',
      'echo "=== Runner setup finished: $(date -u) ==="',
      'EOF',

      // heredoc 이후 원본대로 소유권/권한/실행
      'chown ec2-user:ec2-user /home/ec2-user/setup_runner.sh',
      'chmod +x /home/ec2-user/setup_runner.sh',
      // setup_runner.sh 내부가 docker 의존 작업(예: runner config/install/start) 수행하므로
      // docker 준비(install + readiness) -> usermod -> 파일 소유권 적용 -> 스크립트 실행 순서를 지켰습니다.
      'su - ec2-user -c "/home/ec2-user/setup_runner.sh"'
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

#!/bin/bash
# 파일 위치: scripts/setup_runner.sh (Masterpiece v3 Final - Parameter Store Version)
set -euo pipefail

# 모든 출력을 로그 파일과 시스템 로그(syslog)에 함께 기록
LOGFILE="/home/ec2-user/runner_setup.log"
exec > >(tee -a "$LOGFILE" | logger -t runner-setup) 2>&1

echo "[INFO] Runner setup script started at $(date -u)"

# --- 환경 변수 및 기본 디렉토리 설정 ---
export HOME="/home/ec2-user"
export RUNNER_DIR="$HOME/actions-runner"

# --- 멱등성 검사 ---
if [ -f "${RUNNER_DIR}/.runner" ]; then
  echo "[INFO] Runner already configured. Ensuring service is installed and started."
  cd "${RUNNER_DIR}"
  sudo ./svc.sh install || true
  sudo ./svc.sh start   || true
  echo "[INFO] Runner service ensured. Exiting."
  exit 0
fi

# --- IMDSv2 방식으로 AWS 리전 정보 가져오기 ---
get_imds() {
  token=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)
  if [ -n "$token" ]; then
    curl -s -H "X-aws-ec2-metadata-token: $token" "$@"
  else
    curl -s "$@"
  fi
}
AWS_REGION=$(get_imds http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)

# --- GitHub 관련 변수 ---
REPO_OWNER="jungyuya"
REPO_NAME="new-blog"
PARAMETER_PATH="/new-blog/cicd"

# --- Runner 디렉토리 생성 ---
mkdir -p "$RUNNER_DIR"
chown ec2-user:ec2-user "$RUNNER_DIR"
cd "$RUNNER_DIR"

# --- GitHub Actions Runner 다운로드 ---
LATEST_TAG=$(curl -s 'https://api.github.com/repos/actions/runner/releases/latest' \
  | jq -r .tag_name | sed 's/^v//')
TARBALL="actions-runner-linux-arm64-${LATEST_TAG}.tar.gz"
echo "[INFO] Downloading GitHub Runner v${LATEST_TAG}..."
n=0
until [ $n -ge 5 ]
do
  curl --fail --silent --show-error -L -o "${TARBALL}" \
    "https://github.com/actions/runner/releases/download/v${LATEST_TAG}/${TARBALL}" && break
  n=$((n+1))
  echo "[WARN] Tarball download failed, retry $n/5 in 3 seconds..."
  sleep 3
done
if [ ! -f "${TARBALL}" ]; then
  echo "[ERROR] Download failed after 5 retries." >&2
  exit 1
fi
tar xzf "${TARBALL}"

# --- 의존성 설치 ---
if [ -f "./bin/installdependencies.sh" ]; then
  echo "[INFO] Running provided installdependencies.sh..."
  sudo ./bin/installdependencies.sh || echo "[WARN] installdependencies.sh failed, continuing with fallback."
fi
if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then
  echo "[INFO] libicu not found. Installing fallback dependencies..."
  sudo dnf install -y libicu libunwind || true
fi

# --- Parameter Store에서 GitHub PAT 가져오기 ---
echo "[INFO] Retrieving GitHub PAT from SSM Parameter Store..."
GITHUB_PAT=$(aws ssm get-parameter \
  --name "${PARAMETER_PATH}/github-pat" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text \
  --region "${AWS_REGION}")

if [ -z "${GITHUB_PAT}" ] || [ "${GITHUB_PAT}" == "None" ]; then
  echo '[ERROR] Could not fetch GitHub PAT from SSM Parameter Store.' >&2
  exit 1
fi

# --- Runner 등록 토큰 요청 ---
echo "[INFO] Requesting registration token..."
REG_TOKEN=$(curl -sX POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token" \
  | jq -r .token)

if [ -z "${REG_TOKEN}" ]; then
  echo '[ERROR] Failed to get registration token.' >&2
  exit 1
fi

# --- Runner 구성 ---
echo "[INFO] Configuring runner..."
./config.sh \
  --url "https://github.com/${REPO_OWNER}/${REPO_NAME}" \
  --token "${REG_TOKEN}" \
  --name "$(hostname)" \
  --labels "self-hosted,linux,arm64" \
  --unattended --replace

# --- Runner 서비스 등록 및 시작 ---
echo "[INFO] Installing and starting runner service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo "[INFO] Runner setup script finished successfully at $(date -u)"

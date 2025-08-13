#!/bin/bash
# 파일 위치: scripts/setup_runner.sh (v6 - Docker Config Integrated)
set -euo pipefail

LOGFILE="/home/ec2-user/runner_setup.log"
exec > >(tee -a "$LOGFILE" | logger -t runner-setup) 2>&1
echo "[INFO] Runner setup script started at $(date -u)"
export HOME="/home/ec2-user"
export RUNNER_DIR="$HOME/actions-runner"
if [ -f "${RUNNER_DIR}/.runner" ]; then
  echo "[INFO] Runner already configured. Ensuring service is installed and started."
  cd "${RUNNER_DIR}"
  # [추가] Docker 설정이 누락되었을 수 있으므로, 재실행 시에도 설정을 확인하고 적용합니다.
  DOCKER_CONFIG_DIR="$HOME/.docker"
  ECR_URL="786382940028.dkr.ecr.${AWS_REGION:-ap-northeast-2}.amazonaws.com"
  mkdir -p "$DOCKER_CONFIG_DIR"
  if ! grep -q "ecr-login" "${DOCKER_CONFIG_DIR}/config.json" 2>/dev/null; then
    echo "[INFO] Docker credHelper for ECR not found, configuring..."
    cat > "${DOCKER_CONFIG_DIR}/config.json" <<EOF
{
    "credHelpers": {
        "${ECR_URL}": "ecr-login"
    }
}
EOF
    chown -R ec2-user:ec2-user "$DOCKER_CONFIG_DIR"
  fi
  sudo ./svc.sh install || true
  sudo ./svc.sh start   || true
  echo "[INFO] Runner service ensured. Exiting."
  exit 0
fi
get_imds() {
  token=$(curl -s -X PUT "http://169.254.169.24/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)
  if [ -n "$token" ]; then
    curl -s -H "X-aws-ec2-metadata-token: $token" "$@"
  else
    curl -s "$@"
  fi
}
AWS_REGION=$(get_imds http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)

REPO_OWNER="jungyuya"
REPO_NAME="new-blog"
PARAMETER_PATH="/new-blog/cicd"

mkdir -p "$RUNNER_DIR"
chown ec2-user:ec2-user "$RUNNER_DIR"

if ! command -v docker-credential-ecr-login >/dev/null 2>&1; then
  echo "[INFO] Installing docker-credential-ecr-login helper..."
  sudo dnf install -y amazon-ecr-credential-helper || true
fi

cd "$HOME"
if [ ! -d "$NVM_DIR" ]; then
  echo "--- Installing nvm ---"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi
nvm install 22
npm install -g pnpm

NODE_BIN_DIR="$NVM_DIR/versions/node/$(nvm version)/bin"
if [ -d "$NODE_BIN_DIR" ]; then
  sudo ln -sf "$NODE_BIN_DIR/node" /usr/bin/node
  sudo ln -sf "$NODE_BIN_DIR/npm" /usr/bin/npm
  sudo ln -sf "$NODE_BIN_DIR/npx" /usr/bin/npx
fi
if command -v pnpm >/dev/null 2>&1; then
  sudo ln -sf "$(command -v pnpm)" /usr/bin/pnpm
fi
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

cd "$RUNNER_DIR"
LATEST_TAG=$(curl -s 'https://api.github.com/repos/actions/runner/releases/latest' | jq -r .tag_name | sed 's/^v//')
TARBALL="actions-runner-linux-arm64-${LATEST_TAG}.tar.gz"
echo "[INFO] Downloading GitHub Runner v${LATEST_TAG}..."
n=0
until [ $n -ge 5 ]
do
  curl --fail --silent --show-error -L -o "${TARBALL}" "https://github.com/actions/runner/releases/download/v${LATEST_TAG}/${TARBALL}" && break
  n=$((n+1))
  echo "[WARN] Tarball download failed, retry $n/5 in 3 seconds..."
  sleep 3
done
if [ ! -f "${TARBALL}" ]; then
  echo "[ERROR] Download failed after 5 retries." >&2
  exit 1
fi
tar xzf "${TARBALL}"
if [ -f "./bin/installdependencies.sh" ]; then
  echo "[INFO] Running provided installdependencies.sh..."
  sudo ./bin/installdependencies.sh || echo "[WARN] installdependencies.sh failed, continuing with fallback."
fi
if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then
  echo "[INFO] libicu not found. Installing fallback dependencies..."
  sudo dnf install -y libicu libunwind || true
fi

echo "[INFO] Retrieving secrets from SSM Parameter Store..."
SECRETS_JSON=$(aws ssm get-parameters \
  --names "${PARAMETER_PATH}/github-pat" "${PARAMETER_PATH}/turbo-token" "${PARAMETER_PATH}/turbo-signature-key" \
  --with-decryption --query "Parameters" --output json --region "${AWS_REGION}")

GITHUB_PAT=$(echo "${SECRETS_JSON}" | jq -r '.[] | select(.Name=="'${PARAMETER_PATH}/github-pat'").Value')
export TURBO_TOKEN=$(echo "${SECRETS_JSON}" | jq -r '.[] | select(.Name=="'${PARAMETER_PATH}/turbo-token'").Value')
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=$(echo "${SECRETS_JSON}" | jq -r '.[] | select(.Name=="'${PARAMETER_PATH}/turbo-signature-key'").Value')

if [ -z "${GITHUB_PAT}" ]; then
  echo '[ERROR] Could not fetch GitHub PAT from SSM Parameter Store.' >&2
  exit 1
fi

echo "[INFO] Requesting registration token..."
REG_TOKEN=$(curl -sX POST -H "Authorization: token ${GITHUB_PAT}" "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token" | jq -r .token)
if [ -z "${REG_TOKEN}" ]; then
  echo '[ERROR] Failed to get registration token.' >&2
  exit 1
fi

echo "[INFO] Configuring runner..."
REPO_WEB_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}"
./config.sh --url "${REPO_WEB_URL}" --token "${REG_TOKEN}" --name "$(hostname)" --labels "self-hosted,linux,arm64" --unattended --replace

# --- [최종 수정] Docker가 ECR 인증 헬퍼를 사용하도록 설정 ---
# ec2-user의 Docker 설정 파일에, 우리 ECR 리포지토리에 대한 인증 헬퍼를 지정합니다.
DOCKER_CONFIG_DIR="$HOME/.docker"
mkdir -p "$DOCKER_CONFIG_DIR"
ECR_URL="786382940028.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "[INFO] Configuring Docker to use ECR credential helper for ${ECR_URL}..."
cat > "${DOCKER_CONFIG_DIR}/config.json" <<EOF
{
    "credHelpers": {
        "${ECR_URL}": "ecr-login"
    }
}
EOF
chown -R ec2-user:ec2-user "$DOCKER_CONFIG_DIR"

# --- 7. Runner를 systemd 서비스로 등록 및 시작 ---
echo "[INFO] Installing and starting runner service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo "[INFO] Runner setup script finished successfully at $(date -u)"
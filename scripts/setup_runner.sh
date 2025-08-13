#!/bin/bash
# 파일 위치: scripts/setup_runner.sh (Masterpiece v4 Final - SSM Edition)
set -euo pipefail

# ... (상단 로깅, 환경 변수, 멱등성 검사, IMDSv2 함수는 동일) ...
LOGFILE="/home/ec2-user/runner_setup.log"
exec > >(tee -a "$LOGFILE" | logger -t runner-setup) 2>&1
echo "[INFO] Runner setup script started at $(date -u)"
export HOME="/home/ec2-user"
export RUNNER_DIR="$HOME/actions-runner"
if [ -f "${RUNNER_DIR}/.runner" ]; then
  echo "[INFO] Runner already configured. Ensuring service is installed and started."
  cd "${RUNNER_DIR}"
  sudo ./svc.sh install || true
  sudo ./svc.sh start   || true
  echo "[INFO] Runner service ensured. Exiting."
  exit 0
fi
get_imds() {
  token=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)
  if [ -n "$token" ]; then
    curl -s -H "X-aws-ec2-metadata-token: $token" "$@"
  else
    curl -s "$@"
  fi
}
AWS_REGION=$(get_imds http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)

# --- [수정] GitHub 및 파라미터 관련 변수 설정 ---
REPO_OWNER="jungyuya"
REPO_NAME="new-blog"
PARAMETER_PATH="/new-blog/cicd" # 파라미터 경로의 시작 부분

# ... (Runner 디렉토리 생성, 다운로드, 의존성 설치는 동일) ...
mkdir -p "$RUNNER_DIR"
chown ec2-user:ec2-user "$RUNNER_DIR"
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

# --- [최종 수정] SSM Parameter Store에서 모든 비밀 정보 가져오기 ---
echo "[INFO] Retrieving secrets from SSM Parameter Store..."
# get-parameters를 사용하면 여러 값을 한 번의 API 호출로 가져올 수 있어 효율적입니다.
SECRETS_JSON=$(aws ssm get-parameters \
  --names "${PARAMETER_PATH}/github-pat" "${PARAMETER_PATH}/turbo-token" "${PARAMETER_PATH}/turbo-signature-key" \
  --with-decryption --query "Parameters" --output json --region "${AWS_REGION}")

# jq를 사용하여 각 값을 변수에 할당합니다.
GITHUB_PAT=$(echo "${SECRETS_JSON}" | jq -r '.[] | select(.Name=="'${PARAMETER_PATH}/github-pat'").Value')
export TURBO_TOKEN=$(echo "${SECRETS_JSON}" | jq -r '.[] | select(.Name=="'${PARAMETER_PATH}/turbo-token'").Value')
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=$(echo "${SECRETS_JSON}" | jq -r '.[] | select(.Name=="'${PARAMETER_PATH}/turbo-signature-key'").Value')

if [ -z "${GITHUB_PAT}" ]; then # GITHUB_PAT만 필수 검사
  echo '[ERROR] Could not fetch GitHub PAT from SSM Parameter Store.' >&2
  exit 1
fi

# --- Runner 등록 토큰 요청 (이하 동일) ---
echo "[INFO] Requesting registration token..."
REG_TOKEN=$(curl -sX POST -H "Authorization: token ${GITHUB_PAT}" "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token" | jq -r .token)
if [ -z "${REG_TOKEN}" ]; then
  echo '[ERROR] Failed to get registration token.' >&2
  exit 1
fi

echo "[INFO] Configuring runner..."
./config.sh --url "https://github.com/${REPO_OWNER}/${REPO_NAME}" --token "${REG_TOKEN}" --name "$(hostname)" --labels "self-hosted,linux,arm64" --unattended --replace

echo "[INFO] Installing and starting runner service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo "[INFO] Runner setup script finished successfully at $(date -u)"
#!/bin/bash
# 파일 위치: scripts/setup_runner.sh (Masterpiece v2 Final)
set -euo pipefail

exec > >(tee /home/ec2-user/runner_setup.log | logger -t user-data -s 2>/dev/console) 2>&1
echo "[INFO] Runner setup script started at $(date -u)"

export HOME="/home/ec2-user"
export RUNNER_DIR="$HOME/actions-runner"

# --- [수정] 멱등성 검사: Runner 서비스의 실제 존재 여부로 확인 ---
if [ -f "/home/ec2-user/actions-runner/.runner" ]; then
  echo "[INFO] Runner already configured. Ensuring service is installed and started."
  cd "/home/ec2-user/actions-runner"
  # svc.sh는 install/start를 여러 번 호출해도 안전하도록 '|| true' 로 감쌉니다.
  sudo ./svc.sh install || true
  sudo ./svc.sh start   || true
  echo "[INFO] Runner service ensured. Exiting."
  exit 0
fi

# --- [수정] IMDSv2 호환 함수 ---
get_imds() {
  token=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)
  if [ -n "$token" ]; then
    curl -s -H "X-aws-ec2-metadata-token: $token" "$@"
  else
    curl -s "$@"
  fi
}
AWS_REGION=$(get_imds http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)

REPO_OWNER="jungyuya"
REPO_NAME="new-blog"
SECRET_NAME="cicd/github-runner-pat"

mkdir -p "$RUNNER_DIR"
chown ec2-user:ec2-user "$RUNNER_DIR"
cd "$RUNNER_DIR"

# --- [수정] 다운로드 재시도 로직 추가 ---
LATEST_TAG=$(curl -s 'https://api.github.com/repos/actions/runner/releases/latest' | jq -r .tag_name | sed 's/^v//')
TARBALL="actions-runner-linux-arm64-${LATEST_TAG}.tar.gz"
echo "[INFO] Downloading GitHub Runner v${LATEST_TAG}..."
n=0
until [ $n -ge 5 ]
do
  curl --fail --silent --show-error -L -o "${TARBALL}" "https://github.com/actions/runner/releases/download/v${LATEST_TAG}/${TARBALL}" && break
  n=$((n+1))
  echo "Tarball download failed, retry $n/5 in 3 seconds..."
  sleep 3
done
if [ ! -f "${TARBALL}" ]; then
  echo "[ERROR] Download failed after 5 retries." >&2
  exit 1
fi
tar xzf "${TARBALL}"

# --- Runner 의존성 설치 ---
if [ -f "./bin/installdependencies.sh" ]; then
  echo "[INFO] Running provided installdependencies.sh..."
  # 공식 스크립트가 실패하더라도, 우리의 폴백 로직이 실행되도록 || true를 추가합니다.
  sudo ./bin/installdependencies.sh || echo "[WARN] installdependencies.sh failed or not fully supported, continuing with fallback."
fi

# [최종 수정] 폴백: Amazon Linux 2023에 필요한 핵심 라이브러리가 없으면 설치를 시도합니다.
if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then
  echo "[INFO] libicu not found. Installing fallback dependencies..."
  sudo dnf install -y libicu libunwind || true
fi

# --- GitHub PAT 가져오기 ---
echo "[INFO] Retrieving GitHub PAT from Secrets Manager..."
GITHUB_PAT=$(aws secretsmanager get-secret-value --secret-id "${SECRET_NAME}" --region "${AWS_REGION}" --query SecretString --output text | jq -r 'if type=="object" then .GITHUB_PAT else . end')
if [ -z "${GITHUB_PAT}" ]; then
  echo '[ERROR] Could not fetch GitHub PAT.' >&2
  exit 1
fi

# --- Runner 등록 토큰 요청 ---
echo "[INFO] Requesting registration token..."
REG_TOKEN=$(curl -sX POST -H "Authorization: token ${GITHUB_PAT}" "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token" | jq -r .token)
if [ -z "${REG_TOKEN}" ]; then
  echo '[ERROR] Failed to get registration token.' >&2
  exit 1
fi

# --- Runner 구성 ---
echo "[INFO] Configuring runner..."
./config.sh --url "https://github.com/${REPO_OWNER}/${REPO_NAME}" --token "${REG_TOKEN}" --name "$(hostname)" --labels "self-hosted,linux,arm64" --unattended --replace

# --- Runner 서비스 등록 및 시작 ---
echo "[INFO] Installing and starting runner service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo "[INFO] Runner setup script finished successfully at $(date -u)"
#!/bin/bash
# 파일: scripts/setup_runner.sh
# 목적: GitHub self-hosted runner 설치/등록 스크립트
set -euo pipefail

# 안전한 로그 파일 설정 (append)
LOGFILE="/home/ec2-user/runner_setup.log"
mkdir -p "$(dirname "$LOGFILE")"
touch "$LOGFILE"
chown ec2-user:ec2-user "$LOGFILE" || true

# 모든 출력을 파일 + syslog로 보냄 (절대 /dev/console 에 쓰지 않음)
exec > >(tee -a "$LOGFILE" | logger -t runner-setup) 2>&1

echo "[INFO] Runner setup script started at $(date -u)"

export HOME="/home/ec2-user"
export RUNNER_DIR="$HOME/actions-runner"

# 멱등성: 이미 구성되었으면 svc 보장 후 종료
if [ -f "${RUNNER_DIR}/.runner" ]; then
  echo "[INFO] Runner already configured; ensuring service is installed and started."
  cd "${RUNNER_DIR}" || exit 0
  sudo ./svc.sh install || true
  sudo ./svc.sh start   || true
  echo "[INFO] Runner ensured. Exiting."
  exit 0
fi

# IMDSv2-safe helper
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
chown ec2-user:ec2-user "$RUNNER_DIR" || true
cd "$RUNNER_DIR"

# GitHub Actions Runner 다운로드 (재시도)
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

# Runner 의존성 (제공 스크립트가 있으면 실행)
if [ -f "./bin/installdependencies.sh" ]; then
  echo "[INFO] Running provided installdependencies.sh..."
  sudo ./bin/installdependencies.sh || echo "[WARN] installdependencies.sh failed, continuing"
fi

# 폴백으로 필요한 런타임 라이브러리 설치 시도
if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then
  echo "[INFO] Installing fallback libs (libicu, libunwind)..."
  sudo dnf install -y libicu libunwind || true
fi

# SecretsManager에서 PAT 가져오기
echo "[INFO] Retrieving GitHub PAT from Secrets Manager..."
GITHUB_PAT=$(aws secretsmanager get-secret-value --secret-id "${SECRET_NAME}" --region "${AWS_REGION}" --query Parameter.Value --output text 2>/dev/null || \
             aws secretsmanager get-secret-value --secret-id "${SECRET_NAME}" --region "${AWS_REGION}" --query SecretString --output text || true)

# 위는 두 가지 반환 포맷을 커버: Parameter.Value 또는 SecretString(JSON)
if [ -n "$GITHUB_PAT" ] && echo "$GITHUB_PAT" | jq -e . >/dev/null 2>&1; then
  # If SecretString returned a JSON string, try to extract GITHUB_PAT key
  GITHUB_PAT=$(echo "$GITHUB_PAT" | jq -r 'if has("GITHUB_PAT") then .GITHUB_PAT else . end' 2>/dev/null || echo "$GITHUB_PAT")
fi

if [ -z "${GITHUB_PAT}" ]; then
  echo '[ERROR] Could not fetch GitHub PAT from Secrets Manager.' >&2
  exit 1
fi

# Runner 등록 토큰 요청
echo "[INFO] Requesting registration token..."
REG_TOKEN=$(curl -sS -X POST -H "Authorization: token ${GITHUB_PAT}" "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token" | jq -r .token)
if [ -z "${REG_TOKEN}" ]; then
  echo '[ERROR] Failed to get registration token.' >&2
  exit 1
fi

# Runner 구성
echo "[INFO] Configuring runner..."
./config.sh --url "https://github.com/${REPO_OWNER}/${REPO_NAME}" --token "${REG_TOKEN}" --name "$(hostname)" --labels "self-hosted,linux,arm64" --unattended --replace

# 서비스 등록 및 시작
echo "[INFO] Installing and starting runner service..."
sudo ./svc.sh install || true
sudo ./svc.sh start   || true

echo "[INFO] Runner setup script finished successfully at $(date -u)"

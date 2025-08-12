#!/bin/bash
# 파일 위치: scripts/setup_runner.sh (Masterpiece v3 Final)
set -euo pipefail

# 모든 출력을 로그 파일과 시스템 로그(syslog)에 함께 기록합니다.
# tee -a: 파일에 내용을 덧붙입니다. (append)
LOGFILE="/home/ec2-user/runner_setup.log"
exec > >(tee -a "$LOGFILE" | logger -t runner-setup) 2>&1

echo "[INFO] Runner setup script started at $(date -u)"

# --- 환경 변수 및 기본 디렉토리 설정 ---
export HOME="/home/ec2-user"
export RUNNER_DIR="$HOME/actions-runner"

# --- 멱등성 검사: Runner가 이미 설정되었는지 확인 ---
# .runner 파일이 존재하면, 이미 구성이 완료된 것으로 간주합니다.
if [ -f "${RUNNER_DIR}/.runner" ]; then
  echo "[INFO] Runner already configured. Ensuring service is installed and started."
  cd "${RUNNER_DIR}"
  # 서비스가 중단되었을 수 있으므로, 설치 및 시작을 안전하게 재시도합니다.
  sudo ./svc.sh install || true
  sudo ./svc.sh start   || true
  echo "[INFO] Runner service ensured. Exiting."
  exit 0
fi

# --- IMDSv2 호환 방식으로 AWS 리전 정보 가져오기 ---
get_imds() {
  token=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)
  if [ -n "$token" ]; then
    curl -s -H "X-aws-ec2-metadata-token: $token" "$@"
  else
    curl -s "$@"
  fi
}
AWS_REGION=$(get_imds http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)

# --- GitHub 관련 변수 설정 ---
REPO_OWNER="jungyuya"
REPO_NAME="new-blog"
SECRET_NAME="cicd/github-runner-pat"

# --- Runner 디렉토리 생성 및 이동 ---
mkdir -p "$RUNNER_DIR"
chown ec2-user:ec2-user "$RUNNER_DIR"
cd "$RUNNER_DIR"

# --- GitHub Actions Runner 소프트웨어 다운로드 (재시도 로직 포함) ---
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

# --- Runner 의존성 설치 (폴백 로직 포함) ---
if [ -f "./bin/installdependencies.sh" ]; then
  echo "[INFO] Running provided installdependencies.sh..."
  sudo ./bin/installdependencies.sh || echo "[WARN] installdependencies.sh failed, continuing with fallback."
fi
if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then
  echo "[INFO] libicu not found. Installing fallback dependencies..."
  sudo dnf install -y libicu libunwind || true
fi

# --- Secrets Manager에서 GitHub PAT 가져오기 ---
echo "[INFO] Retrieving GitHub PAT from Secrets Manager..."
GITHUB_PAT=$(aws secretsmanager get-secret-value --secret-id "${SECRET_NAME}" --region "${AWS_REGION}" --query SecretString --output text)
if [ -z "${GITHUB_PAT}" ]; then
  echo '[ERROR] Could not fetch GitHub PAT from Secrets Manager.' >&2
  exit 1
fi
# Secrets Manager가 JSON 형태로 값을 반환할 경우를 대비하여, 실제 토큰 값을 추출합니다.
if echo "${GITHUB_PAT}" | jq -e . >/dev/null 2>&1; then
  GITHUB_PAT=$(echo "${GITHUB_PAT}" | jq -r '.GITHUB_PAT // .')
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
#!/bin/bash -xe
# 이 스크립트의 모든 출력은 /home/ec2-user/runner_setup.log 파일에 기록됩니다.
exec > /home/ec2-user/runner_setup.log 2>&1
echo "=== Runner setup started: $(date -u) ==="

# --- 환경 변수 설정 ---
# 이 스크립트가 올바르게 동작하기 위해 필요한 환경 변수들을 정의합니다.
# 이 값들은 userData를 통해 전달되거나, EC2 인스턴스 메타데이터에서 가져올 수 있습니다.
export HOME=/home/ec2-user
export NVM_DIR="$HOME/.nvm"
export RUNNER_DIR="$HOME/actions-runner"
# 아래 값들은 userData에서 export 명령어로 설정될 것입니다.
# REPO_OWNER, REPO_NAME, SECRET_NAME, AWS_REGION

# --- 안전 장치: 작업 디렉토리 생성 ---
mkdir -p "$RUNNER_DIR"
chown ec2-user:ec2-user "$RUNNER_DIR"

# --- 1. nvm, Node.js, pnpm 설치 ---
if [ ! -d "$NVM_DIR" ]; then
  echo "--- Installing nvm ---"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
# 현재 셸 세션에서 nvm을 사용 가능하게 합니다.
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi
nvm install 22 || true # LTS 버전 또는 22 버전 설치 시도
npm install -g pnpm || true

# --- Node.js와 pnpm을 시스템 전역에서 사용할 수 있도록 심볼릭 링크를 생성합니다. ---
# 이는 Runner가 실행하는 작업(Job)들이 node와 pnpm 명령어를 찾을 수 있도록 하기 위함입니다.
NODE_VERSION_DIR="$NVM_DIR/versions/node/$(nvm version)"
NODE_BIN_DIR="${NODE_VERSION_DIR}/bin"
if [ -x "${NODE_BIN_DIR}/node" ]; then
  sudo ln -sf "${NODE_BIN_DIR}/node" /usr/bin/node
  sudo ln -sf "${NODE_BIN_DIR}/npm"  /usr/bin/npm
  sudo ln -sf "${NODE_BIN_DIR}/npx"  /usr/bin/npx
fi
if command -v pnpm >/dev/null 2>&1; then
  sudo ln -sf "$(command -v pnpm)" /usr/bin/pnpm
fi
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

# --- 2. GitHub Runner 소프트웨어 다운로드 및 압축 해제 ---
cd "$RUNNER_DIR"
LATEST_TAG=$(curl -sS --fail "https://api.github.com/repos/actions/runner/releases/latest" | jq -r .tag_name | sed 's/^v//')
if [ -z "${LATEST_TAG}" ]; then
  echo "ERROR: Cannot determine latest runner version" >&2
  exit 1
fi
TARBALL="actions-runner-linux-arm64-${LATEST_TAG}.tar.gz"
if [ ! -f "${TARBALL}" ]; then
  echo "--- Downloading GitHub Runner v${LATEST_TAG} ---"
  curl --fail --silent --show-error --retry 5 -L -o "${TARBALL}" "https://github.com/actions/runner/releases/download/v${LATEST_TAG}/${TARBALL}"
fi
tar -xzf "${TARBALL}"

# --- 3. Runner 의존성 설치 ---
if [ -f "./bin/installdependencies.sh" ]; then
  echo "--- Running provided installdependencies.sh ---"
  sudo ./bin/installdependencies.sh || echo "installdependencies.sh failed, continuing with fallback."
fi
# Amazon Linux 2023에 필요한 추가 라이브러리 설치 (폴백)
if ! ldconfig -p | grep -i libicu >/dev/null 2>&1; then
  echo "--- Installing fallback distro packages for libicu etc. ---"
  # [수정] Amazon Linux 2023의 공식 패키지 매니저인 dnf를 우선적으로 사용합니다.
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y libicu icu libicu-devel libunwind || true
  elif command -v yum >/dev/null 2>&1; then # 이전 버전을 위한 호환성 유지
    sudo yum install -y libicu libicu-devel libunwind || true
  elif command -v apt-get >/dev/null 2>&1; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y libicu-dev libunwind8 || true
  fi
fi

# --- 5. GitHub API를 통해 Runner 등록 토큰 요청 ---
echo "--- Requesting registration token from GitHub API ---"
REPO_API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}"
REG_TOKEN=$(curl -sS --fail -X POST -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${GITHUB_PAT}" "${REPO_API_URL}/actions/runners/registration-token" | jq -r .token)
if [ -z "${REG_TOKEN}" ]; then
  echo "ERROR: Failed to get registration token." >&2
  exit 1
fi

# --- 6. Runner 구성 ---
echo "--- Configuring runner ---"
REPO_WEB_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}"
./config.sh --url "${REPO_WEB_URL}" --token "${REG_TOKEN}" --name "$(hostname)" --labels "self-hosted,linux,arm64" --unattended --replace

# --- 7. Runner를 systemd 서비스로 등록 및 시작 ---
echo "--- Installing and starting runner service ---"
sudo ./svc.sh install
sudo ./svc.sh start

echo "=== Runner setup finished successfully: $(date -u) ==="
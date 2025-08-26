#!/usr/bin/env bash
set -euo pipefail

echo "🧹 Cleaning up previous build artifacts..."
WORKDIR="$(pwd)"
LAYER_SRC="$WORKDIR/apps/infra/layers/sharp-layer"
OUT_DIR="$WORKDIR/out"
ZIP_NAME="sharp-layer.zip"
# [수정] Dockerfile 경로를 영구적인 위치로 변경
DOCKERFILE_PATH="$LAYER_SRC/Dockerfile.build" 
IMAGE_NAME="sharp-layer-builder" # 빌드할 이미지에 고정된 이름을 부여

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "📄 Creating a persistent Dockerfile for the build at $DOCKERFILE_PATH..."
cat > "$DOCKERFILE_PATH" <<'DOCKERFILE'
FROM --platform=linux/arm64 public.ecr.aws/lambda/nodejs:20
WORKDIR /var/task
RUN dnf install -y zip && dnf clean all
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
RUN mkdir -p /layer/nodejs && \
    cp -r node_modules /layer/nodejs/ && \
    cp package.json /layer/nodejs/ && \
    cd /layer && zip -r /var/task/sharp-layer.zip .
DOCKERFILE

echo "🚀 Building the builder image: $IMAGE_NAME..."
# [핵심 수정] buildx 대신, 표준 docker build 명령어를 사용합니다.
# --no-cache 옵션을 추가하여 이전의 잘못된 캐시를 사용하지 않도록 합니다.
docker build --no-cache --platform linux/arm64 -t $IMAGE_NAME -f "$DOCKERFILE_PATH" "$LAYER_SRC"

echo "📦 Creating a temporary container to copy the zip file..."
# [핵심 수정] 빌드된 이미지로 임시 컨테이너를 생성합니다.
CONTAINER_ID=$(docker create $IMAGE_NAME)

echo "🚚 Copying '$ZIP_NAME' from the container..."
# [핵심 수정] docker cp를 사용하여 컨테이너 내부의 zip 파일을 로컬로 복사합니다.
docker cp "$CONTAINER_ID:/var/task/sharp-layer.zip" "$OUT_DIR/$ZIP_NAME"

echo "🚮 Cleaning up the temporary container..."
# [핵심 수정] 사용이 끝난 임시 컨테이너를 삭제합니다.
docker rm "$CONTAINER_ID"

# 임시 Dockerfile 정리 (이제 영구적이므로 삭제하지 않음)
# rm -f "$DOCKERFILE_PATH"

echo "🎉 Build process complete! Layer is available at: $OUT_DIR/$ZIP_NAME"
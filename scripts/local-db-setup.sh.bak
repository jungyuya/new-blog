#!/bin/bash
# 이 스크립트는 로컬 DynamoDB 테이블을 최신 스키마로 재생성합니다.

# [추가] 스크립트 파일이 위치한 디렉토리의 절대 경로를 찾습니다.
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

TABLE_NAME="BlogPosts-Local"
ENDPOINT_URL="http://localhost:8000"

echo "Deleting old table: $TABLE_NAME..."
aws dynamodb delete-table --table-name $TABLE_NAME --endpoint-url $ENDPOINT_URL || true

echo "Waiting for table to be deleted..."
sleep 5 

echo "Creating new table: $TABLE_NAME with latest schema..."
aws dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=GSI3_PK,AttributeType=S \
        AttributeName=GSI3_SK,AttributeType=S \
        AttributeName=createdAt,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    # [수정] 파일 경로를 SCRIPT_DIR 변수를 사용하여 지정합니다.
    --global-secondary-indexes file://"$SCRIPT_DIR/gsi-definitions.json" \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url $ENDPOINT_URL

echo "✅ Table $TABLE_NAME created successfully."
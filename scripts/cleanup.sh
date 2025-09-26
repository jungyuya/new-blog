#!/bin/bash
TABLE_NAME="BlogPosts-BlogInfraStack"
KEYS_FILE="keys.json"

# jq가 설치되어 있어야 합니다. (sudo apt-get install jq 등)
jq -c '.[]' ${KEYS_FILE} | while read -r key; do
  echo "Removing speechUrl from item with key: ${key}"
  aws dynamodb update-item \
    --table-name "${TABLE_NAME}" \
    --key "${key}" \
    --update-expression "REMOVE speechUrl"
done
echo "Cleanup complete."


# speechURL 삭제 클린업 스크립트 파일
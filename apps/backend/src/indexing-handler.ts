// 파일 위치: apps/backend/src/indexing-handler.ts

import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// OpenSearch 클라이언트 초기화 (Lambda 환경에서 자동 자격 증명 사용)
const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION!,
    service: 'es',
  }),
  node: process.env.OPENSEARCH_ENDPOINT!,
});

const INDEX_NAME = 'posts';

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log(`Received ${event.Records.length} records from DynamoDB Stream.`);

  if (!event.Records || event.Records.length === 0) {
    return;
  }

  const bulkOperations: any[] = [];

  for (const record of event.Records) {
    try {
      const eventName = record.eventName;

      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const newImage = record.dynamodb?.NewImage;
        if (!newImage) continue;

        const postData = unmarshall(newImage as any);

        // [핵심 수정] isDeleted 플래그를 확인합니다.
        if (postData.isDeleted === true) {
          // 'soft delete'가 발생하면, OpenSearch에서는 'hard delete'를 수행합니다.
          console.log(`Detected soft delete for postId: ${postData.postId}. Deleting from index.`);
          bulkOperations.push({ delete: { _index: INDEX_NAME, _id: postData.postId } });
        } else {
          // 정상적인 생성 또는 수정일 경우, 문서를 인덱싱합니다.
          const document = {
            postId: postData.postId,
            title: postData.title,
            content: postData.content,
            tags: postData.tags,
            authorNickname: postData.authorNickname,
            createdAt: postData.createdAt,
            thumbnailUrl: postData.thumbnailUrl,
            status: postData.status,
            visibility: postData.visibility,
            isDeleted: postData.isDeleted || false, // isDeleted 필드를 명시적으로 포함
          };
          bulkOperations.push({ index: { _index: INDEX_NAME, _id: document.postId } });
          bulkOperations.push(document);
        }
      } else if (eventName === 'REMOVE') {
        // DynamoDB에서 항목이 완전히 삭제되는 경우 (Hard Delete)
        const oldImage = record.dynamodb?.OldImage;
        if (!oldImage) continue;

        const deletedData = unmarshall(oldImage as any);
        console.log(`Detected hard delete for postId: ${deletedData.postId}. Deleting from index.`);
        bulkOperations.push({ delete: { _index: INDEX_NAME, _id: deletedData.postId } });
      }
    } catch (error) {
      console.error('Error processing a single record:', JSON.stringify(record, null, 2), error);
      throw error;
    }
  }

  if (bulkOperations.length > 0) {
    console.log(`Sending bulk operations to OpenSearch:`, JSON.stringify(bulkOperations, null, 2));
    try {
      const response = await opensearchClient.bulk({
        index: INDEX_NAME,
        body: bulkOperations,
      });

      if (response.body.errors) {
        const failedItems = response.body.items.filter((item: any) => item.index?.error || item.delete?.error);
        console.error('OpenSearch Bulk API returned errors:', JSON.stringify(failedItems, null, 2));
        throw new Error('Failed to process some documents in OpenSearch.');
      }
      console.log('Successfully processed bulk operations.');
    } catch (error) {
      console.error('Error sending bulk request to OpenSearch:', error);
      throw error;
    }
  }
};
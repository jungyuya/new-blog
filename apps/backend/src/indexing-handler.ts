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
        
        // 검색에 필요한 필드만 추출하여 문서 생성
        const document = {
          postId: postData.postId,
          title: postData.title,
          content: postData.content,
          tags: postData.tags,
          authorNickname: postData.authorNickname,
          createdAt: postData.createdAt,
        };

        bulkOperations.push({ index: { _index: INDEX_NAME, _id: document.postId } });
        bulkOperations.push(document);

      } else if (eventName === 'REMOVE') {
        const oldImage = record.dynamodb?.OldImage;
        if (!oldImage) continue;

        const deletedData = unmarshall(oldImage as any);
        bulkOperations.push({ delete: { _index: INDEX_NAME, _id: deletedData.postId } });
      }
    } catch (error) {
      console.error('Error processing a single record:', JSON.stringify(record, null, 2), error);
      throw error; // 단일 레코드 실패 시, 전체 배치를 실패 처리하여 재시도 및 DLQ로 보냄
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
        // Bulk API 응답에서 에러가 있는 항목만 필터링하여 로그로 남김
        const failedItems = response.body.items.filter((item: any) => item.index?.error || item.delete?.error);
        console.error('OpenSearch Bulk API returned errors:', JSON.stringify(failedItems, null, 2));
        throw new Error('Failed to index some documents in OpenSearch.');
      }
      console.log('Successfully processed bulk operations.');
    } catch (error) {
      console.error('Error sending bulk request to OpenSearch:', error);
      throw error;
    }
  }
};
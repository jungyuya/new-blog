// 파일 위치: apps/backend/src/services/likes.service.ts (신규 생성)

import { ddbDocClient } from '../lib/dynamodb';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * 특정 사용자가 특정 게시물에 '좋아요'를 눌렀는지 확인합니다.
 * @param postId 확인할 게시물의 ID
 * @param anonymousId 확인할 사용자의 익명 ID
 * @returns '좋아요'를 눌렀으면 true, 아니면 false
 */
export async function checkUserLikeStatus(postId: string, anonymousId: string): Promise<boolean> {
  if (!postId || !anonymousId) {
    return false;
  }

  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `POST#${postId}`,
      SK: `LIKED_BY#${anonymousId}`,
    },
  });

  const { Item } = await ddbDocClient.send(command);
  return !!Item; // Item이 존재하면 true, 없으면 false 반환
}

/**
 * 게시물의 '좋아요' 상태를 토글(추가 또는 삭제)합니다.
 * DynamoDB Transaction을 사용하여 데이터 정합성을 보장합니다.
 * @param postId 토글할 게시물의 ID
 * @param anonymousId 토글을 수행하는 사용자의 익명 ID
 * @returns 업데이트된 likeCount와 현재 isLiked 상태
 */
export async function togglePostLike(postId: string, anonymousId: string): Promise<{ likeCount: number; isLiked: boolean }> {
  // 1. 현재 '좋아요' 상태와 게시물의 likeCount를 확인합니다.
  const getPostCommand = new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `POST#${postId}`, SK: 'METADATA' },
  });
  const isAlreadyLiked = await checkUserLikeStatus(postId, anonymousId);
  
  const { Item: postItem } = await ddbDocClient.send(getPostCommand);
  if (!postItem) {
    throw new Error('Post not found');
  }
  const currentLikeCount = postItem.likeCount || 0;

  // 2. 트랜잭션 아이템을 준비합니다.
  const transactItems: any[] = [];
  let finalLikeCount: number;
  let finalIsLiked: boolean;

  if (isAlreadyLiked) {
    // 2-A. 이미 '좋아요'를 누른 경우: Like 아이템 삭제 및 likeCount 감소
    finalLikeCount = Math.max(0, currentLikeCount - 1); // 0 미만으로 내려가지 않도록 방어
    finalIsLiked = false;

    transactItems.push({
      Delete: {
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: `LIKED_BY#${anonymousId}` },
      },
    });
    transactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        UpdateExpression: 'SET likeCount = :count',
        ExpressionAttributeValues: { ':count': finalLikeCount },
      },
    });
  } else {
    // 2-B. '좋아요'를 누르지 않은 경우: Like 아이템 생성 및 likeCount 증가
    finalLikeCount = currentLikeCount + 1;
    finalIsLiked = true;

    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `POST#${postId}`,
          SK: `LIKED_BY#${anonymousId}`,
          GSI4_PK: `USER#${anonymousId}`,
          GSI4_SK: `LIKED#POST#${postId}`,
          createdAt: new Date().toISOString(),
        },
      },
    });
    transactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        UpdateExpression: 'SET likeCount = :count',
        ExpressionAttributeValues: { ':count': finalLikeCount },
      },
    });
  }

  // 3. 트랜잭션을 실행합니다.
  const transactionCommand = new TransactWriteCommand({
    TransactItems: transactItems,
  });
  await ddbDocClient.send(transactionCommand);

  // 4. 최종 결과를 반환합니다.
  return { likeCount: finalLikeCount, isLiked: finalIsLiked };
}
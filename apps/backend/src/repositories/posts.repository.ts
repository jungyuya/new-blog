// 파일 위치: apps/backend/src/repositories/posts.repository.ts

import { ddbDocClient } from '../lib/dynamodb';
import type { Post } from '../lib/types';
import { 
  GetCommand, 
  QueryCommand, 
  BatchWriteCommand, 
  UpdateCommand, 
  DeleteCommand,
  type QueryCommandInput 
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * 데이터베이스와 직접 통신하는 함수들의 모음입니다.
 * 이 파일의 함수들은 오직 데이터의 CRUD(생성, 읽기, 수정, 삭제)에만 집중합니다.
 */

// 여기에 findPostById, findAllPosts 등 함수가 추가될 예정입니다.

/**
 * 특정 ID를 가진 게시물 하나를 데이터베이스에서 조회합니다.
 * @param postId 조회할 게시물의 ID
 * @returns Post 객체 또는 찾지 못한 경우 null
 */
export async function findPostById(postId: string): Promise<Post | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `POST#${postId}`, SK: 'METADATA' },
  });

  const { Item } = await ddbDocClient.send(command);

  // isDeleted가 true인 아이템은 찾지 못한 것으로 간주하여 null을 반환합니다.
  if (!Item || Item.isDeleted) {
    return null;
  }
  
  return Item as Post;
}

/**
 * 모든 게시물의 목록을 GSI에서 조회합니다. (이전/다음 글 탐색용)
 * @param isAdmin 관리자 여부. true일 경우 모든 상태의 글을 가져옵니다.
 * @returns Post 배열
 */
export async function findAllPostTitlesForNav(isAdmin: boolean): Promise<Pick<Post, 'postId' | 'title'>[]> {
  const listCommandParams: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3_PK = :pk',
    ExpressionAttributeValues: { ':pk': 'POST#ALL' },
    ScanIndexForward: false,
    // 이전/다음 글 탐색에는 postId와 title만 필요하므로, 필요한 속성만 가져와 네트워크 비용을 절감합니다.
    ProjectionExpression: 'postId, title, isDeleted, #status, #visibility',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#visibility': 'visibility',
    }
  };

  if (!isAdmin) {
    // isDeleted는 repository 단에서 이미 필터링 되므로, 여기서는 published & public 만 필터링합니다.
    listCommandParams.FilterExpression = '#status = :published AND #visibility = :public';
    listCommandParams.ExpressionAttributeValues![':published'] = 'published';
    listCommandParams.ExpressionAttributeValues![':public'] = 'public';
  }

  const listCommand = new QueryCommand(listCommandParams);
  const { Items } = await ddbDocClient.send(listCommand);

  // isDeleted가 아닌 게시물만 필터링하여 반환합니다.
  const activePosts = Items?.filter((p: any) => !p.isDeleted) || [];
  
  return activePosts as Pick<Post, 'postId' | 'title'>[];
}

/**
 * 게시물의 조회수를 1 증가시킵니다.
 * 이 작업은 비동기로 실행되며, 성공 여부를 기다리지 않습니다 (fire-and-forget).
 * @param postId 조회수를 증가시킬 게시물의 ID
 */
export async function incrementViewCount(postId: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    UpdateExpression: 'SET viewCount = if_not_exists(viewCount, :start) + :inc',
    ExpressionAttributeValues: { ':inc': 1, ':start': 0 },
  });
  
  // 조회수 증가는 사용자가 응답을 기다릴 필요 없는 작업이므로, await 없이 비동기 실행합니다.
  // 에러가 발생하더라도 전체 요청이 실패해서는 안됩니다.
  ddbDocClient.send(command).catch(err => {
    console.error(`[WARN] Failed to increment view count for post ${postId}:`, err);
  });
}

interface FindAllPostsOptions {
  limit: number;
  cursor?: string;
  isAdmin: boolean;
}

/**
 * 페이지네이션을 적용하여 게시물 목록을 조회합니다.
 * @param options limit, cursor, isAdmin을 포함하는 옵션 객체
 * @returns 게시물 배열과 다음 페이지를 위한 커서
 */
export async function findAllPosts({ limit, cursor, isAdmin }: FindAllPostsOptions): Promise<{ posts: Post[], nextCursor: string | null }> {
  const commandParams: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3_PK = :pk',
    ExpressionAttributeValues: { ':pk': 'POST#ALL' },
    ScanIndexForward: false,
    Limit: limit,
  };

  if (cursor) {
    try {
      commandParams.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (e) {
      // 잘못된 형식의 커서는 서비스 계층에서 처리할 수 있도록 에러를 던집니다.
      throw new Error('Invalid cursor format.');
    }
  }

  if (!isAdmin) {
    commandParams.FilterExpression = '#status = :published AND #visibility = :public';
    commandParams.ExpressionAttributeNames = {
      '#status': 'status',
      '#visibility': 'visibility',
    };
    commandParams.ExpressionAttributeValues![':published'] = 'published';
    commandParams.ExpressionAttributeValues![':public'] = 'public';
  }

  const { Items, LastEvaluatedKey } = await ddbDocClient.send(new QueryCommand(commandParams));
  
  const activePosts = Items?.filter((i) => !i.isDeleted) || [];
  
  const nextCursor = LastEvaluatedKey
    ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64')
    : null;

  return { posts: activePosts as Post[], nextCursor };
}

/**
 * 주어진 여러 게시물 ID에 대한 댓글 수를 조회합니다. (N+1 문제 해결용)
 * @param postIds 댓글 수를 조회할 게시물 ID 배열
 * @returns { [postId: string]: number } 형태의 맵 객체
 */
export async function findCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) {
    return {};
  }

  const counts: Record<string, number> = {};
  
  // 각 post에 대한 count 쿼리를 병렬로 실행하여 성능을 최적화합니다.
  const promises = postIds.map(postId => {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `POST#${postId}`,
        ':sk': 'COMMENT#',
      },
      Select: 'COUNT',
    });
    return ddbDocClient.send(command).then(result => {
      counts[postId] = result.Count || 0;
    });
  });

  await Promise.all(promises);
  return counts;
}
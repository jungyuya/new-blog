// 파일 위치: apps/backend/src/repositories/posts.repository.ts

import { ddbDocClient } from '../lib/dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import type { Post } from '../lib/types';
import {
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
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
  excludeIds?: Set<string>;
  category?: 'post' | 'learning';
}

/**
 * 페이지네이션을 적용하여 게시물 목록을 조회합니다.
 * @param options limit, cursor, isAdmin, excludeIds를 포함하는 옵션 객체
 * @returns 게시물 배열과 다음 페이지를 위한 커서
 */
export async function findAllPosts({ limit, cursor, isAdmin, excludeIds, category }: FindAllPostsOptions): Promise<{ posts: Post[], nextCursor: string | null }> {
  // [Epic 6] Category Filtering
  // category='learning' -> 'POST#LEARNING'
  // [Universal Feed Strategy] 모든 글은 GSI3_PK='POST#ALL'을 공유합니다.
  const pkValue = 'POST#ALL';

  const queryCommandInput: any = {
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3_PK = :pk',
    ExpressionAttributeValues: {
      ':pk': pkValue,
    },
    Limit: limit,
    ScanIndexForward: false, // 최신순
  };

  // 필터링 조건 추가 (Exclude IDs)
  const filterAllocations: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};

  if (excludeIds && excludeIds.size > 0) {
    // filter expression: NOT contains... (DynamoDB는 NOT IN이 없음, OR로 연결하거나 NOT (id IN (...)) 불가)
    // 리스트 크기가 작으므로 "NOT postId IN (...)" 대신 
    // "postId <> :id1 AND postId <> :id2 ..." 사용
    Array.from(excludeIds).forEach((id, index) => {
      const key = `:ex${index}`;
      filterAllocations.push('postId <> ' + key);
      queryCommandInput.ExpressionAttributeValues[key] = id;
    });
  }

  if (!isAdmin) {
    filterAllocations.push('#status = :published AND #visibility = :public');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeNames['#visibility'] = 'visibility';
    queryCommandInput.ExpressionAttributeValues[':published'] = 'published';
    queryCommandInput.ExpressionAttributeValues[':public'] = 'public';
  }

  if (filterAllocations.length > 0) {
    queryCommandInput.FilterExpression = filterAllocations.join(' AND ');
  }
  if (Object.keys(expressionAttributeNames).length > 0) {
    queryCommandInput.ExpressionAttributeNames = expressionAttributeNames;
  }
  // --- 수정 끝 ---

  if (cursor) {
    try {
      queryCommandInput.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (e) {
      throw new Error('Invalid cursor format.');
    }
  }

  const { Items, LastEvaluatedKey } = await ddbDocClient.send(new QueryCommand(queryCommandInput));

  // [Fix] GSI3 does not project 'category' (and possibly other attributes), causing in-memory filtering to fail.
  // We must fetch the full items from the main table using the PK/SK returned by GSI3.

  let activePosts: Post[] = [];

  if (Items && Items.length > 0) {
    // 1. GSI 조회 결과에서 PK, SK 추출
    const keys = Items.map(item => ({
      PK: item.PK,
      SK: item.SK,
    }));

    // 2. BatchGet 항목이 100개를 넘거나 너무 많을 경우 분할해야 하지만, 
    // findAllPosts의 limit은 보통 12~24 정도이므로 한 번에 처리 가능합니다.
    // 만약 limit이 100을 넘는다면 chunking 로직이 필요합니다.
    const uniqueKeys = keys.filter((key, index, self) =>
      index === self.findIndex((t) => (
        t.PK === key.PK && t.SK === key.SK
      ))
    );

    console.log(`[findAllPosts] GSI Items: ${Items.length}, Unique Keys: ${uniqueKeys.length}`);

    if (uniqueKeys.length > 0) {
      const batchGetCmd = new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: uniqueKeys,
          },
        },
      });

      try {
        const batchResult = await ddbDocClient.send(batchGetCmd);
        const fullItems = batchResult.Responses?.[TABLE_NAME] || [];
        console.log(`[findAllPosts] BatchGet Fetched: ${fullItems.length}`);

        // 순서 보장을 위해 Map으로 변환 후 원래 순서대로 재정렬
        const itemMap = new Map(fullItems.map((item: any) => [item.PK, item]));

        activePosts = uniqueKeys.map(key => itemMap.get(key.PK)).filter(item => {
          if (!item) return false;
          if (item.isDeleted) return false;
          // [Validation] 필수 필드가 없는 잘못된 데이터(Garbage) 필터링
          if (!item.postId || !item.title) {
            console.warn(`[findAllPosts] Skipping malformed item: ${item.PK}`, item);
            return false;
          }
          return true;
        }) as Post[];

        console.log(`[findAllPosts] Active Posts after filter: ${activePosts.length}`);
      } catch (err) {
        console.error('[findAllPosts] BatchGet Error:', err);
      }
    }
  }

  // [In-Memory Filtering]
  if (category) {
    activePosts = activePosts.filter((post: any) => post.category === category);
  }

  const nextCursor = LastEvaluatedKey
    ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64')
    : null;

  return { posts: activePosts, nextCursor };
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

/**
 * 사이트의 메타데이터 설정을 조회합니다. (예: heroPostId)
 * @returns 사이트 설정 객체 또는 null
 */
export async function findSiteConfig(): Promise<{ heroPostId?: string } | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: 'SITE_CONFIG', SK: 'METADATA' },
  });
  const { Item } = await ddbDocClient.send(command);
  return Item || null;
}

/**
 * 특정 태그가 붙은 게시물 목록을 GSI2를 통해 조회합니다.
 * @param tagName 조회할 태그 이름
 * @param isAdmin 관리자 여부
 * @returns Post 배열
 */
export async function findPostsByTag(tagName: string, isAdmin: boolean): Promise<Post[]> {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'GSI2',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `TAG#${tagName}` },
    ScanIndexForward: false,
  };

  if (!isAdmin) {
    params.FilterExpression = '#status = :published AND #visibility = :public';
    params.ExpressionAttributeNames = {
      '#status': 'status',
      '#visibility': 'visibility',
    };
    params.ExpressionAttributeValues![':published'] = 'published';
    params.ExpressionAttributeValues![':public'] = 'public';
  }

  const { Items } = await ddbDocClient.send(new QueryCommand(params));
  const activePosts = Items?.filter(post => !post.isDeleted) || [];
  return activePosts as Post[];
}

/**
 * 새로운 게시물과 관련 태그 아이템들을 BatchWriteCommand를 사용하여 한 번에 생성합니다.
 * @param postItem 생성할 Post 아이템 객체
 * @param tagItems 생성할 Tag 아이템 객체 배열
 */
export async function createPostWithTags(postItem: Post, tagItems: any[]): Promise<void> {
  const writeRequests = [];

  // 1. Post 아이템 추가
  writeRequests.push({
    PutRequest: {
      Item: postItem,
    },
  });

  // 2. Tag 아이템들 추가
  for (const tagItem of tagItems) {
    writeRequests.push({
      PutRequest: {
        Item: tagItem,
      },
    });
  }

  if (writeRequests.length === 0) {
    return;
  }

  // DynamoDB BatchWrite는 최대 25개의 요청을 한 번에 처리할 수 있습니다.
  // 현재 로직에서는 태그가 24개를 초과할 일이 거의 없으므로 분할 처리는 생략합니다.
  const command = new BatchWriteCommand({
    RequestItems: {
      [TABLE_NAME]: writeRequests,
    },
  });

  await ddbDocClient.send(command);
}

/**
 * 특정 게시물과 관련된 모든 태그 아이템들을 논리적으로 삭제(soft-delete)합니다.
 * isDeleted 플래그를 true로 설정하고, 7일 후 자동 삭제를 위한 TTL을 설정합니다.
 * @param post 삭제할 Post 객체
 */
export async function softDeletePostAndTags(post: Post): Promise<void> {
  const now = new Date();
  const ttlInSeconds = Math.floor(now.getTime() / 1000) + (7 * 24 * 60 * 60); // 7 days from now

  const updatePromises: Promise<any>[] = [];

  // 1. Post 아이템 업데이트 Promise 추가
  const postUpdatePromise = ddbDocClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: post.PK, SK: post.SK },
    UpdateExpression: 'SET isDeleted = :d, updatedAt = :u, #ttl = :ttl',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':d': true,
      ':u': now.toISOString(),
      ':ttl': ttlInSeconds,
    },
  }));
  updatePromises.push(postUpdatePromise);

  // 2. Tag 아이템들 업데이트 Promise 추가
  if (post.tags && post.tags.length > 0) {
    for (const tagName of post.tags) {
      const normalizedTagName = tagName.trim().toLowerCase();
      if (normalizedTagName) {
        const tagUpdatePromise = ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `TAG#${normalizedTagName}`, SK: `POST#${post.postId}` },
          UpdateExpression: 'SET isDeleted = :d, #ttl = :ttl',
          ExpressionAttributeNames: { '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':d': true,
            ':ttl': ttlInSeconds,
          },
        }));
        updatePromises.push(tagUpdatePromise);
      }
    }
  }

  // 3. 모든 업데이트 작업을 병렬로 실행합니다.
  await Promise.all(updatePromises);
}

/**
 * 게시물 아이템의 속성을 업데이트하거나 제거합니다.
 * @param postId 업데이트할 게시물의 ID
 * @param updateData 업데이트할 데이터 객체. 값으로 'null'을 주면 해당 속성을 제거합니다.
 * @returns 업데이트된 Post 객체
 */
export async function updatePost(postId: string, updateData: Partial<Post>): Promise<Post> {
  if (Object.keys(updateData).length === 0) {
    throw new Error('No update data provided.');
  }

  const setParts: string[] = [];
  const removeParts: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, string> = {};

  for (const [key, value] of Object.entries(updateData)) {
    if (value === null) {
      // 값이 null이면 REMOVE 액션으로 처리
      removeParts.push(`#${key}`);
      expressionAttributeNames[`#${key}`] = key;
    } else if (value !== undefined) {
      // 값이 undefined가 아니면 SET 액션으로 처리
      setParts.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  }

  let updateExpression = '';
  if (setParts.length > 0) {
    updateExpression += `SET ${setParts.join(', ')}`;
  }
  if (removeParts.length > 0) {
    updateExpression += ` REMOVE ${removeParts.join(', ')}`;
  }
  updateExpression = updateExpression.trim();

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `POST#${postId}`, SK: 'METADATA' },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    // ExpressionAttributeValues가 비어있으면 undefined를 전달해야 함
    ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
    ReturnValues: ReturnValue.ALL_NEW,
  });

  const { Attributes } = await ddbDocClient.send(command);
  return Attributes as Post;
}

/**
 * 게시물 수정에 따른 태그 아이템들을 동기화합니다.
 * (삭제할 태그는 삭제하고, 추가할 태그는 생성/업데이트합니다)
 * @param postId 동기화할 게시물의 ID
 * @param tagsToDelete 삭제할 태그 이름 배열
 * @param tagsToAddOrUpdate 추가하거나 업데이트할 태그 아이템 객체 배열
 */
export async function syncTagsForPost(postId: string, tagsToDelete: string[], tagsToAddOrUpdate: any[]): Promise<void> {
  const writeRequests: any[] = [];

  // 1. 삭제할 태그 아이템 요청 추가
  tagsToDelete.forEach(tagName => {
    const normalizedTagName = tagName.trim().toLowerCase();
    writeRequests.push({
      DeleteRequest: {
        Key: { PK: `TAG#${normalizedTagName}`, SK: `POST#${postId}` }
      }
    });
  });

  // 2. 추가/수정할 태그 아이템 요청 추가
  tagsToAddOrUpdate.forEach(tagItem => {
    writeRequests.push({
      PutRequest: {
        Item: tagItem
      }
    });
  });

  if (writeRequests.length === 0) {
    return;
  }

  // BatchWrite는 최대 25개까지 가능하므로, 25개 이상일 경우 분할해서 처리해야 합니다.
  // 여기서는 편의상 25개 이하라고 가정합니다.
  const command = new BatchWriteCommand({
    RequestItems: {
      [TABLE_NAME]: writeRequests,
    },
  });

  await ddbDocClient.send(command);
}


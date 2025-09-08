// 파일 위치: apps/backend/src/routes/comments.router.ts (v1.4 - 댓글 조회 구현)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'; // [수정] QueryCommand import
import { v4 as uuidv4 } from 'uuid';

import type { AppEnv, UserContext } from '../lib/types'; // [수정] UserContext import
import { ddbDocClient } from '../lib/dynamodb';
import { cookieAuthMiddleware } from '../middlewares/auth.middleware';

// ... (commentsRouter와 postCommentsRouter 선언은 변경 없음)
const commentsRouter = new Hono<AppEnv>();
const postCommentsRouter = new Hono<AppEnv>();

// ... (PUT, DELETE 핸들러는 그대로 둡니다)
commentsRouter.put('/:commentId', (c) => {
  return c.json({ message: 'Not Implemented' }, 501);
});
commentsRouter.delete('/:commentId', (c) => {
  return c.json({ message: 'Not Implemented' }, 501);
});


const createCommentSchema = z.object({
  content: z.string().min(1, { message: '댓글 내용은 비워둘 수 없습니다.' }),
  parentCommentId: z.string().optional(),
  parentCreatedAt: z.string().datetime().optional(), 
});

// ... (POST 핸들러는 변경 없음)
postCommentsRouter.post(
  '/',
  cookieAuthMiddleware,
  zValidator('json', createCommentSchema),
  async (c) => {
    // ... (이전 단계에서 작성한 코드는 그대로 유지)
    const postId = c.req.param('postId');
    const body = c.req.valid('json');
    const user = c.get('user');
    if (!user) {
      return c.json({ message: 'Unauthorized: User context not found' }, 401);
    }
    const now = new Date();
    const timestamp = now.getTime();
    const commentId = `c-${uuidv4()}`;
    let sk: string;
    if (body.parentCommentId && body.parentCreatedAt) {
      const parentTimestamp = new Date(body.parentCreatedAt).getTime();
      sk = `COMMENT#${parentTimestamp}#${body.parentCommentId}#REPLY#${timestamp}#${commentId}`;
    } else {
      sk = `COMMENT#${timestamp}#${commentId}`;
    }
    const newComment = {
      PK: `POST#${postId}`,
      SK: sk,
      entityType: 'Comment',
      commentId,
      postId,
      content: body.content,
      authorId: user.userId,
      authorNickname: user.nickname,
      authorAvatarUrl: user.avatarUrl,
      parentCommentId: body.parentCommentId || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isDeleted: false,
    };
    try {
      const command = new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: newComment,
      });
      await ddbDocClient.send(command);
      const { PK, SK, entityType, ...commentResponse } = newComment;
      return c.json(commentResponse, 201);
    } catch (error) {
      console.error('[DB ERROR] Failed to create comment:', error);
      return c.json({ message: '댓글 생성에 실패했습니다.' }, 500);
    }
  }
);


// --- [Phase 1, Step 1.3] 댓글 목록 조회 (GET) 로직 구현 ---
postCommentsRouter.get('/', async (c) => {
  const postId = c.req.param('postId');

  try {
    // 1. DynamoDB에서 해당 게시물의 모든 댓글 아이템을 가져옵니다.
    const command = new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `POST#${postId}`,
        ':sk': 'COMMENT#',
      },
    });
    const result = await ddbDocClient.send(command);
    const comments = result.Items || [];

    // 2. 플랫한 댓글 목록을 계층형 구조로 변환합니다.
    const commentMap = new Map();
    const rootComments: any[] = [];

    // 모든 댓글을 Map에 저장하여 O(1) 시간 복잡도로 접근 가능하게 합니다.
    comments.forEach(comment => {
      // 프론트엔드에 필요한 데이터만 선택하여 새로운 객체를 만듭니다.
      const commentResponse = {
        commentId: comment.commentId,
        content: comment.isDeleted ? '삭제된 댓글입니다.' : comment.content,
        authorId: comment.authorId,
        authorNickname: comment.authorNickname,
        authorAvatarUrl: comment.authorAvatarUrl,
        createdAt: comment.createdAt,
        isDeleted: comment.isDeleted,
        parentCommentId: comment.parentCommentId,
        replies: [], // 대댓글을 담을 배열을 미리 추가합니다.
      };
      commentMap.set(comment.commentId, commentResponse);
    });

    // 각 댓글을 순회하며 부모-자식 관계를 설정합니다.
    commentMap.forEach(comment => {
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          // 부모 댓글이 존재하면, 부모의 replies 배열에 자신을 추가합니다.
          parent.replies.push(comment);
        } else {
          // 부모 댓글이 삭제되었거나 없는 경우를 대비하여, 일단 최상위 댓글로 취급할 수 있습니다.
          // (이런 경우는 거의 발생하지 않아야 합니다.)
          rootComments.push(comment);
        }
      } else {
        // 최상위 댓글은 rootComments 배열에 추가합니다.
        rootComments.push(comment);
      }
    });
    
    // createdAt 기준으로 최신순 정렬 (선택 사항, SK 정렬로 이미 정렬되어 있을 수 있음)
    // DynamoDB는 SK 기준으로 정렬된 결과를 반환하지만, 애플리케이션 레벨에서 한번 더 정렬하여 보장합니다.
    const sortByDate = (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    rootComments.sort(sortByDate);
    rootComments.forEach(comment => comment.replies.sort(sortByDate));

    return c.json(rootComments);

  } catch (error) {
    console.error('[DB ERROR] Failed to fetch comments:', error);
    return c.json({ message: '댓글 목록을 가져오는 데 실패했습니다.' }, 500);
  }
});


export { commentsRouter, postCommentsRouter };
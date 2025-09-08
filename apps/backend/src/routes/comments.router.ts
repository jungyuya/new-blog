// 파일 위치: apps/backend/src/routes/comments.router.ts (v1.5.1 - 최종 리뷰 반영)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import type { AppEnv } from '../lib/types'; // UserContext는 AppEnv에 포함되므로 직접 import 불필요
import { ddbDocClient } from '../lib/dynamodb';
import { cookieAuthMiddleware } from '../middlewares/auth.middleware';

// =================================================================
// 라우터 인스턴스 생성
// =================================================================
const commentsRouter = new Hono<AppEnv>(); // /api/comments/*
const postCommentsRouter = new Hono<AppEnv>(); // /api/posts/:postId/comments/*

// =================================================================
// 스키마 정의 (관련된 라우터 위에 배치하여 가독성 향상)
// =================================================================

// PUT /api/comments/:commentId
const updateCommentSchema = z.object({
  content: z.string().min(1, { message: '댓글 내용은 비워둘 수 없습니다.' }),
  postId: z.string().min(1),
});

// DELETE /api/comments/:commentId
const deleteCommentSchema = z.object({
  postId: z.string().min(1),
});

// POST /api/posts/:postId/comments
const createCommentSchema = z.object({
  content: z.string().min(1, { message: '댓글 내용은 비워둘 수 없습니다.' }),
  parentCommentId: z.string().optional(),
  parentCreatedAt: z.string().datetime().optional(), 
});

// =================================================================
// 라우트 핸들러: postCommentsRouter (/api/posts/:postId/comments/*)
// =================================================================

// 댓글 생성 (POST)
postCommentsRouter.post(
  '/',
  cookieAuthMiddleware,
  zValidator('json', createCommentSchema),
  async (c) => {
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
      PK: `POST#${postId}`, SK: sk, entityType: 'Comment', commentId, postId,
      content: body.content, authorId: user.userId, authorNickname: user.nickname,
      authorAvatarUrl: user.avatarUrl, parentCommentId: body.parentCommentId || null,
      createdAt: now.toISOString(), updatedAt: now.toISOString(), isDeleted: false,
    };
    try {
      const command = new PutCommand({ TableName: process.env.TABLE_NAME, Item: newComment });
      await ddbDocClient.send(command);
      const { PK, SK, entityType, ...commentResponse } = newComment;
      return c.json(commentResponse, 201);
    } catch (error) {
      console.error('[DB ERROR] Failed to create comment:', error);
      return c.json({ message: '댓글 생성에 실패했습니다.' }, 500);
    }
  }
);

// 댓글 목록 조회 (GET)
postCommentsRouter.get('/', async (c) => {
  const postId = c.req.param('postId');
  try {
    const command = new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `POST#${postId}`, ':sk': 'COMMENT#' },
    });
    const result = await ddbDocClient.send(command);
    const comments = result.Items || [];
    const commentMap = new Map();
    const rootComments: any[] = [];
    comments.forEach(comment => {
      const commentResponse = {
        commentId: comment.commentId,
        content: comment.isDeleted ? '삭제된 댓글입니다.' : comment.content,
        authorId: comment.authorId, authorNickname: comment.authorNickname,
        authorAvatarUrl: comment.authorAvatarUrl, createdAt: comment.createdAt,
        isDeleted: comment.isDeleted, parentCommentId: comment.parentCommentId,
        replies: [],
      };
      commentMap.set(comment.commentId, commentResponse);
    });
    commentMap.forEach(comment => {
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(comment);
        } else {
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });
    const sortByDate = (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    rootComments.sort(sortByDate);
    rootComments.forEach(comment => comment.replies.sort(sortByDate));
    return c.json(rootComments);
  } catch (error) {
    console.error('[DB ERROR] Failed to fetch comments:', error);
    return c.json({ message: '댓글 목록을 가져오는 데 실패했습니다.' }, 500);
  }
});

// =================================================================
// 라우트 핸들러: commentsRouter (/api/comments/*)
// =================================================================

// 댓글 수정 (PUT /api/comments/:commentId)
commentsRouter.put(
  '/:commentId',
  cookieAuthMiddleware,
  zValidator('json', updateCommentSchema),
  async (c) => {
    const { commentId } = c.req.param();
    const body = c.req.valid('json');
    const user = c.get('user');

    if (!user) {
      return c.json({ message: 'Unauthorized: User context not found' }, 401);
    }

    try {
      const queryCommand = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `POST#${body.postId}`,
          ':sk': 'COMMENT#',
        },
      });
      const queryResult = await ddbDocClient.send(queryCommand);
      const targetComment = queryResult.Items?.find(item => item.commentId === commentId);

      if (!targetComment) {
        return c.json({ message: 'Comment not found' }, 404);
      }

      if (targetComment.authorId !== user.userId) {
        return c.json({ message: 'Forbidden: You are not the author of this comment' }, 403);
      }

      const now = new Date().toISOString();
      const updateCommand = new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: targetComment.PK, SK: targetComment.SK },
        UpdateExpression: 'SET content = :content, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':content': body.content,
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      });

      const updateResult = await ddbDocClient.send(updateCommand);
      const { PK, SK, entityType, ...commentResponse } = updateResult.Attributes!;
      
      return c.json(commentResponse);

    } catch (error) {
      console.error('[DB ERROR] Failed to update comment:', error);
      return c.json({ message: '댓글 수정에 실패했습니다.' }, 500);
    }
  }
);

// 댓글 삭제 (DELETE /api/comments/:commentId)
commentsRouter.delete(
  '/:commentId',
  cookieAuthMiddleware,
  zValidator('json', deleteCommentSchema),
  async (c) => {
    const { commentId } = c.req.param();
    const body = c.req.valid('json');
    const user = c.get('user');

    if (!user) {
      return c.json({ message: 'Unauthorized: User context not found' }, 401);
    }

    try {
      const queryCommand = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `POST#${body.postId}`,
          ':sk': 'COMMENT#',
        },
      });
      const queryResult = await ddbDocClient.send(queryCommand);
      const targetComment = queryResult.Items?.find(item => item.commentId === commentId);

      if (!targetComment) {
        return c.json({ message: 'Comment not found' }, 404);
      }

      if (targetComment.authorId !== user.userId) {
        return c.json({ message: 'Forbidden: You are not the author of this comment' }, 403);
      }

      const now = new Date().toISOString();
      const updateCommand = new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: targetComment.PK, SK: targetComment.SK },
        UpdateExpression: 'SET isDeleted = :isDeleted, content = :content, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isDeleted': true,
          ':content': '삭제된 댓글입니다.',
          ':updatedAt': now,
        },
      });

      await ddbDocClient.send(updateCommand);
      
      return c.body(null, 204);

    } catch (error) {
      console.error('[DB ERROR] Failed to delete comment:', error);
      return c.json({ message: '댓글 삭제에 실패했습니다.' }, 500);
    }
  }
);



// =================================================================
// 라우터 export
// =================================================================
export { commentsRouter, postCommentsRouter };
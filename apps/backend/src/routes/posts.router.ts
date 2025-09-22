// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { cookieAuthMiddleware, adminOnlyMiddleware, tryCookieAuthMiddleware, tryAnonymousAuthMiddleware } from '../middlewares/auth.middleware';
import * as postsService from '../services/posts.service';
import * as aiService from '../services/ai.service';
import type { AppEnv } from '../lib/types';


const CreatePostSchema = z.object({
  title: z.string().min(1, '제목은 필수 항목입니다.').max(100, '제목은 100자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용은 필수 항목입니다.'),
  // [추가] 태그: 문자열 배열, 필수는 아님
  tags: z.array(z.string()).optional(),
  // [추가] 발행 상태: 'published' 또는 'draft' 중 하나, 필수는 아님 (기본값 처리)
  status: z.enum(['published', 'draft']).optional(),
  // [추가] 공개 여부: 'public' 또는 'private' 중 하나, 필수는 아님 (기본값 처리)
  visibility: z.enum(['public', 'private']).optional(),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['published', 'draft']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  thumbnailUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '수정할 내용을 하나 이상 제공해야 합니다.' }
);

const postsRouter = new Hono<AppEnv>();

// --- [1] GET / - 모든 게시물 조회 (v4.0 - 서비스 계층 분리) ---
postsRouter.get('/', tryCookieAuthMiddleware, async (c) => {
  const userGroups = c.get('userGroups');

  // Zod를 사용하여 쿼리 파라미터 유효성 검사 및 기본값 설정을 라우터에서 처리합니다.
  const querySchema = z.object({
    limit: z.coerce.number().int().positive().default(12),
    cursor: z.string().optional(),
  });
  
  const queryParseResult = querySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json({ message: 'Invalid query parameters', errors: queryParseResult.error.issues }, 400);
  }
  
  const { limit, cursor } = queryParseResult.data;

  try {
    // 1. 모든 비즈니스 로직을 서비스 계층에 위임합니다.
    const result = await postsService.getPostList({
      limit,
      cursor,
      userGroups,
    });

    // 2. 서비스가 반환한 결과를 그대로 클라이언트에 전달합니다.
    return c.json(result);

  } catch (error: any) {
    console.error('Get All Posts Error:', error);
    // Repository에서 던진 'Invalid cursor format.' 에러를 여기서 처리합니다.
    if (error.message === 'Invalid cursor format.') {
      return c.json({ message: error.message }, 400);
    }
    return c.json({ message: 'Internal Server Error fetching posts.', error: error.message }, 500);
  }
});

// --- [1.5] GET /featured - 추천 게시물 조회 (v4.0 - 서비스 계층 분리) ---
postsRouter.get('/featured', tryCookieAuthMiddleware, async (c) => {
  const userGroups = c.get('userGroups');

  try {
    const result = await postsService.getFeaturedPosts(userGroups);
    return c.json(result);
  } catch (error: any) {
    console.error('Get Featured Data Error:', error);
    return c.json({ message: 'Internal Server Error fetching featured data.', error: error.message }, 500);
  }
});

// --- [1.5-2] GET /latest - 추천을 제외한 최신 게시물 조회 (v4.0 - 서비스 계층 분리) ---
postsRouter.get('/latest', tryCookieAuthMiddleware, async (c) => {
  const userGroups = c.get('userGroups');

  const querySchema = z.object({
    limit: z.coerce.number().int().positive().default(12),
    cursor: z.string().optional(),
  });

  const queryParseResult = querySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json({ message: 'Invalid query parameters', errors: queryParseResult.error.issues }, 400);
  }

  const { limit, cursor } = queryParseResult.data;

  try {
    const result = await postsService.getLatestPosts({
      limit,
      cursor,
      userGroups,
    });
    return c.json(result);
  } catch (error: any) {
    console.error('Get Latest Posts Error:', error);
    if (error.message === 'Invalid cursor format.') {
      return c.json({ message: error.message }, 400);
    }
    return c.json({ message: 'Internal Server Error fetching latest posts.', error: error.message }, 500);
  }
});

// --- [2] GET /:postId - 단일 게시물 조회 (v4.0 - 서비스 계층 분리) ---
postsRouter.get('/:postId', tryCookieAuthMiddleware, tryAnonymousAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const userGroups = c.get('userGroups');
  const currentUserId = c.get('userId');
  const anonymousId = c.get('anonymousId');

  try {
    // 1. 모든 비즈니스 로직을 서비스 계층에 위임합니다.
    const result = await postsService.getPostDetails(
      postId,
      anonymousId,
      userGroups,
      currentUserId
    );

    // 2. 서비스의 결과에 따라 적절한 HTTP 응답을 보냅니다.
    if (result === null) {
      return c.json({ message: 'Post not found.' }, 404);
    }

    if (result === 'forbidden') {
      return c.json({ message: 'Forbidden: You do not have permission to view this post.' }, 403);
    }

    // 성공적인 경우, 서비스가 조합해준 데이터를 그대로 반환합니다.
    return c.json(result);

  } catch (error: any) {
    // 서비스 또는 리포지토리에서 예측하지 못한 에러가 발생한 경우
    console.error('Get Post Error:', error);
    return c.json({ message: 'Internal Server Error fetching post.', error: error.message }, 500);
  }
});

// --- [2.5 좋아요 기능] POST /:postId/like - '좋아요' 토글 (v4.0 - 서비스 계층 분리) ---
postsRouter.post('/:postId/like', tryAnonymousAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const anonymousId = c.get('anonymousId');

  if (!anonymousId) {
    return c.json({ message: 'Bad Request: Anonymous ID is missing.' }, 400);
  }

  try {
    // 이제 posts.service를 통해 좋아요 로직을 호출합니다.
    const result = await postsService.toggleLikeForPost(postId, anonymousId);

    if (result === 'not_found') {
      return c.json({ message: 'Post not found.' }, 404);
    }

    return c.json(result);

  } catch (error: any) {
    console.error('Toggle Like Error:', error);
    return c.json({ message: 'Internal Server Error processing like.', error: error.message }, 500);
  }
});

// --- [3] POST / - 새 게시물 생성 (v4.0 - 서비스 계층 분리) ---
postsRouter.post(
  '/',
  cookieAuthMiddleware, // 'user' 컨텍스트를 주입하기 위해 필수
  adminOnlyMiddleware,
  zValidator('json', CreatePostSchema), // CreatePostSchema는 라우터에 남아있어도 되고, 서비스로 옮겨도 됩니다.
  async (c) => {
    try {
      const postInput = c.req.valid('json');
      const authorContext = c.get('user'); // cookieAuthMiddleware가 주입해준 전체 사용자 컨텍스트

      // 방어 코드: user 컨텍스트가 없는 비정상적인 경우를 대비
      if (!authorContext) {
        return c.json({ message: 'Unauthorized: User context is missing.' }, 401);
      }

      // 1. 모든 비즈니스 로직을 서비스 계층에 위임합니다.
      const newPost = await postsService.createPost(authorContext, postInput);

      // 2. 서비스가 반환한 생성된 게시물 정보를 클라이언트에 전달합니다.
      return c.json({ message: 'Post created successfully!', post: newPost }, 201);

    } catch (error: any) {
      console.error('Create Post Error:', error.stack || error);
      return c.json({ message: 'Internal Server Error creating post.', error: error.message }, 500);
    }
  }
);

// --- [4] PUT /:postId - 게시물 수정 (v4.0 - 서비스 계층 분리) ---
postsRouter.put(
  '/:postId',
  cookieAuthMiddleware,
  adminOnlyMiddleware,
  zValidator('json', UpdatePostSchema),
  async (c) => {
    const postId = c.req.param('postId');
    const updateInput = c.req.valid('json');
    const userId = c.get('userId');

    if (!userId) {
      return c.json({ message: 'Unauthorized: User ID is missing.' }, 401);
    }

    try {
      const result = await postsService.updatePost(postId, userId, updateInput);

      if (result === 'not_found') {
        return c.json({ message: 'Post not found.' }, 404);
      }
      if (result === 'forbidden') {
        return c.json({ message: 'Forbidden.' }, 403);
      }

      return c.json({ message: 'Post updated successfully!', post: result }, 200);

    } catch (error: any) {
      console.error('Update Post Error:', error);
      return c.json({ message: 'Internal Server Error updating post.', error: error.message }, 500);
    }
  }
);

// --- [5] DELETE /:postId - 게시물 삭제 (v4.0 - 서비스 계층 분리) ---
postsRouter.delete(
  '/:postId',
  cookieAuthMiddleware,
  adminOnlyMiddleware,
  async (c) => {
    const postId = c.req.param('postId');
    const userId = c.get('userId');

    // 방어 코드: userId가 없는 비정상적인 경우
    if (!userId) {
      return c.json({ message: 'Unauthorized: User ID is missing.' }, 401);
    }

    try {
      const result = await postsService.deletePost(postId, userId);

      if (result === 'not_found') {
        return c.json({ message: 'Post not found for deletion.' }, 404);
      }
      if (result === 'forbidden') {
        return c.json({ message: 'Forbidden: You are not the author.' }, 403);
      }

      // 성공 시 (result === true)
      return c.json({ message: 'Post and associated items soft-deleted successfully! TTL set for 7 days.' }, 200);

    } catch (error: any) {
      console.error('Delete Post Error:', error);
      return c.json({ message: 'Internal Server Error deleting post.', error: error.message }, 500);
    }
  }
);

// --- [요약 기능] GET /:postId/summary - AI 요약 조회/생성 (v4.0 - 서비스 계층 분리) ---
postsRouter.get(
  '/:postId/summary',
  async (c) => {
    const postId = c.req.param('postId');
    try {
      const result = await aiService.getAiSummaryForPost(postId);

      if (result.status === 'not_found') {
        return c.json({ message: 'Post not found.' }, 404);
      }
      if (result.status === 'too_short') {
        return c.json({ summary: '요약하기에는 글의 내용이 너무 짧습니다.', keywords: [], source: 'error' });
      }
      
      return c.json(result.data);

    } catch (error: any) {
      console.error('AI Summary Error:', error);
      return c.json({ message: 'Failed to generate AI summary.', error: error.message }, 500);
    }
  }
);

// --- [요약 캐시 지우기] DELETE /:postId/summary - AI 요약 캐시 삭제 (v4.0 - 서비스 계층 분리) ---
postsRouter.delete(
  '/:postId/summary',
  cookieAuthMiddleware,
  adminOnlyMiddleware,
  async (c) => {
    const postId = c.req.param('postId');
    try {
      await aiService.clearAiSummaryCache(postId);
      return c.json({ message: 'AI summary cache cleared successfully.' }, 200);
    } catch (error: any) {
      console.error('Clear AI Summary Cache Error:', error);
      return c.json({ message: 'Failed to clear AI summary cache.', error: error.message }, 500);
    }
  }
);

export default postsRouter;
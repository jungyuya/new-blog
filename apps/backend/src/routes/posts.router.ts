// 파일 위치: apps/backend/src/routes/posts.router.ts (v1.1 - 모든 핸들러 로직 포함 최종본)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { cookieAuthMiddleware, adminOnlyMiddleware, tryCookieAuthMiddleware, tryAnonymousAuthMiddleware } from '../middlewares/auth.middleware';
import { togglePostLike, checkUserLikeStatus } from '../services/likes.service';
import type { AppEnv } from '../lib/types';
import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { Post } from '../lib/types';
import * as postsService from '../services/posts.service';



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

// --- [2.5 좋아요 기능] POST /:postId/like - '좋아요' 토글 ---
postsRouter.post('/:postId/like', tryAnonymousAuthMiddleware, async (c) => {
  const postId = c.req.param('postId');
  const anonymousId = c.get('anonymousId');

  // 방어적 코딩: anonymousId가 없으면 요청을 처리할 수 없으므로 에러를 반환합니다.
  // 프론트엔드에서는 항상 anonymousId를 생성하여 보내주므로, 이 에러는 비정상적인 접근일 가능성이 높습니다.
  if (!anonymousId) {
    return c.json({ message: 'Bad Request: Anonymous ID is missing.' }, 400);
  }

  try {
    // 모든 복잡한 로직은 서비스 레이어에 위임하고, 결과만 받아서 전달합니다.
    const result = await togglePostLike(postId, anonymousId);
    return c.json(result);
  } catch (error: any) {
    console.error('Toggle Like Error:', error);
    // 서비스 레이어에서 발생할 수 있는 특정 에러에 대해 구체적인 응답을 보냅니다.
    if (error.message === 'Post not found') {
      return c.json({ message: 'Post not found.' }, 404);
    }
    // 그 외의 모든 예상치 못한 에러는 500 Internal Server Error로 처리합니다.
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

// --- [요약 기능] GET /:postId/summary - AI 요약 조회/생성 ---
// --- 안전한 JSON 추출 헬퍼 함수 ---
function extractJsonObject(text: string): any {
  // AI 응답에 포함될 수 있는 ```json ... ``` 코드 블록을 제거합니다.
  const cleanedText = text.replace(/^```json\s*|```$/g, '');

  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    // 응답에서 유효한 JSON 객체를 찾지 못한 경우 에러를 발생시킵니다.
    throw new Error('No valid JSON object found in AI response.');
  }

  const jsonText = cleanedText.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonText);
}

postsRouter.get(
  '/:postId/summary',
  async (c) => {
    const postId = c.req.param('postId');
    const TABLE_NAME = process.env.TABLE_NAME!;
    const REGION = process.env.REGION!;

    try {
      // 1. DB에서 게시물 원본을 가져옵니다.
      const getCommand = new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        ProjectionExpression: 'content, aiSummary, aiKeywords', // aiKeywords도 함께 조회
      });
      const { Item: post } = await ddbDocClient.send(getCommand);

      if (!post) {
        return c.json({ message: 'Post not found.' }, 404);
      }

      // 2. 캐시 확인: aiSummary가 이미 존재하는지 확인합니다.
      if (post.aiSummary) {
        console.log(`[AI Summary] Cache hit for postId: ${postId}`);
        return c.json({
          summary: post.aiSummary,
          keywords: post.aiKeywords || [], // keywords가 없을 경우를 대비
          source: 'cache'
        });
      }

      console.log(`[AI Summary] Cache miss for postId: ${postId}. Invoking Bedrock...`);
      // 3. 캐시 없음 (Cache Miss): Bedrock을 호출하여 새로 생성합니다.
      const bedrockClient = new BedrockRuntimeClient({ region: REGION });

      // Bedrock에 보낼 순수 텍스트를 추출합니다.
      const textOnlyContent = (post.content || '')
        .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '') // 이미지 태그 제거
        .replace(/<[^>]*>?/gm, ' ') // HTML 태그 제거
        .replace(/[#*`_~=\->|]/g, '') // 마크다운 특수문자 제거
        .replace(/\s+/g, ' ')
        .trim();

      // [방어 코드] 본문 내용이 너무 짧으면 AI 호출을 건너뜁니다.
      if (textOnlyContent.length < 50) {
        return c.json({ summary: '요약하기에는 글의 내용이 너무 짧습니다.', keywords: [], source: 'error' });
      }

      // Claude 3 Haiku를 위한 최종 프롬프트 (번호 추가)
      const prompt = `
    Human: 당신은 IT 기술 블로그의 전문 에디터입니다. 모든 답변은 반드시 한국어 존댓말로, 그리고 지정된 JSON 형식으로만 응답해야 합니다. 
    당신의 임무는 주어진 기술 게시물을 분석하여, 독자들이 글의 핵심 내용을 30초 안에 파악할 수 있도록 **매우 간결하고 명확한** 요약문을 생성하는 것입니다.

    다음 <article> 태그 안의 내용을 분석하여, 아래 <output_format> 형식과 **제약 조건**에 맞춰 결과를 JSON 객체로 출력해주세요.

    <article>
    ${textOnlyContent.substring(0, 10000)}
    </article>

    <output_format>
    {
      "summary": [
        "1. 첫 번째 핵심 요약 문장 (60자 내외)",
        "2. 두 번째 핵심 요약 문장 (60자 내외)",
        "3. 세 번째 핵심 요약 문장 (60자 내외)"
      ],
      "keywords": ["핵심 키워드 1", "핵심 키워드 2", "핵심 키워드 3"]
    }
    </output_format>

    **제약 조건:**
    - **요약:** 각 문장은 **숫자와 점(예: "1. ")으로 시작**하고, **반드시 50자 내외**로 작성해주세요.
    - **키워드:** 가장 핵심적인 키워드 3개만 추출합니다.
    - **출력:** 다른 설명 없이, 오직 유효한 JSON 객체만 출력해야 합니다.

    Assistant:
    `;

      const bedrockCommand = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 500, // JSON 구조와 내용을 포함해야 하므로 토큰을 조금 더 넉넉하게 설정
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const apiResponse = await bedrockClient.send(bedrockCommand);
      const decodedBody = new TextDecoder().decode(apiResponse.body);
      const responseBody = JSON.parse(decodedBody);

      const aiResultText = responseBody.content?.[0]?.text ?? '';
      //  안전한 JSON 추출 함수를 사용합니다.
      const aiResultJson = extractJsonObject(aiResultText);

      //  기본값을 보장하여 안정성을 높입니다.
      const newSummary = Array.isArray(aiResultJson.summary) ? aiResultJson.summary.join('\n') : String(aiResultJson.summary || '');
      const keywords = Array.isArray(aiResultJson.keywords) ? aiResultJson.keywords : [];

      // 4. 생성된 요약을 DB에 저장(캐싱)합니다. - await 추가
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        UpdateExpression: 'SET aiSummary = :summary, aiKeywords = :keywords',
        ExpressionAttributeValues: {
          ':summary': newSummary,
          ':keywords': keywords, // 이제 keywords는 항상 배열이므로 안전합니다.
        },
      }));

      // 5. 생성된 요약을 사용자에게 반환합니다. - return 추가
      return c.json({ summary: newSummary, keywords, source: 'live' });

    } catch (error: any) {
      console.error('AI Summary Error:', error);
      return c.json({ message: 'Failed to generate AI summary.', error: error.message }, 500);
    }
  }
);

// --- [요약 캐시 지우기] DELETE /:postId/summary - AI 요약 캐시 삭제 (관리자 전용) ---
postsRouter.delete(
  '/:postId/summary',
  cookieAuthMiddleware,
  adminOnlyMiddleware, // [보안] 오직 관리자만 이 API를 호출할 수 있습니다.
  async (c) => {
    const postId = c.req.param('postId');
    const TABLE_NAME = process.env.TABLE_NAME!;

    try {
      // UpdateCommand를 사용하여 aiSummary와 aiKeywords 속성만 제거(REMOVE)합니다.
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `POST#${postId}`, SK: 'METADATA' },
        // REMOVE 액션은 지정된 속성을 아이템에서 완전히 삭제합니다.
        UpdateExpression: 'REMOVE aiSummary, aiKeywords',
      });

      await ddbDocClient.send(command);

      return c.json({ message: 'AI summary cache cleared successfully.' }, 200);

    } catch (error: any) {
      console.error('Clear AI Summary Cache Error:', error);
      return c.json({ message: 'Failed to clear AI summary cache.', error: error.message }, 500);
    }
  }
);

export default postsRouter;
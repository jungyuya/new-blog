// 파일 위치: apps/backend/src/services/posts.service.ts

import { checkUserLikeStatus } from './likes.service';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, DeleteObjectsCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../lib/dynamodb';
import { togglePostLike } from './likes.service';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as postsRepository from '../repositories/posts.repository';
import type { Post, UserContext } from '../lib/types';

const lambdaClient = new LambdaClient({ region: process.env.REGION });


/**
 * 게시물과 관련된 비즈니스 로직을 처리하는 서비스 함수들의 모음입니다.
 * 데이터베이스 직접 접근, HTTP 요청/응답 처리는 여기서 하지 않습니다.
 */

/**
 * 특정 게시물의 상세 정보와 관련 데이터를 조회합니다.
 * @param postId 조회할 게시물의 ID
 * @param anonymousId '좋아요' 상태 확인을 위한 익명 사용자 ID
 * @param userGroups 현재 사용자의 그룹 정보 (관리자 여부 확인용)
 * @param currentUserId 현재 로그인한 사용자의 ID (비밀글 접근 권한 확인용)
 * @returns 게시물 상세 정보, 이전/다음 글 정보 등을 포함하는 객체
 */
export async function getPostDetails(
  postId: string,
  anonymousId: string | undefined,
  userGroups: string[] | undefined,
  currentUserId: string | undefined
) {
  const isAdmin = userGroups?.includes('Admins') ?? false;

  const post = await postsRepository.findPostById(postId);

  if (!post) {
    return null;
  }

  if (post.visibility === 'private') {
    // 비공개 글은 반드시 로그인한 사용자여야 하며, 그 사용자가 작성자여야 합니다.
    if (!currentUserId || post.authorId !== currentUserId) {
      return 'forbidden';
    }
  }

  // --- [핵심 수정] 조회수 증가는 더 이상 응답을 기다리지 않습니다. ---
  // 이 함수는 내부적으로 await하지 않으므로, 즉시 다음 코드로 넘어갑니다.
  postsRepository.incrementViewCount(postId);

  // --- [핵심 수정] Promise.all에서 incrementViewCount를 제거합니다. ---
  const [isLiked, allPostsForNav] = await Promise.all([
    anonymousId ? checkUserLikeStatus(postId, anonymousId) : Promise.resolve(false),
    postsRepository.findAllPostTitlesForNav(isAdmin),
  ]);

  const currentIndex = allPostsForNav.findIndex(p => p.postId === postId);
  let prevPost = null;
  let nextPost = null;
  if (currentIndex !== -1) {
    if (currentIndex + 1 < allPostsForNav.length) {
      prevPost = allPostsForNav[currentIndex + 1];
    }
    if (currentIndex - 1 >= 0) {
      nextPost = allPostsForNav[currentIndex - 1];
    }
  }

  return {
    post: {
      ...post,
      isLiked: isLiked,
      likeCount: post.likeCount || 0,
    },
    prevPost,
    nextPost,
  };
}

interface GetPostListOptions {
  limit: number;
  cursor?: string;
  userGroups?: string[];
}

/**
 * 보강된(enriched) 게시물 목록을 조회합니다.
 * @param options limit, cursor, userGroups를 포함하는 옵션 객체
 * @returns 보강된 게시물 배열과 다음 페이지를 위한 커서
 */
export async function getPostList({ limit, cursor, userGroups }: GetPostListOptions) {
  const isAdmin = userGroups?.includes('Admins') ?? false;

  // 1. Repository를 통해 기본적인 게시물 목록을 가져옵니다.
  const { posts, nextCursor } = await postsRepository.findAllPosts({ limit, cursor, isAdmin });

  if (posts.length === 0) {
    return { posts: [], nextCursor: null };
  }

  // 2. [데이터 조합] 가져온 게시물들의 댓글 수를 한 번의 호출로 가져옵니다. (N+1 해결)
  const postIds = posts.map(p => p.postId);
  const commentCounts = await postsRepository.findCommentCounts(postIds);

  // 3. [비즈니스 로직] 각 게시물에 추가 정보를 보강(enrich)합니다.
  const enrichedPosts = posts.map(post => {
    // authorAvatarUrl은 게시물 생성/수정 시 비정규화되어 이미 포함되어 있습니다.
    // 만약 이 값이 없는 레거시 데이터가 있다면, 여기서 userRepository를 호출하여 보강할 수 있습니다.
    return {
      ...post,
      commentCount: commentCounts[post.postId] || 0,
      likeCount: post.likeCount || 0, // likeCount가 없는 경우를 대비한 기본값 설정
    };
  });

  return { posts: enrichedPosts, nextCursor };
}

/**
 * 추천 게시물 데이터(Hero Post, Editor's Picks)를 조회합니다.
 * @param userGroups 현재 사용자의 그룹 정보 (관리자 여부 확인용)
 * @returns Hero Post와 Editor's Picks 목록
 */
export async function getFeaturedPosts(userGroups?: string[]) {
  const isAdmin = userGroups?.includes('Admins') ?? false;

  // 1. [데이터 조회] 사이트 설정과 'featured' 태그 게시물 목록을 병렬로 가져옵니다.
  const [config, featuredItems] = await Promise.all([
    postsRepository.findSiteConfig(),
    postsRepository.findPostsByTag('featured', isAdmin),
  ]);

  const heroPostId = config?.heroPostId;

  // 2. [데이터 필터링 및 가공] Hero 게시물과 Editor's Picks를 분리하고 필터링합니다.
  let heroPostItem: Post | null = null;
  if (heroPostId) {
    // 'featured' 태그 목록에 Hero 게시물이 포함되어 있을 수 있으므로, DB를 다시 조회하는 대신 목록에서 찾습니다.
    heroPostItem = featuredItems.find(p => p.postId === heroPostId) || null;
    // 만약 featured 태그 목록에 없다면 (태그가 제거된 경우 등), DB에서 직접 조회합니다.
    if (!heroPostItem) {
      heroPostItem = await postsRepository.findPostById(heroPostId);
    }
  }

  const editorPicksItems = featuredItems
    .filter(p => p.postId !== heroPostId) // Hero 게시물 제외
    .slice(0, 4); // 최대 4개만 선택

  // 3. [데이터 보강] 보강이 필요한 모든 게시물 목록을 준비합니다.
  const postsToEnrich = [...editorPicksItems];
  if (heroPostItem) {
    postsToEnrich.push(heroPostItem);
  }

  if (postsToEnrich.length === 0) {
    return { heroPost: null, editorPicks: [] };
  }

  // 4. 댓글 수를 한 번에 조회하고, 각 게시물에 보강합니다.
  const postIds = postsToEnrich.map(p => p.postId);
  const commentCounts = await postsRepository.findCommentCounts(postIds);

  const enrich = (post: Post): Post & { commentCount: number } => ({
    ...post,
    commentCount: commentCounts[post.postId] || 0,
    likeCount: post.likeCount || 0,
  });

  const enrichedHeroPost = heroPostItem ? enrich(heroPostItem) : null;
  const enrichedEditorPicks = editorPicksItems.map(enrich);

  // 5. 최종 데이터 구조로 반환합니다.
  return {
    heroPost: enrichedHeroPost,
    editorPicks: enrichedEditorPicks,
  };
}

// 파일 위치: apps/backend/src/services/posts.service.ts
// ... (기존 함수들) ...

interface GetLatestPostsOptions {
  limit: number;
  cursor?: string;
  userGroups?: string[];
}

/**
 * 추천 게시물을 제외한 최신 게시물 목록을 조회합니다.
 * @param options limit, cursor, userGroups를 포함하는 옵션 객체
 * @returns 최신 게시물 배열과 다음 페이지를 위한 커서
 */
export async function getLatestPosts({ limit, cursor, userGroups }: GetLatestPostsOptions) {
  const isAdmin = userGroups?.includes('Admins') ?? false;

  // 1. 제외해야 할 추천 게시물 ID 목록을 가져옵니다.
  const [config, featuredItems] = await Promise.all([
    postsRepository.findSiteConfig(),
    postsRepository.findPostsByTag('featured', true),
  ]);

  const excludeIds = new Set<string>();
  if (config?.heroPostId) {
    excludeIds.add(config.heroPostId);
  }
  featuredItems.forEach(item => excludeIds.add(item.postId));

  // 2. [핵심 수정] 확장된 findAllPosts 함수를 사용하여 DB 레벨에서 필터링합니다.
  const { posts, nextCursor } = await postsRepository.findAllPosts({
    limit,
    cursor,
    isAdmin,
    excludeIds,
  });

  // 서비스 계층에서는 더 이상 비효율적인 필터링을 할 필요가 없습니다.
  return { posts, nextCursor };
}

const CreatePostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  status: z.enum(['published', 'draft']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  showToc: z.boolean().optional(),
});
type CreatePostInput = z.infer<typeof CreatePostSchema>;

/**
 * 새로운 게시물을 생성합니다.
 * @param authorContext 게시물 작성자 정보
 * @param postInput 게시물 생성에 필요한 데이터 (title, content 등)
 * @returns 생성된 Post 아이템 객체
 */
export async function createPost(authorContext: UserContext, postInput: CreatePostInput): Promise<Post> {
  const { userId, userEmail } = authorContext;
  const { title, content, tags = [], status = 'published', visibility = 'public' } = postInput;

  const postId = uuidv4();
  const now = new Date().toISOString();
  const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;

  // 1. [비즈니스 로직] 작성자 프로필 정보를 조회하여 닉네임, 바이오 등을 결정합니다.
  // TODO: 이 로직은 추후 users.repository.ts로 이전되어야 합니다.
  const { Item: authorProfile } = await ddbDocClient.send(new GetCommand({
    TableName: process.env.TABLE_NAME!,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
  }));
  const authorNickname = authorProfile?.nickname || userEmail?.split('@')[0] || '익명';
  const authorBio = authorProfile?.bio || '';
  const authorAvatarUrl = authorProfile?.avatarUrl || '';

  // 2. [비즈니스 로직] content를 기반으로 thumbnailUrl, imageUrl, summary 등 파생 데이터를 생성합니다.
  const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
  const firstImageMatch = content.match(imageUrlRegex);
  let thumbnailUrl = '';
  let imageUrl = '';
  if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
    imageUrl = firstImageMatch[1];
    thumbnailUrl = imageUrl.replace('/images/', '/thumbnails/');
  }

  const summary = content
    .replace(/\[toc\]|\[목차\]/g, '') // [toc] 또는 [목차] 제거
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/[#*`_~=\->|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 150) + (content.length > 150 ? '...' : '');

  // 3. [데이터 객체 생성] Repository에 전달할 Post 아이템과 Tag 아이템들을 준비합니다.
  const postItem: Post = {
    PK: `POST#${postId}`, SK: 'METADATA',
    postId, title, content, summary,
    authorId: userId, authorEmail: userEmail,
    createdAt: now, updatedAt: now,
    isDeleted: false, viewCount: 0,
    status, visibility,
    authorNickname, authorBio, authorAvatarUrl,
    tags, thumbnailUrl, imageUrl,
    // GSI Keys
    GSI1_PK: `USER#${userId}`, GSI1_SK: `POST#${now}#${postId}`,
    GSI3_PK: 'POST#ALL', GSI3_SK: `${now}#${postId}`
  };

  const tagItems = tags.map(tagName => {
    const normalizedTagName = tagName.trim().toLowerCase();
    return {
      PK: `TAG#${normalizedTagName}`, SK: `POST#${postId}`,
      // 태그 아이템에 비정규화하여 저장할 게시물 정보들
      postId: postItem.postId, title: postItem.title, summary: postItem.summary,
      authorNickname: postItem.authorNickname,
      authorBio: postItem.authorBio,
      authorAvatarUrl: postItem.authorAvatarUrl,
      createdAt: postItem.createdAt, status: postItem.status,
      visibility: postItem.visibility, thumbnailUrl: postItem.thumbnailUrl,
      viewCount: postItem.viewCount, tags: postItem.tags,
    };
  });

  // 4. [데이터 쓰기 위임] Repository를 호출하여 DB에 최종적으로 저장합니다.
  await postsRepository.createPostWithTags(postItem, tagItems);

  return postItem;
}

/**
 * 게시물을 삭제합니다. (S3 이미지 삭제 포함)
 * @param postId 삭제할 게시물의 ID
 * @param currentUserId 삭제를 요청한 사용자의 ID (권한 확인용)
 * @returns 삭제 성공 시 true, 게시물이 없으면 'not_found', 권한이 없으면 'forbidden'
 */
export async function deletePost(postId: string, currentUserId: string): Promise<boolean | 'not_found' | 'forbidden'> {
  // 1. [데이터 조회] 삭제할 게시물이 실제로 존재하는지, 그리고 권한 확인을 위해 원본 데이터를 가져옵니다.
  const post = await postsRepository.findPostById(postId);

  if (!post) {
    return 'not_found';
  }

  // 2. [비즈니스 로직] 삭제 권한을 확인합니다.
  if (post.authorId !== currentUserId) {
    return 'forbidden';
  }

  // 3. [외부 시스템 연동] S3에 업로드된 관련 이미지들을 삭제합니다.
  const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;
  const content = post.content || '';
  const imageUrlRegex = new RegExp(`https://${BUCKET_NAME}.s3.[^/]+/(images|thumbnails)/([^)]+)`, 'g');
  const keysToDelete = new Set<string>();
  let match;
  while ((match = imageUrlRegex.exec(content)) !== null) {
    const key = `${match[1]}/${match[2]}`;
    keysToDelete.add(key);
    if (match[1] === 'images') {
      keysToDelete.add(`thumbnails/${match[2]}`);
    } else {
      keysToDelete.add(`images/${match[2]}`);
    }
  }

  if (keysToDelete.size > 0) {
    const s3 = new S3Client({ region: process.env.REGION });
    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: { Objects: Array.from(keysToDelete).map(key => ({ Key: key })), Quiet: true },
    }));
    console.log(`Deleted ${keysToDelete.size} objects from S3 for post ${postId}`);
  }

  // 4. [데이터 쓰기 위임] Repository를 호출하여 DB에서 논리적으로 삭제 처리합니다.
  await postsRepository.softDeletePostAndTags(post);

  return true;
}

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['published', 'draft']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  showToc: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: '수정할 내용을 하나 이상 제공해야 합니다.',
});
type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

/**
 * 게시물을 수정합니다.
 * @param postId 수정할 게시물의 ID
 * @param currentUserId 수정를 요청한 사용자의 ID
 * @param updateInput 수정할 데이터
 * @returns 수정된 Post 객체, 또는 'not_found', 'forbidden'
 */
export async function updatePost(postId: string, currentUserId: string, updateInput: UpdatePostInput): Promise<Post | 'not_found' | 'forbidden'> {
  // 1. [데이터 조회] 수정할 게시물의 원본 데이터를 가져옵니다.
  const existingPost = await postsRepository.findPostById(postId);
  if (!existingPost) {
    return 'not_found';
  }

  // 2. [비즈니스 로직] 수정 권한을 확인합니다.
  if (existingPost.authorId !== currentUserId) {
    return 'forbidden';
  }

  const now = new Date().toISOString();
  const BUCKET_NAME = process.env.IMAGE_BUCKET_NAME!;
  const finalUpdateData: Partial<Post> = { ...updateInput, updatedAt: now };

  // 3. [비즈니스 로직] content가 수정된 경우, 파생 데이터를 재계산합니다.
  if (updateInput.content) {
    const { content } = updateInput;
    // Summary 재계산
    finalUpdateData.summary = content
      .replace(/\[toc\]|\[목차\]/g, '') // [toc] 또는 [목차] 제거
      .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '').replace(/<[^>]*>?/gm, ' ')
      .replace(/[#*`_~=\->|]/g, '').replace(/\s+/g, ' ').trim()
      .substring(0, 150) + (content.length > 150 ? '...' : '');

    // Thumbnail/Image URL 재계산
    const imageUrlRegex = /!\[.*?\]\((https:\/\/[^)]+)\)/;
    const firstImageMatch = content.match(imageUrlRegex);
    if (firstImageMatch && firstImageMatch[1] && firstImageMatch[1].includes(BUCKET_NAME)) {
      finalUpdateData.imageUrl = firstImageMatch[1];
      finalUpdateData.thumbnailUrl = firstImageMatch[1].replace('/images/', '/thumbnails/');
    } else {
      finalUpdateData.imageUrl = '';
      finalUpdateData.thumbnailUrl = '';
    }
  }

  // 4. [비즈니스 로직] 태그 동기화 로직을 처리합니다.
  if (updateInput.tags) {
    const oldTags = new Set(existingPost.tags || []);
    const newTags = new Set(updateInput.tags);
    const tagsToDelete = [...oldTags].filter(t => !newTags.has(t));
    const tagsToAdd = [...newTags].filter(t => !oldTags.has(t));

    // TODO: 작성자 프로필 정보(닉네임 등)가 변경되었을 경우를 대비해 모든 태그를 업데이트하는 것이 더 안정적일 수 있습니다.
    // 우선 기존 로직과 동일하게, 추가되는 태그만 새로 생성합니다.
    const postSnapshot = { ...existingPost, ...finalUpdateData };
    const tagsToAddOrUpdate = updateInput.tags.map(tagName => ({
      PK: `TAG#${tagName.trim().toLowerCase()}`, SK: `POST#${postId}`,
      postId, title: postSnapshot.title, summary: postSnapshot.summary,
      authorNickname: postSnapshot.authorNickname, authorBio: postSnapshot.authorBio,
      authorAvatarUrl: postSnapshot.authorAvatarUrl, createdAt: postSnapshot.createdAt,
      status: postSnapshot.status, visibility: postSnapshot.visibility,
      thumbnailUrl: postSnapshot.thumbnailUrl, viewCount: postSnapshot.viewCount,
      tags: postSnapshot.tags,
    }));

    await postsRepository.syncTagsForPost(postId, tagsToDelete, tagsToAddOrUpdate);
  }

  // 5. [데이터 쓰기 위임] Repository를 호출하여 Post 아이템을 최종적으로 업데이트합니다.
  const updatedPost = await postsRepository.updatePost(postId, finalUpdateData);

  return updatedPost;
}

/**
 * 게시물의 '좋아요' 상태를 토글합니다.
 * 이 함수는 likes.service의 함수를 호출하는 래퍼(wrapper) 역할을 합니다.
 * @param postId 토글할 게시물의 ID
 * @param anonymousId '좋아요'를 누른 사용자의 익명 ID
 * @returns 업데이트된 likeCount와 isLiked 상태. 게시물이 없으면 'not_found'
 */
export async function toggleLikeForPost(postId: string, anonymousId: string) {
  try {
    const result = await togglePostLike(postId, anonymousId);
    return result;
  } catch (error: any) {
    // likes.service에서 던진 'Post not found' 에러를 잡아 서비스 계층의 통일된 반환값으로 변환합니다.
    if (error.message === 'Post not found') {
      return 'not_found';
    }
    // 그 외의 예상치 못한 에러는 그대로 다시 던져서 상위 핸들러(라우터)가 처리하도록 합니다.
    throw error;
  }
}

/**
 * [신규] 특정 게시물에 대한 음성 생성을 시작합니다.
 * @param postId 음성을 생성할 게시물의 ID
 * @param authorContext 요청을 보낸 사용자의 정보 (권한 확인용)
 */
export async function generateSpeechForPost(postId: string, authorContext: UserContext) {
  // 1. 게시물 조회 및 상태 확인
  const post = await postsRepository.findPostById(postId);

  if (!post) {
    return { status: 'not_found', message: 'Post not found.' };
  }

  // 2. 중복 실행 방지
  if (post.speechStatus === 'PENDING') {
    return { status: 'conflict', message: 'Speech generation is already in progress.' };
  }
  // (선택) 이미 완료된 경우, 재생성을 허용할지 결정. 여기서는 허용하지 않음.
  if (post.speechStatus === 'COMPLETED') {
    return { status: 'conflict', message: 'Speech has already been generated.' };
  }

  // 3. DB 상태를 'PENDING'으로 업데이트
  try {
    await postsRepository.updatePost(postId, { speechStatus: 'PENDING' });
  } catch (error) {
    console.error(`Failed to update post status to PENDING for postId: ${postId}`, error);
    throw new Error('Failed to set post status before starting generation.');
  }

  // 4. SpeechSynthesisLambda 비동기 호출
  const functionName = `blog-speech-synthesis-handler-${process.env.STACK_NAME || 'BlogInfraStack'}`;
  const payload = {
    postId: post.postId,
    content: post.content,
  };

  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: JSON.stringify(payload),
    InvocationType: 'Event', // 비동기 호출 (응답을 기다리지 않음)
  });

  try {
    await lambdaClient.send(command);
    console.log(`Successfully invoked ${functionName} for post: ${postId}`);
    return { status: 'accepted', message: 'Speech generation task has been started.' };
  } catch (error) {
    console.error(`Failed to invoke SpeechSynthesisLambda for postId: ${postId}`, error);
    // 롤백: Lambda 호출에 실패했으므로, DB 상태를 다시 원상 복구 시도
    await postsRepository.updatePost(postId, { speechStatus: null } as any).catch(rbError => {
      console.error(`CRITICAL: Failed to rollback PENDING status for postId: ${postId}`, rbError);
    });
    throw new Error('Failed to invoke the speech generation lambda.');
  }
}

/**
 * [신규] 특정 게시물의 생성된 음성을 삭제합니다.
 * @param postId 음성을 삭제할 게시물의 ID
 * @param authorContext 요청을 보낸 사용자의 정보 (권한 확인용)
 */
export async function deleteSpeechForPost(postId: string, authorContext: UserContext) {
  // 1. 게시물 조회
  const post = await postsRepository.findPostById(postId);

  if (!post) {
    return { status: 'not_found', message: 'Post not found.' };
  }

  // 2. 권한 확인 (향후 관리자 외 작성자 본인도 삭제 가능하도록 확장 가능)
  // 현재는 adminOnlyMiddleware에서 이미 확인했지만, 서비스 계층에서도 방어적으로 확인
  if (!authorContext.userGroups.includes('Admins')) {
    return { status: 'forbidden', message: 'You are not authorized to perform this action.' };
  }

  // 3. speechUrl이 없으면 삭제할 것도 없으므로 성공 처리
  if (!post.speechUrl) {
    console.log(`Speech data for post ${postId} does not exist. Nothing to delete.`);
    return { status: 'no_content', message: 'Speech data does not exist.' };
  }

  // 4. S3에서 MP3 파일 삭제
  try {
    const url = new URL(post.speechUrl);
    const key = url.pathname.substring(1); // 맨 앞의 '/' 제거 (예: speeches/post-id/speech.mp3)

    const s3 = new S3Client({ region: process.env.REGION });
    const command = new DeleteObjectCommand({
      Bucket: process.env.SYNTHESIZED_SPEECH_BUCKET_NAME!,
      Key: key,
    });
    await s3.send(command);
    console.log(`Successfully deleted speech file from S3: ${key}`);
  } catch (error) {
    console.error(`Failed to delete speech file from S3 for post ${postId}. Continuing with DB cleanup.`, error);
    // S3 파일 삭제에 실패하더라도 DB 정리는 시도하는 것이 좋습니다.
  }

  // 5. DynamoDB에서 speechUrl과 speechStatus 속성 제거
  // 이전 Step에서 개선한 repository 함수를 사용합니다.
  await postsRepository.updatePost(postId, {
    speechUrl: null,
    speechStatus: null,
  } as any);

  console.log(`Successfully removed speech attributes from DynamoDB for post ${postId}`);
  return { status: 'success', message: 'Speech data deleted successfully.' };
}


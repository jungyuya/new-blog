// 파일 위치: apps/backend/src/services/posts.service.ts

import { checkUserLikeStatus } from './likes.service';
import * as postsRepository from '../repositories/posts.repository';
import type { Post, UserContext } from '../lib/types';

/**
 * 게시물과 관련된 비즈니스 로직을 처리하는 서비스 함수들의 모음입니다.
 * 데이터베이스 직접 접근, HTTP 요청/응답 처리는 여기서 하지 않습니다.
 */

// 여기에 getPostDetails, createPost 등 함수가 추가될 예정입니다.


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
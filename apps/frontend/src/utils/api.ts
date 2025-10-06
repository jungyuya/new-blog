// 파일 위치: apps/frontend/src/utils/api.ts (v4.5 - Final Verified Code)

import { getAnonymousId } from './anonymousId';


// --- [핵심 수정] 동료 검토 의견을 반영한 안전한 X-Ray 연동 로직 ---

// 1. 내부 API 호출에만 추적 헤더를 주입하기 위한 호스트 화이트리스트
//    getApiBaseUrl()이 서버/클라이언트에서 다른 값을 반환하므로, 서버에서만 사용될 호스트를 확인합니다.
let internalApiHostname: string | null = null;
if (typeof window === 'undefined') {
  try {
    const internalEndpoint = process.env.INTERNAL_API_ENDPOINT;
    if (internalEndpoint) {
      internalApiHostname = new URL(internalEndpoint).hostname;
    }
  } catch (e) {
    console.error("Failed to parse INTERNAL_API_ENDPOINT:", e);
  }
}

// 2. X-Ray SDK를 요청마다 require하지 않도록 캐싱하는 변수
let XRaySDK: any = null;
let xrayInitAttempted = false;

function ensureXRayIsLoaded() {
  if (XRaySDK || xrayInitAttempted) return XRaySDK;
  xrayInitAttempted = true;
  try {
    // 동적 require는 빌드 시점에 클라이언트 번들에 포함되는 것을 방지합니다.
    XRaySDK = require('aws-xray-sdk-core');
  } catch (e) {
    console.warn('[X-Ray] require failed (likely running in client bundle):', (e as Error).message);
    XRaySDK = null;
  }
  return XRaySDK;
}

export interface Post {
  PK: string;
  SK: string;
  postId: string;
  title: string;
  authorId: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  // --- 추가된 속성들 ---
  viewCount?: number;
  status?: 'published' | 'draft';
  visibility?: 'public' | 'private';
  authorNickname?: string;
  authorAvatarUrl?: string;
  authorBio?: string;
  tags?: string[];
  thumbnailUrl?: string;
  isDeleted?: boolean;
  summary?: string;
  content?: string;
  commentCount?: number;
  likeCount?: number;
  isLiked?: boolean;
  aiSummary?: string;
  aiKeywords?: string[];
  speechUrl?: string;
  speechStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | null;
  showToc?: boolean;
}

export interface UserProfile {
  PK: string;
  SK: string;
  userId: string;
  email: string;
  nickname: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// --- 댓글 타입 정의 ---
export interface Comment {
  commentId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl?: string;
  createdAt: string;
  isDeleted: boolean;
  parentCommentId: string | null;
  // 재귀적인 구조를 표현하기 위해, Comment 타입 자신이 배열로 포함됩니다.
  replies: Comment[];
}

// --- 이전/다음 글 타입 정의 ---
export interface AdjacentPost {
  postId: string;
  title: string;
}

// --- 페이지네이션 응답을 위한 타입 정의 ---
export interface PaginatedPosts {
  posts: Post[];
  nextCursor: string | null;
}

// [추가] 추천 데이터 API의 새로운 응답 타입을 정의합니다.
export interface FeaturedData {
  heroPost: Post | null;
  editorPicks: Post[];
}

const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_ENDPOINT;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

async function fetchWrapper<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // --- [수정 2] 모든 API 요청에 익명 ID 헤더를 자동으로 추가합니다. ---
  // --- 서버 환경에서만 실행되는 로직 ---
  if (typeof window === 'undefined') {
    // X-Ray 헤더 주입
    try {
      const targetUrl = new URL(url);
      // 내부 API 호출일 경우에만 헤더를 주입 (보안 강화)
      if (internalApiHostname && targetUrl.hostname === internalApiHostname) {
        const AWSXRay = ensureXRayIsLoaded();
        if (AWSXRay) {
          const segment = AWSXRay.getSegment();
          if (segment) {
            const traceHeader = `Root=${segment.trace_id};Parent=${segment.id};Sampled=${segment.notTraced ? '0' : '1'}`;
            headers.set('X-Amzn-Trace-Id', traceHeader);
          } else {
            console.debug('[X-Ray] No active segment found. Trace header not attached.');
          }
        }
      }
    } catch (err) {
      console.error('[X-Ray] Failed to attach trace header:', err);
    }

    // 쿠키 전달 로직
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    if (allCookies.length > 0) {
      const cookieHeader = allCookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
      headers.set('Cookie', cookieHeader);
    }
  } else {
    // 브라우저 환경
    const anonymousId = getAnonymousId();
    if (anonymousId) {
      headers.set('X-Anonymous-Id', anonymousId);
    }
  }

  const defaultOptions: RequestInit = {
    ...options,
    headers: headers,
    credentials: 'include',
    cache: 'no-store',
  };

  const response = await fetch(url, defaultOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
    throw new Error(errorData.message || `API call failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return Promise.resolve({} as T);
}


export const api = {
  // --- Auth APIs ---
  login: (credentials: { email: string; password: string }): Promise<{ message: string }> => {
    return fetchWrapper('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  fetchCurrentUser: (): Promise<{ user: { id: string; email: string } }> => {
    return fetchWrapper('/users/me', { method: 'GET' });
  },
  logout: (): Promise<{ message: string }> => {
    return fetchWrapper('/auth/logout', { method: 'POST' });
  },
  signup: (credentials: { email: string; password: string }): Promise<{ message: string }> => {
    return fetchWrapper('/auth/signup', { method: 'POST', body: JSON.stringify(credentials) });
  },
  // --- Post APIs ---
  fetchPosts: (limit: number | null, cursor: string | null): Promise<PaginatedPosts> => {
    const params = new URLSearchParams();

    // limit 값이 유효한 숫자인 경우에만 파라미터에 추가합니다.
    if (limit && limit > 0) {
      params.append('limit', String(limit));
    }
    // cursor 값이 유효한 문자열인 경우에만 파라미터에 추가합니다.
    if (cursor) {
      params.append('cursor', cursor);
    }
    const queryString = params.toString();
    const path = queryString ? `/posts?${queryString}` : '/posts';

    return fetchWrapper(path, { method: 'GET' });
  },
  // [추가] 추천 게시물을 가져오는 새로운 함수
  fetchFeaturedPosts: (): Promise<FeaturedData> => {
    return fetchWrapper('/posts/featured', { method: 'GET' });
  },
  // --- [신규 추가] 추천을 제외한 최신 게시물을 가져오는 함수 ---
  fetchLatestPosts: (limit: number | null, cursor: string | null): Promise<PaginatedPosts> => {
    const params = new URLSearchParams();
    if (limit && limit > 0) {
      params.append('limit', String(limit));
    }
    if (cursor) {
      params.append('cursor', cursor);
    }
    const queryString = params.toString();
    // [핵심] '/posts'가 아닌 '/posts/latest'를 호출합니다.
    const path = queryString ? `/posts/latest?${queryString}` : '/posts/latest';

    return fetchWrapper(path, { method: 'GET' });
  },

  fetchPostById: (postId: string): Promise<{
    post: Post;
    prevPost: AdjacentPost | null;
    nextPost: AdjacentPost | null;
  }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'GET' });
  },
  createNewPost: (postData: {
    title: string;
    content: string;
    tags?: string[];
    status?: 'published' | 'draft';
    visibility?: 'public' | 'private';
  }): Promise<{ message: string; post: Post }> => {
    return fetchWrapper('/posts', { method: 'POST', body: JSON.stringify(postData) });
  },
  getPresignedUrl: (fileName: string): Promise<{ presignedUrl: string; key: string; publicUrl: string; }> => {
    // 쿼리 파라미터를 포함하여 GET 요청을 보냅니다.
    return fetchWrapper(`/images/presigned-url?fileName=${encodeURIComponent(fileName)}`, {
      method: 'GET',
    });
  },
  updatePost: (
    postId: string,
    postData: {
      title?: string;
      content?: string;
      tags?: string[];
      status?: 'published' | 'draft';
      visibility?: 'public' | 'private';
    }
  ): Promise<{ message: string; post: Post }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify(postData) });
  },

  // [신규 추가] 현재 로그인한 사용자의 프로필을 업데이트하는 함수
  updateMyProfile: (profileData: {
    nickname: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<{ message: string; profile: UserProfile }> => {
    return fetchWrapper('/users/me/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  deletePost: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'DELETE' });
  },
  fetchPostsByTag: (tagName: string): Promise<{ posts: Post[] }> => {
    return fetchWrapper(`/tags/${tagName}/posts`, { method: 'GET' });
  },

  toggleLike: (postId: string): Promise<{ likeCount: number; isLiked: boolean }> => {
    return fetchWrapper(`/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  // --- Comment APIs ---
  fetchCommentsByPostId: (postId: string): Promise<Comment[]> => {
    return fetchWrapper(`/posts/${postId}/comments`, { method: 'GET' });
  },

  createComment: (
    postId: string,
    commentData: {
      content: string;
      parentCommentId?: string;
      parentCreatedAt?: string;
    }
  ): Promise<Comment> => {
    return fetchWrapper(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData),
    });
  },
  // --- Comment APIs ---
  updateComment: (commentId: string, commentData: { content: string; postId: string }) =>
    fetchWrapper(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(commentData),
    }),

  deleteComment: (commentId: string, commentData: { postId: string }) =>
    fetchWrapper(`/comments/${commentId}`, {
      method: 'DELETE',
      body: JSON.stringify(commentData),
    }),
  // ---  AI Summary API ---
  fetchSummary: (postId: string): Promise<{ summary: string; keywords: string[]; source: 'cache' | 'live' }> => {
    return fetchWrapper(`/posts/${postId}/summary`, { method: 'GET' });
  },
  // --- Admin APIs ---
  updateHeroPost: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper('/config/hero', {
      method: 'PUT',
      body: JSON.stringify({ postId }),
    });
  },
  deleteSummary: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}/summary`, { method: 'DELETE' });
  },
  // --- 음성 생성 제어 API 클라이언트 ---
  generateSpeech: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}/speech`, {
      method: 'POST',
    });
  },

  deleteSpeech: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}/speech`, {
      method: 'DELETE',
    });
  },
  // --- Tag APIs ---
  fetchPopularTags: (): Promise<{ tags: { name: string; count: number }[] }> => {
    return fetchWrapper('/tags/popular', { method: 'GET' });
  },
};
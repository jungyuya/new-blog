// 파일 위치: apps/frontend/src/utils/api.ts (v4.5 - Final Verified Code)
// 역할: TypeScript 오류를 모두 해결하고, cookies()의 비동기 특성을 완벽히 처리하는 최종 버전.

// Post 타입을 여기에 직접 정의합니다.
export interface Post {
  PK: string;
  SK: string;
  postId: string;
  title: string;
  content: string;
  authorId: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  // --- 추가된 속성들 ---
  viewCount?: number;
  status?: 'published' | 'draft';
  visibility?: 'public' | 'private';
  authorNickname?: string;
  tags?: string[];
  thumbnailUrl?: string;
  isDeleted?: boolean;
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

  if (typeof window === 'undefined') {
    const { cookies } = await import('next/headers');

    // [핵심 최종 수정 1] cookies()는 Promise를 반환하므로 반드시 await으로 실제 객체를 가져옵니다.
    const cookieStore = await cookies();

    const allCookies = cookieStore.getAll();

    if (allCookies.length > 0) {
      // [핵심 최종 수정 2] map의 인자에 명시적 타입을 추가하여 암시적 'any' 오류를 방지합니다.
      const cookieHeader = allCookies
        .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
        .join('; ');
      headers.set('Cookie', cookieHeader);
    }
  }

  const defaultOptions: RequestInit = {
    ...options,
    headers: headers,
    credentials: 'include',
    cache: 'no-store', // Next.js 데이터 캐시 비활성화
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
  fetchPosts: (): Promise<{ posts: Post[] }> => {
    return fetchWrapper('/posts', { method: 'GET' });
  },
  fetchPostById: (postId: string): Promise<{ post: Post }> => {
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

  deletePost: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'DELETE' });
  },
  fetchPostsByTag: (tagName: string): Promise<{ posts: Post[] }> => {
    return fetchWrapper(`/tags/${tagName}/posts`, { method: 'GET' });
  },
};
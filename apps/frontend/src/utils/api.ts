// 파일 위치: apps/frontend/src/utils/api.ts (v4.0 - Environment Aware)
// 역할: 실행 환경(서버/클라이언트)을 스스로 인지하여, 올바른 API 엔드포인트를 사용하는 최종 버전.

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
}

// --- [핵심 업그레이드] ---
// 실행 환경에 따라 다른 API 기본 URL을 반환하는 함수입니다.
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_ENDPOINT;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();
// --- [업그레이드 완료] ---


// fetchWrapper와 api 객체는 이제 이 똑똑해진 API_BASE_URL을 사용하므로,
// 코드 변경 없이도 모든 환경에서 올바르게 동작하게 됩니다.
async function fetchWrapper<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // --- [SSR 쿠키 처리 로직 추가 시작] ---
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (typeof window === 'undefined') {
    // 서버 환경일 경우, next/headers에서 쿠키를 동적으로 import하여 사용합니다.
    // 이 방식은 Next.js가 서버 컴포넌트 렌더링 과정에서 쿠키에 접근할 수 있도록 해줍니다.
    const { cookies } = await import('next/headers');
    const cookieHeader = cookies().toString();
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }
  }
  // --- [SSR 쿠키 처리 로직 추가 끝] ---

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
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

// api 객체는 변경할 필요가 없습니다.
export const api = {
  // --- Auth APIs ---
  login: (credentials: { email: string; password: string }): Promise<{ message: string }> => {
    return fetchWrapper('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  // ... (이하 모든 함수는 기존과 동일)
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
  createNewPost: (postData: { title: string; content: string }): Promise<{ message: string; post: Post }> => {
    return fetchWrapper('/posts', { method: 'POST', body: JSON.stringify(postData) });
  },
  updatePost: (postId: string, postData: { title?: string; content?: string }): Promise<{ message: string; post: Post }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify(postData) });
  },
  deletePost: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'DELETE' });
  },
};
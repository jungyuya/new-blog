// 파일 위치: apps/frontend/src/utils/api.ts (v3.0 - Step 1 수정안)
// 역할: 환경 변수 의존성을 완전히 제거하고, 상대 경로('/api')를 기준으로 통신하는 최종 클라이언트.

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

// --- [핵심 수정] ---
// 기존: const API_BASE_URL = process.env.NEXT_PUBLIC_API_ENDPOINT;
// 변경: 외부 환경 변수에 대한 의존성을 제거하고, 항상 '/api'라는 고정된 값을 사용하도록 변경합니다.
// 이제 이 코드는 어떤 환경에서 실행되든 항상 동일하게 동작합니다.
const API_BASE_URL = '/api';
// --- [수정 완료] ---


// fetchWrapper 함수는 URL 조합 방식 외에는 변경점이 없습니다.
async function fetchWrapper<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`; // 예: '/api' + '/auth/login' = '/api/auth/login'

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

// api 객체의 구조는 변경점이 없습니다. 호출하는 경로가 상대 경로라는 점만 인지하면 됩니다.
export const api = {
  // --- Auth APIs ---
  login: (credentials: { email: string; password: string }): Promise<{ message: string }> => {
    return fetchWrapper('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  fetchCurrentUser: (): Promise<{ user: { id: string; email: string } }> => {
    return fetchWrapper('/users/me', {
      method: 'GET',
    });
  },

  logout: (): Promise<{ message: string }> => {
    return fetchWrapper('/auth/logout', {
      method: 'POST',
    });
  },

  signup: (credentials: { email: string; password: string }): Promise<{ message: string }> => {
    return fetchWrapper('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // --- Post APIs ---
  fetchPosts: (): Promise<{ posts: Post[] }> => {
    return fetchWrapper('/posts', { method: 'GET' });
  },

  fetchPostById: (postId: string): Promise<{ post: Post }> => {
    return fetchWrapper(`/posts/${postId}`, { method: 'GET' });
  },

  createNewPost: (postData: { title: string; content: string }): Promise<{ message: string; post: Post }> => {
    return fetchWrapper('/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  },
  
  updatePost: (postId: string, postData: { title?: string; content?: string }): Promise<{ message: string; post: Post }> => {
    return fetchWrapper(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(postData),
    });
  },

  deletePost: (postId: string): Promise<{ message: string }> => {
    return fetchWrapper(`/posts/${postId}`, {
      method: 'DELETE',
    });
  },
};
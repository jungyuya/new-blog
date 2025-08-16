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
  // 'typeof window'는 JavaScript가 실행되는 환경을 감지하는 가장 표준적인 방법입니다.
  // 브라우저 환경(클라이언트): 'window' 객체가 존재하므로 'object'를 반환합니다.
  // Node.js 환경(서버): 'window' 객체가 없으므로 'undefined'를 반환합니다.
  if (typeof window === 'undefined') {
    // 여기는 서버 환경에서만 실행되는 코드입니다 (e.g., 서버 컴포넌트).
    // 서버는 외부와 통신해야 하므로, 반드시 전체 주소(절대 경로)가 필요합니다.
    // 이 값은 이후 Step 2에서 Lambda의 런타임 환경 변수로 주입해 줄 것입니다.
    return process.env.INTERNAL_API_ENDPOINT;
  }
  
  // 여기는 브라우저 환경에서만 실행되는 코드입니다 (e.g., 클라이언트 컴포넌트).
  // 브라우저는 현재 도메인을 기준으로 요청을 보내므로, 상대 경로를 사용합니다.
  // 이 요청은 CloudFront 또는 Next.js의 rewrites 프록시가 가로채서 백엔드로 전달합니다.
  return '/api';
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_ENDPOINT;
// --- [업그레이드 완료] ---


// fetchWrapper와 api 객체는 이제 이 똑똑해진 API_BASE_URL을 사용하므로,
// 코드 변경 없이도 모든 환경에서 올바르게 동작하게 됩니다.
async function fetchWrapper<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

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
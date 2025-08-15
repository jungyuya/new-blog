// 파일 위치: apps/frontend/src/utils/api.ts
// 버전: v2.0.0 (Centralized, Cookie-based API Client)
// 역할: 프로젝트의 모든 백엔드 API 호출을 중앙에서 관리하고,
//       HttpOnly 쿠키 기반 인증을 기본으로 지원하는 견고한 클라이언트.

// [유지] Post 타입 정의는 데이터 구조를 명확히 하므로 그대로 유지합니다.
export interface Post {
    PK: string;
    SK: string;
    postId: string;
    title: string;
    content: string;
    authorId: string; // [수정] '인가' 구현을 위해 authorId를 추가합니다.
    authorEmail: string;
    createdAt: string;
    updatedAt: string;
}

// [유지] 환경 변수를 사용하는 방식은 유연성을 위해 그대로 유지합니다.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_ENDPOINT;

// [개선] 모든 fetch 로직을 중앙에서 관리하는 래퍼 함수입니다.
// 일관된 에러 처리와 공통 옵션(credentials) 설정을 보장합니다.
async function fetchWrapper<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // [핵심] 이 옵션으로 모든 요청에 자동으로 쿠키를 포함시킵니다.
    credentials: 'include',
    ...options,
  };

  const response = await fetch(url, defaultOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
    throw new Error(errorData.message || `API call failed with status ${response.status}`);
  }

  // 응답 본문이 없는 경우 (e.g., 204 No Content)를 처리합니다.
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return Promise.resolve({} as T);
}

// [개선] 중앙화된 api 객체입니다.
// 이제 각 API 함수는 '어떻게' 통신할지가 아닌, '무엇을' 할지만 정의하면 됩니다.
export const api = {
  // --- Auth APIs ---
  login: (credentials: { email: string; password: string }): Promise<{ message: string }> => {
    return fetchWrapper('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // [추가] 현재 로그인된 사용자의 정보를 가져오는 함수
  // AuthContext에서 앱 시작 시 호출하여 세션 유효성을 검사합니다.
  fetchCurrentUser: (): Promise<{ user: { id: string; email: string } }> => {
    return fetchWrapper('/users/me', {
      method: 'GET',
    });
  },

  // TODO: 필요 시 logout, signup 등의 함수도 여기에 추가할 수 있습니다.

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

  // TODO: Phase 7 후반부에 updatePost, deletePost 함수를 여기에 추가할 것입니다.
};
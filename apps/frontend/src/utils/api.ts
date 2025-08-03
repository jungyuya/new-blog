// apps/frontend/src/utils/api.ts (최종 완성본)

import { get } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * DynamoDB에 저장되는 Post 아이템의 타입을 정의합니다.
 * 백엔드 index.ts에서 정의한 데이터 구조와 일치해야 합니다.
 */
export interface Post {
    PK: string;
    SK: string;
    postId: string;
    title: string;
    content: string;
    authorEmail: string;
    createdAt: string;
    updatedAt: string;
    // 필요에 따라 isDeleted, viewCount 등 다른 속성도 추가할 수 있습니다.
}

/**
 * 백엔드 API 응답의 타입을 명확하게 정의합니다.
 */
interface ApiResponse {
    posts?: Post[];
    post?: Post;
    message?: string;
}

// API 엔드포인트를 상수로 정의하여 중복을 피하고 유지보수성을 높입니다.
const API_ENDPOINT = "https://oaghj8029h.execute-api.ap-northeast-2.amazonaws.com";

/**
 * 모든 게시물 목록을 가져오는 함수 (공개 API)
 * 웹 표준 fetch를 사용하여, 인증 헤더 없이 호출합니다.
 * @returns 게시물 배열 Promise
 */
export async function fetchPosts(): Promise<Post[]> {
    try {
        // 우리는 이전에 Amplify API 모듈의 get()에서 CORS 관련 문제를 겪었습니다.
        // 가장 확실하고 제어하기 쉬운 웹 표준 fetch를 사용하여 안정성을 확보합니다.
        const response = await fetch(`${API_ENDPOINT}/posts`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}`);
        }

        // 응답 본문을 JSON으로 파싱하고, 우리가 정의한 ApiResponse 타입으로 간주합니다.
        const data = await response.json() as ApiResponse;

        // 데이터가 존재하고, 'posts' 키가 있으며, 그 값이 배열인지 확인하는 방어적 코딩
        if (data && 'posts' in data && Array.isArray(data.posts)) {
            console.log('Fetched posts successfully:', data.posts);
            return data.posts;
        }

        // 예상치 못한 응답 형식일 경우, 콘솔에 경고를 남기고 빈 배열을 반환합니다.
        console.warn('API response for posts is not in the expected format:', data);
        return [];
    } catch (error) {
        console.error('Error fetching posts:', error);
        // UI가 깨지지 않도록 오류 발생 시에도 빈 배열을 반환합니다.
        return [];
    }
}

/**
 * 새로운 게시물을 생성하는 함수 (인증 필요 API)
 * fetch를 사용하되, Amplify Auth에서 토큰을 가져와 헤더에 추가합니다.
 * @param title 게시물 제목
 * @param content 게시물 내용
 * @returns 생성된 게시물 정보가 포함된 응답 객체 Promise
 */
export async function createNewPost(title: string, content: string): Promise<{ message: string; post: Post }> {
    try {
        // 1. Amplify Auth 모듈에서 현재 사용자의 인증 세션을 가져옵니다.
        const { tokens } = await fetchAuthSession();

        // 2. 액세스 토큰이 없으면, 사용자가 로그인하지 않은 것으로 간주하고 오류를 발생시킵니다.
        if (!tokens?.accessToken) {
            throw new Error("No access token found. User might not be logged in.");
        }

        // 3. 웹 표준 fetch를 사용하여 API를 직접 호출합니다.
        const response = await fetch(`${API_ENDPOINT}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 4. 가져온 액세스 토큰을 Bearer 형식으로 Authorization 헤더에 담아 보냅니다.
                'Authorization': `Bearer ${tokens.accessToken.toString()}`
            },
            body: JSON.stringify({ title, content })
        });

        // 5. 응답이 성공(2xx)이 아닐 경우, 응답 본문을 포함하여 오류를 던집니다.
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API call failed with status ${response.status}: ${JSON.stringify(errorBody)}`);
        }

        const data = await response.json() as { message: string; post: Post };
        console.log('POST /posts response (using fetch):', data);
        return data;

    } catch (error) {
        console.error('Error creating post with fetch:', error);
        // 오류를 다시 던져서, 이 함수를 호출한 컴포넌트(NewPostForm)에서
        // catch하여 사용자에게 에러 메시지를 보여줄 수 있도록 합니다.
        throw error;
    }
}

/**
 * 특정 ID를 가진 단일 게시물을 가져오는 함수 (공개 API)
 * @param postId 조회할 게시물의 ID
 * @returns 단일 게시물 객체 또는 null Promise
 */
export async function fetchPostById(postId: string): Promise<Post | null> {
    try {
        // API 경로에 postId를 포함하여 요청합니다. 예: /posts/123-abc-456
        const response = await fetch(`${API_ENDPOINT}/posts/${postId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            // 404 Not Found와 같은 오류를 처리합니다.
            if (response.status === 404) {
                console.warn(`Post with ID ${postId} not found.`);
                return null;
            }
            throw new Error(`API call failed with status ${response.status}`);
        }

        // 백엔드는 { post: Post } 형태의 객체를 반환합니다.
        const data = await response.json() as { post: Post };

        if (data && data.post) {
            console.log(`Fetched post ${postId} successfully:`, data.post);
            return data.post;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching post with ID ${postId}:`, error);
        return null; // 오류 발생 시 null을 반환합니다.
    }
}
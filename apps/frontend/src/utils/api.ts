// 파일 위치: apps/frontend/src/utils/api.ts (최종 정화 버전)

// [핵심 1차 수정] Amplify Auth 모듈 import 구문을 완전히 제거합니다.
// import { fetchAuthSession } from 'aws-amplify/auth';

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
}

/**
 * 백엔드 API 응답의 타입을 명확하게 정의합니다.
 */
interface ApiResponse {
    posts?: Post[];
    post?: Post;
    message?: string;
}

// API 엔드포인트를 환경 변수에서 읽어오도록 수정하여 유연성을 확보합니다.
// process.env.NEXT_PUBLIC_API_ENDPOINT는 CDK에서 주입해 줄 것입니다.
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || "https://oaghj8029h.execute-api.ap-northeast-2.amazonaws.com";

/**
 * 모든 게시물 목록을 가져오는 함수 (공개 API)
 * 이 함수는 Amplify 의존성이 없으므로 그대로 유지합니다.
 * @returns 게시물 배열 Promise
 */
export async function fetchPosts(): Promise<Post[]> {
    try {
        const response = await fetch(`${API_ENDPOINT}/posts`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}`);
        }

        const data = await response.json() as ApiResponse;

        if (data && 'posts' in data && Array.isArray(data.posts)) {
            console.log('Fetched posts successfully:', data.posts);
            return data.posts;
        }

        console.warn('API response for posts is not in the expected format:', data);
        return [];
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

/**
 * [핵심 2차 수정] Amplify 의존성을 가진 createNewPost 함수 전체를 주석 처리합니다.
 * 이 함수는 빌드 실패의 직접적인 원인이었으므로, 성공적인 배포를 위해 임시 비활성화합니다.
 * TODO: Phase 6에서 Cognito JWT 토큰을 직접 사용하는 방식으로 재구현할 예정입니다.
 */
/*
export async function createNewPost(title: string, content: string): Promise<{ message: string; post: Post }> {
    try {
        const { tokens } = await fetchAuthSession();

        if (!tokens?.accessToken) {
            throw new Error("No access token found. User might not be logged in.");
        }

        const response = await fetch(`${API_ENDPOINT}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokens.accessToken.toString()}`
            },
            body: JSON.stringify({ title, content })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API call failed with status ${response.status}: ${JSON.stringify(errorBody)}`);
        }

        const data = await response.json() as { message: string; post: Post };
        console.log('POST /posts response (using fetch):', data);
        return data;

    } catch (error) {
        console.error('Error creating post with fetch:', error);
        throw error;
    }
}
*/

/**
 * 특정 ID를 가진 단일 게시물을 가져오는 함수 (공개 API)
 * 이 함수는 Amplify 의존성이 없으므로 그대로 유지합니다.
 * @param postId 조회할 게시물의 ID
 * @returns 단일 게시물 객체 또는 null Promise
 */
export async function fetchPostById(postId: string): Promise<Post | null> {
    try {
        const response = await fetch(`${API_ENDPOINT}/posts/${postId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Post with ID ${postId} not found.`);
                return null;
            }
            throw new Error(`API call failed with status ${response.status}`);
        }

        const data = await response.json() as { post: Post };

        if (data && data.post) {
            console.log(`Fetched post ${postId} successfully:`, data.post);
            return data.post;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching post with ID ${postId}:`, error);
        return null;
    }
}
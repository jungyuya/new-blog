// 파일 위치: apps/frontend/src/app/tags/[tagName]/page.tsx
import { api, Post } from "@/utils/api";
import PostCard from "@/components/PostCard";
import { notFound } from "next/navigation";

// 동적 렌더링을 명시합니다.
export const dynamic = 'force-dynamic';

// 페이지 컴포넌트의 props 타입을 정의합니다.
interface TagPageProps {
    params: {
        tagName: string;
    };
}

/**
 * 특정 태그에 속한 모든 게시물 목록을 보여주는 페이지입니다.
 * 서버 컴포넌트로 구현되어, 서버에서 데이터를 미리 가져옵니다.
 */
export default async function TagPage({ params }: TagPageProps) {
    const awaitedParams = await params;
    const tagName = decodeURIComponent(awaitedParams.tagName);

    // [수정] let posts는 여러 번 할당될 수 있으므로 유지합니다.
    let posts: Post[] = [];

    try {
        const response = await api.fetchPostsByTag(tagName);
        posts = response.posts;
    } catch (err) {
        console.error(`Failed to fetch posts for tag ${tagName}:`, err);
        // [수정] error 변수를 제거하고, 에러 발생 시 즉시 notFound()를 호출하여
        // 불필요한 변수 선언 자체를 없애는 것이 더 깔끔합니다.
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* 페이지 상단에 현재 보고 있는 태그를 명확하게 표시합니다. */}
            <div className="mb-8 border-b pb-4">
                <span className="text-gray-500 text-lg">태그:</span>
                <h1 className="text-2xl font-bold text-blue-400 inline ml-2">#{tagName}</h1>
            </div>

            {posts.length > 0 ? (
                // [핵심] 메인 페이지와 동일한 PostCard 그리드 레이아웃을 재사용합니다.
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {posts.map((post) => (
                        <PostCard key={post.postId} post={post} />
                    ))}
                </div>
            ) : (
                <p>이 태그에 해당하는 게시물이 아직 없습니다.</p>
            )}
        </div>
    );
}
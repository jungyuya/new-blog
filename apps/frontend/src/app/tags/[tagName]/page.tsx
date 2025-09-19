// 파일 위치: apps/frontend/src/app/tags/[tagName]/page.tsx
import { api, Post } from "@/utils/api";
import PostCard from "@/components/PostCard";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

// [수정] params의 타입을 Promise로 감싸 Next.js 15 타입 요구사항을 만족시킵니다.
interface TagPageProps {
    params: Promise<{
        tagName: string;
    }>;
}

export default async function TagPage({ params }: TagPageProps) {
    // [수정] Promise로 감싸진 params를 await로 풀어줍니다.
    const { tagName: encodedTagName } = await params;
    const tagName = decodeURIComponent(encodedTagName);

    let posts: Post[] = [];

    try {
        const response = await api.fetchPostsByTag(tagName);
        posts = response.posts;
    } catch (err) {
        console.error(`Failed to fetch posts for tag ${tagName}:`, err);
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* [수정] 태그 페이지에도 다크 모드 스타일을 적용합니다. */}
            <div className="mb-8 border-b pb-4 dark:border-gray-700">
                <span className="text-gray-500 text-lg dark:text-gray-400">태그:</span>
                <h1 className="text-2xl font-bold text-blue-500 inline ml-2 dark:text-blue-400">#{tagName}</h1>
            </div>

            {posts.length > 0 ? (
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {posts.map((post) => (
                        <PostCard key={post.postId} post={post} />
                    ))}
                </div>
            ) : (
                <p className="dark:text-gray-300">이 태그에 해당하는 게시물이 아직 없습니다.</p>
            )}
        </div>
    );
}
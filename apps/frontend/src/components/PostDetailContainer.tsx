import { api } from "@/utils/api";
import { generateToc } from '@/utils/toc';
import PostDetailView from "./PostDetailView";
import { notFound } from 'next/navigation';

export default async function PostDetailContainer({ postId }: { postId: string }) {
    const { post, prevPost, nextPost } = await api.fetchPostById(postId);

    if (!post) {
        notFound();
    }

    const headings = generateToc(post.content || '');

    return (
        <PostDetailView
            post={post}
            prevPost={prevPost}
            nextPost={nextPost}
            postId={postId}
            headings={headings}
        />
    );
}

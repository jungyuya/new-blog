import { api } from "@/utils/api";
import PostList from "./PostList";

interface PostListContainerProps {
    initialCategory?: 'post' | 'learning';
}

export default async function PostListContainer({ initialCategory }: PostListContainerProps) {
    // 서버 사이드 데이터 Fetching
    const initialLatestPostsData = await api.fetchLatestPosts(12, null, initialCategory);

    return (
        <PostList
            fallbackData={initialLatestPostsData}
            initialCategory={initialCategory}
        />
    );
}

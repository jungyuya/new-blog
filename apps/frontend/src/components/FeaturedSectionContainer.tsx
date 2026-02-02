import { api } from "@/utils/api";
import FeaturedSection from "./FeaturedSection";

export default async function FeaturedSectionContainer() {
    // 서버 사이드 데이터 Fetching
    const featuredData = await api.fetchFeaturedPosts();
    const { heroPost, editorPicks } = featuredData;

    return <FeaturedSection heroPost={heroPost} editorPicks={editorPicks} />;
}

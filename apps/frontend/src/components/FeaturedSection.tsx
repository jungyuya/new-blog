// 파일 위치: apps/frontend/src/components/FeaturedSection.tsx
import { Post } from "@/utils/api";
import FeaturedPostCard from "./FeaturedPostCard";
import PostCard from "./PostCard";
import TagFilter from "./TagFilter";

// [수정] 컴포넌트가 받을 props 타입을 새로운 구조에 맞게 변경합니다.
interface FeaturedSectionProps {
  heroPost: Post | null;
  editorPicks: Post[];
}

export default function FeaturedSection({ heroPost, editorPicks }: FeaturedSectionProps) {
  // heroPost나 editorPicks가 모두 없는 경우 아무것도 렌더링하지 않습니다.
  if (!heroPost && editorPicks.length === 0) {
    return null;
  }

  return (
    <div className="mb-16">
      {/* Hero Section: heroPost가 존재할 경우에만 렌더링합니다. */}
      {heroPost && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">Featured Post</h2>
          <FeaturedPostCard post={heroPost} />
        </section>
      )}

      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">Explore Topics</h2>
        <TagFilter />
      </section>

      {/* Editor's Picks: editorPicks 배열에 아이템이 있을 경우에만 렌더링합니다. */}
      {editorPicks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">Editor's Picks</h2>
          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {editorPicks.map(post => (
              <PostCard key={post.postId} post={post} isEditorPick={true} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
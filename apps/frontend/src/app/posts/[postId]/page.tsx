// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx

import { api } from "@/utils/api";
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import type { Metadata, ResolvingMetadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = {
  params: { postId: string }; // Promise를 제거하여 타입을 더 명확하게 합니다.
  searchParams: { [key: string]: string | string[] | undefined };
};

// --- [핵심 수정] generateMetadata 함수 구현 및 Open Graph 태그 추가 ---
export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const { postId } = params;
    const { post } = await api.fetchPostById(postId);

    if (!post) {
      return {
        title: '게시물을 찾을 수 없음',
        description: '요청하신 게시물을 찾을 수 없습니다.',
      };
    }

    // thumbnailUrl이 있으면 사용하고, 없으면 기본 이미지 URL을 사용합니다.
    const imageUrl = post.thumbnailUrl || 'https://blog.jungyu.store/default-thumbnail.webp';

    return {
      title: post.title,
      description: post.summary,
      openGraph: {
        title: post.title,
        description: post.summary,
        url: `https://blog.jungyu.store/posts/${postId}`, // 이 페이지의 공식 URL
        siteName: 'JUNGYU\'s Blog', // 블로그 이름
        images: [
          {
            url: imageUrl,
            width: 1200, // 표준 OG 이미지 너비
            height: 630, // 표준 OG 이미지 높이
            alt: post.title,
          },
        ],
        locale: 'ko_KR',
        type: 'article', // 이 페이지는 '웹사이트'가 아닌 '기사'임을 명시
      },
      // (선택) 트위터용 카드 설정
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: post.summary,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error(`Failed to generate metadata for post ${params.postId}:`, error);
    return {
      title: '서버 에러',
      description: '메타데이터를 생성하는 중 오류가 발생했습니다.',
    };
  }
}

export default async function PostDetailPage({ params }: Props) {
  const { postId } = params;

  try {
    const { post, prevPost, nextPost } = await api.fetchPostById(postId);
    if (!post) {
      notFound();
    }

    return (
      <div className="max-w-4xl mx-auto px-0 py-6 sm:px-6 lg:px-8 sm:py-8">
        <PostDetailView post={post} prevPost={prevPost} nextPost={nextPost} postId={postId} />
      </div>
    );
  } catch (error) {
    console.error(`Failed to fetch post ${postId}:`, error);
    notFound();
  }
}
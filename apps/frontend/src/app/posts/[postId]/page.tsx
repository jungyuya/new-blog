// 파일 위치: apps/frontend/src/app/posts/[postId]/page.tsx

import { api } from "@/utils/api";
import { generateToc } from '@/utils/toc'; // [신규] generateToc 유틸리티 import
import PostDetailView from "@/components/PostDetailView";
import { notFound } from 'next/navigation';
import type { Metadata, ResolvingMetadata } from 'next';

export const dynamic = 'force-dynamic';

// [핵심 수정 1] Props 타입을 원본의 Promise<...> 형태로 되돌립니다.
type Props = {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    // [핵심 수정 2] params를 await하여 postId를 추출합니다.
    const { postId } = await params;
    const { post } = await api.fetchPostById(postId);

    if (!post) {
      return {
        title: '게시물을 찾을 수 없음',
        description: '요청하신 게시물을 찾을 수 없습니다.',
      };
    }

    const imageUrl = post.thumbnailUrl || 'https://blog.jungyu.store/default-thumbnail.webp';

    return {
      title: post.title,
      description: post.summary,
      openGraph: {
        title: post.title,
        description: post.summary,
        url: `https://blog.jungyu.store/posts/${postId}`,
        siteName: 'JUNGYU\'s Blog',
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
        locale: 'ko_KR',
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: post.summary,
        images: [imageUrl],
      },
    };
  } catch (error) {
    // params가 Promise이므로, 에러 발생 시 postId를 얻기 위해 await 해야 합니다.
    const awaitedParams = await params;
    console.error(`Failed to generate metadata for post ${awaitedParams.postId}:`, error);
    return {
      title: '서버 에러',
      description: '메타데이터를 생성하는 중 오류가 발생했습니다.',
    };
  }
}

// [SSR with Suspense] PostDetailContainer가 데이터를 가져옵니다. (실제 Streaming 아님)
import PostDetailContainer from "@/components/PostDetailContainer";
import DebouncedSkeleton from "@/components/DebouncedSkeleton";
import PostDetailSkeleton from "@/components/PostDetailSkeleton";
import { Suspense } from 'react';

export default async function PostDetailPage({ params }: Props) {
  // params를 await하여 postId 추출
  const { postId } = await params;

  return (
    <div className="sm:px-6 lg:px-8 py-8">
      <Suspense
        fallback={
          <DebouncedSkeleton>
            <PostDetailSkeleton />
          </DebouncedSkeleton>
        }
      >
        <PostDetailContainer postId={postId} />
      </Suspense>
    </div>
  );
}
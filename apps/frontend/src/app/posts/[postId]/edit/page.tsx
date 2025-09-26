// 파일 위치: apps/frontend/src/app/posts/[postId]/edit/page.tsx (v1.2 - ESLint 해결 및 로직 개선 최종본)
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type Post } from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import PostMetadataEditor, { type PostMetadata } from '@/components/PostMetadataEditor';

// Editor 컴포넌트를 동적으로 import 합니다.
const Editor = dynamic(() => import('@/components/Editor'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-200 animate-pulse rounded-md"></div>,
});

// 실제 폼 로직을 담고 있는 컴포넌트
function EditPostForm() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const isAdmin = user?.groups?.includes('Admins');

  const postId = typeof params.postId === 'string' ? params.postId : undefined;

  // --- [수정] post 전체 데이터를 상태로 관리 ---
  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<Partial<PostMetadata>>({}); // 초기값은 비어있도록 변경

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- [신규] 음성 API 호출 상태 관리 ---
  const [isSpeechProcessing, setIsSpeechProcessing] = useState(false);

  const handleMetadataChange = useCallback((newMetadata: Pick<PostMetadata, 'tags' | 'status' | 'visibility'>) => {
    setMetadata(prev => ({ ...prev, ...newMetadata }));
  }, []);

  const fetchPost = useCallback(async () => {
    if (!postId) {
      setIsLoading(false);
      setError('유효하지 않은 게시물 ID입니다.');
      return;
    }
    // 데이터를 다시 불러올 때 로딩 상태를 표시
    setIsLoading(true);
    try {
      const { post: fetchedPost } = await api.fetchPostById(postId);

      if (user && fetchedPost.authorId !== user.id) {
        alert('이 게시물을 수정할 권한이 없습니다.');
        router.replace(`/posts/${postId}`);
        return;
      }

      // [수정] 불러온 post 전체를 상태에 저장
      setPost(fetchedPost);
      setTitle(fetchedPost.title);
      setContent(fetchedPost.content ?? '');
      setMetadata({
        tags: fetchedPost.tags || [],
        status: fetchedPost.status || 'published',
        visibility: fetchedPost.visibility || 'public',
      });

    } catch (err) {
      console.error('게시물 로딩 실패:', err);
      setError('게시물을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [postId, user, router]);

  useEffect(() => {
    if (user) {
      fetchPost();
    }
  }, [user, fetchPost]);

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) {
      setError('게시물 ID가 없어 수정을 진행할 수 없습니다.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // [수정] 수정된 메타데이터도 함께 전송합니다.
      await api.updatePost(postId!, {
        title,
        content,
        tags: metadata.tags,
        status: metadata.status,
        visibility: metadata.visibility,
      });
      alert('게시물이 성공적으로 수정되었습니다.');
      router.push(`/posts/${postId!}`);
    } catch (err) {
      // [해결] err 변수를 console.error에서 사용하여 'no-unused-vars' 규칙을 만족시킵니다.
      console.error('게시물 수정 실패:', err);
      setError('게시물 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 음성 생성 핸들러 ---
  const handleGenerateSpeech = async () => {
    if (!postId) return;
    setIsSpeechProcessing(true);
    try {
      await api.generateSpeech(postId);
      alert('음성 생성 작업이 시작되었습니다. 잠시 후 상태가 업데이트됩니다.');
      // 잠시 후 데이터를 다시 불러와 상태를 갱신 (PENDING 상태 확인)
      setTimeout(() => fetchPost(), 3000);
    } catch (error) {
      console.error('Failed to generate speech:', error);
      alert('음성 생성 시작에 실패했습니다.');
    } finally {
      // API 호출이 끝나면 즉시 false로 설정 (실제 작업은 비동기)
      setIsSpeechProcessing(false);
    }
  };

  // --- 음성 삭제 핸들러 ---
  const handleDeleteSpeech = async () => {
    if (!postId) return;
    if (!window.confirm('정말로 생성된 음성 파일을 삭제하시겠습니까?')) return;

    setIsSpeechProcessing(true);
    try {
      await api.deleteSpeech(postId);
      alert('음성 파일이 삭제되었습니다.');
      // 데이터를 즉시 다시 불러와 상태를 갱신
      fetchPost();
    } catch (error) {
      console.error('Failed to delete speech:', error);
      alert('음성 파일 삭제에 실패했습니다.');
    } finally {
      setIsSpeechProcessing(false);
    }
  };

  // Hero로 지정하는 핸들러 함수
  const handleSetAsHero = async () => {
    if (!postId) {
      alert('게시물 ID가 유효하지 않습니다.');
      return;
    }
    if (window.confirm('정말로 이 게시물을 대표(Hero) 게시물로 지정하시겠습니까? 기존 Hero 게시물은 대체됩니다.')) {
      try {
        await api.updateHeroPost(postId);
        alert('대표 게시물로 지정되었습니다!');
      } catch (err) {
        console.error('Failed to set hero post:', err);
        alert('대표 게시물 지정에 실패했습니다.');
      }
    }
  };


  if (isLoading) {
    return <div>게시물 정보를 불러오는 중...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center p-8">{error}</div>;
  }

  if (isLoading) {
    // [수정] 로딩 메시지에 다크 모드 색상 적용
    return <div className="text-center p-8 dark:text-gray-300">게시물 정보를 불러오는 중...</div>;
  }

  if (error) {
    // [수정] 에러 메시지에 다크 모드 색상 적용
    return <div className="text-red-500 text-center p-8 dark:text-red-400">{error}</div>;
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 dark:text-gray-100">글 수정하기</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <label htmlFor="title" className="sr-only">제목</label>
          {/* [수정] 제목 입력창에 다크 모드 스타일 적용 */}
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-4xl font-bold p-3 border-b-2 border-gray-200 focus:outline-none focus:border-indigo-500 transition-colors bg-transparent dark:text-gray-100 dark:border-gray-700 dark:focus:border-indigo-500"
            required
          />
        </div>

        <div className="mb-8">
          <label htmlFor="content" className="sr-only">내용</label>
          {!isLoading && (
            <Editor
              initialValue={content}
              onChange={(value) => setContent(value)}
            />
          )}
        </div>

        <div className="mb-8">
          <PostMetadataEditor
            // [수정] post 객체에서 필요한 모든 데이터를 initialData로 전달
            initialData={{
              postId: post?.postId,
              tags: post?.tags || [],
              status: post?.status || 'published',
              visibility: post?.visibility || 'public',
              speechUrl: post?.speechUrl,
              speechStatus: post?.speechStatus,
            }}
            onMetadataChange={handleMetadataChange}
            // [신규] 핸들러와 상태 전달
            onGenerateSpeech={handleGenerateSpeech}
            onDeleteSpeech={handleDeleteSpeech}
            isSpeechProcessing={isSpeechProcessing}
          />
        </div>

        {/* [수정] 에러 메시지에 다크 모드 색상 적용 */}
        {error && <p className="text-red-500 text-center mb-4 dark:text-red-400">{error}</p>}

        {/* [수정] 하단 고정 푸터 영역 */}
        <footer className="sticky bottom-0 left-0 w-full bg-white/80 backdrop-blur-sm p-4 mt-8 border-t border-gray-200 dark:bg-stone-950/80 dark:border-gray-800">
          {/* [수정] flex 컨테이너에 justify-between 추가 */}
          <div className="container mx-auto flex justify-between items-center max-w-4xl px-4">
            {/* 왼쪽: 관리자 전용 버튼 */}
            <div>
              {isAdmin && (
                <button
                  type="button" // form의 submit을 방지하기 위해 type="button"을 명시
                  onClick={handleSetAsHero}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-green-700"
                >
                  🌟 Hero로 지정하기
                </button>
              )}
            </div>

            {/* 오른쪽: 기존 수정 완료 버튼 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-yellow-500 text-white font-semibold rounded-md shadow-sm hover:bg-yellow-600 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {isSubmitting ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}

// 페이지 진입점 컴포넌트
export default function EditPostPage() {
  return (
    <ProtectedRoute>
      <EditPostForm />
    </ProtectedRoute>
  );
}
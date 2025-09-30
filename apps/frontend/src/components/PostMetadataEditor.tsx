// 파일 위치: apps/frontend/src/components/PostMetadataEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

const PlayIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>);
const PauseIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 001-1V8a1 1 0 00-1-1H8zm4 0a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 001-1V8a1 1 0 00-1-1h-1z" /></svg>);
const SpinnerIcon = () => (<div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>);

// 이 컴포넌트가 받을 props 타입을 정의합니다.
export interface PostMetadata {
  tags: string[];
  status: 'published' | 'draft';
  visibility: 'public' | 'private';
  // 음성 관련 속성 추가
  postId?: string;
  speechUrl?: string | null;
  speechStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | null;
  showToc?: boolean;
}

interface PostMetadataEditorProps {
  initialData: Partial<PostMetadata>;
  onMetadataChange: (metadata: PostMetadata) => void;
  // 음성 제어 핸들러 추가
  onGenerateSpeech: () => void;
  onDeleteSpeech: () => void;
  isSpeechProcessing: boolean; // 부모의 API 호출 상태를 전달받음
}

export default function PostMetadataEditor({
  initialData,
  onMetadataChange,
  onGenerateSpeech,
  onDeleteSpeech,
  isSpeechProcessing,
}: PostMetadataEditorProps) {
  const [tags, setTags] = useState<string[]>(initialData.tags || []);
  const [currentTag, setCurrentTag] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>(initialData.status || 'published');
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialData.visibility || 'public');
  const [showToc, setShowToc] = useState<boolean>(initialData.showToc ?? true);


  // --- [신규] 미니 오디오 플레이어 상태 ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    onMetadataChange({
      tags, status, visibility, showToc, postId: initialData.postId, speechUrl: initialData.speechUrl, speechStatus: initialData.speechStatus
    });
  }, [tags, status, visibility, showToc, onMetadataChange, initialData.postId, initialData.speechUrl, initialData.speechStatus]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = currentTag.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  // --- [신규] 음성 설정 UI를 렌더링하는 함수 ---
  const renderSpeechSection = () => {
    // Case A: 생성 불가 (새 글)
    if (!initialData.postId) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">글을 먼저 저장한 후 음성을 생성할 수 있습니다.</p>;
    }

    // Case C: 생성 중
    if (initialData.speechStatus === 'PENDING' || isSpeechProcessing) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <SpinnerIcon />
          <span>음성 파일을 생성 중입니다...</span>
        </div>
      );
    }

    // Case D: 생성 완료
    if (initialData.speechStatus === 'COMPLETED' && initialData.speechUrl) {
      return (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600">
            <button type="button" onClick={handlePlayPause}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className="text-xs font-mono">미리듣기</span>
            <audio ref={audioRef} src={initialData.speechUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
          </div>
          <button
            type="button"
            onClick={onDeleteSpeech}
            className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-100 rounded-md hover:bg-red-200 dark:text-red-400 dark:bg-red-900/50 dark:hover:bg-red-900"
          >
            음성 삭제하기
          </button>
        </div>
      );
    }

    // Case B: 생성 가능 (기본 상태 또는 실패)
    return (
      <div>
        {initialData.speechStatus === 'FAILED' && (
          <p className="text-sm text-red-500 dark:text-red-400 mb-2">음성 생성에 실패했습니다. 다시 시도해주세요.</p>
        )}
        <button
          type="button"
          onClick={onGenerateSpeech}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          음성 생성하기
        </button>
      </div>
    );
  };


  return (
    // [수정] 1. 카드 컨테이너에 다크 모드 스타일 적용
    <div className="p-6 border rounded-lg shadow-sm bg-gray-50 dark:bg-stone-800 dark:border-gray-700">
      {/* [수정] 2. 텍스트 요소들에 다크 모드 색상 적용 */}
      <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">게시물 설정</h2>

      <div className="mb-6">
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">태그</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            // [수정] 3. 입력된 태그에 다크 모드 스타일 적용
            <span key={tag} className="flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900/50 dark:text-blue-300">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200">&times;</button>
            </span>
          ))}
        </div>
        {/* [수정] 4. 태그 입력창에 다크 모드 스타일 적용 */}
        <input
          id="tags"
          type="text"
          value={currentTag}
          onChange={(e) => setCurrentTag(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder="태그를 입력하고 Enter를 누르세요"
          className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">공개 설정</label>
        <div className="flex gap-4">
          {/* [수정] 5. 라디오 버튼 텍스트에 다크 모드 색상 적용 */}
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500" />
            <span className="ml-2">공개글</span>
          </label>
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500" />
            <span className="ml-2">비밀글</span>
          </label>
        </div>
      </div>

      {/* --- [수정] '발행 상태' 섹션 바로 위에 새로운 섹션 추가 --- */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">목차 설정</label>
        <label htmlFor="show-toc-toggle" className="flex items-center cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              id="show-toc-toggle"
              className="sr-only"
              checked={showToc}
              onChange={() => setShowToc(!showToc)}
            />
            <div className="block bg-gray-200 w-14 h-8 rounded-full dark:bg-gray-600"></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${showToc ? 'translate-x-6 bg-indigo-500' : ''}`}></div>
          </div>
          <div className="ml-3 text-gray-700 font-medium dark:text-gray-300">
            목차 표시하기
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">발행 상태</label>
        <div className="flex gap-4">
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="status" value="published" checked={status === 'published'} onChange={() => setStatus('published')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500" />
            <span className="ml-2">발행</span>
          </label>
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="status" value="draft" checked={status === 'draft'} onChange={() => setStatus('draft')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500" />
            <span className="ml-2">임시저장</span>
          </label>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">음성 설정 (AI Polly)</label>
          {renderSpeechSection()}
        </div>
      </div>
    </div>
  );
}
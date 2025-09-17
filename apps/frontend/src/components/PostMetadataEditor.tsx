// 파일 위치: apps/frontend/src/components/PostMetadataEditor.tsx
'use client';

import { useState, useEffect } from 'react';

// 이 컴포넌트가 받을 props 타입을 정의합니다.
export interface PostMetadata {
  tags: string[];
  status: 'published' | 'draft';
  visibility: 'public' | 'private';
}

interface PostMetadataEditorProps {
  initialData: Partial<PostMetadata>; // 초기 데이터 (수정 시 사용)
  onMetadataChange: (metadata: PostMetadata) => void; // 변경 사항을 부모에게 알림
}

export default function PostMetadataEditor({ initialData, onMetadataChange }: PostMetadataEditorProps) {
  const [tags, setTags] = useState<string[]>(initialData.tags || []);
  const [currentTag, setCurrentTag] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>(initialData.status || 'published');
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialData.visibility || 'public');

  useEffect(() => {
    onMetadataChange({ tags, status, visibility });
  }, [tags, status, visibility, onMetadataChange]);

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
            <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"/>
            <span className="ml-2">공개글</span>
          </label>
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"/>
            <span className="ml-2">비밀글</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">발행 상태</label>
        <div className="flex gap-4">
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="status" value="published" checked={status === 'published'} onChange={() => setStatus('published')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"/>
            <span className="ml-2">발행</span>
          </label>
          <label className="flex items-center dark:text-gray-300">
            <input type="radio" name="status" value="draft" checked={status === 'draft'} onChange={() => setStatus('draft')} className="form-radio text-indigo-600 bg-gray-200 border-gray-300 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"/>
            <span className="ml-2">임시저장</span>
          </label>
        </div>
      </div>
    </div>
  );
}
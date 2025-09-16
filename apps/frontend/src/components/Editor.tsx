// 파일 위치: apps/frontend/src/components/Editor.tsx
'use client';

import { Editor as TuiEditor, EditorProps } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css'; // [추가] 1. 다크 테마 CSS import
import { useRef, useLayoutEffect } from 'react'; // [수정] 2. useLayoutEffect import
import { api } from '@/utils/api';
import { useTheme } from 'next-themes'; // [추가] 3. useTheme 훅 import

interface EditorPropsWithHandlers extends EditorProps {
  onChange: (value: string) => void;
  initialValue?: string;
}

export default function Editor({ onChange, initialValue = '' }: EditorPropsWithHandlers) {
  const editorRef = useRef<TuiEditor>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // [추가] 4. wrapper를 위한 ref 생성
  const { theme } = useTheme(); // [추가] 5. 현재 테마 상태 가져오기

  // [추가] 6. 테마 변경 시 DOM에 직접 클래스를 주입/제거하는 로직
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Toast UI Editor의 컨테이너 요소를 찾습니다.
    const tuiEl = wrapper.querySelector<HTMLElement>('.toastui-editor-defaultUI');

    if (tuiEl) {
      if (theme === 'dark') {
        tuiEl.classList.add('toastui-editor-dark');
      } else {
        tuiEl.classList.remove('toastui-editor-dark');
      }
    }
  }, [theme]);

  const handleContentChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.getInstance().getMarkdown();
      onChange(content);
    }
  };

  const onUploadImage = async (blob: File | Blob, callback: (url: string, altText: string) => void) => {
    // ... (기존 이미지 업로드 로직은 변경 없음)
    console.log('Uploading image...', blob);
    try {
      const fileName = blob instanceof File ? blob.name : 'image.png';
      const { presignedUrl, publicUrl } = await api.getPresignedUrl(fileName);

      console.log('Got presigned URL:', presignedUrl);
      console.log('Public URL will be:', publicUrl);

      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload image to S3.');
      }

      console.log('Image upload successful!');
      callback(publicUrl, 'alt text');

      handleContentChange();

    } catch (error) {
      console.error('Image upload failed:', error);
      alert('이미지 업로드에 실패했습니다.');
    }
  };

  return (
    // [수정] 7. TuiEditor를 div로 감싸고 wrapperRef를 연결합니다.
    <div ref={wrapperRef}>
      <TuiEditor
        ref={editorRef}
        initialValue={initialValue}
        previewStyle="vertical"
        height="600px"
        initialEditType="markdown"
        useCommandShortcut={true}
        language="ko-KR"
        onChange={handleContentChange}
        hooks={{
          addImageBlobHook: onUploadImage,
        }}
        // [추가] 8. 초기 렌더링 시 깜빡임 방지를 위해 theme prop 전달
        theme={theme === 'dark' ? 'dark' : 'default'}
      />
    </div>
  );
}
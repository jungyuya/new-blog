// 파일 위치: apps/frontend/src/components/Editor.tsx (v1.1 - 타입 오류 해결 최종본)
'use client';

import { Editor as TuiEditor, EditorProps } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { useRef } from 'react';
import { api } from '@/utils/api';

// Editor 컴포넌트가 받을 props 타입을 정의합니다.
interface EditorPropsWithHandlers extends EditorProps {
  onChange: (value: string) => void;
  initialValue?: string;
}

export default function Editor({ onChange, initialValue = '' }: EditorPropsWithHandlers) {
  // [수정] ref의 타입을 TuiEditor로 명확히 지정합니다.
  const editorRef = useRef<TuiEditor>(null);

  const handleContentChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.getInstance().getMarkdown();
      onChange(content);
    }
  };

  const onUploadImage = async (blob: File | Blob, callback: (url: string, altText: string) => void) => {
    console.log('Uploading image...', blob);
    try {
      const fileName = blob instanceof File ? blob.name : 'image.png';
      // [수정] 이제 api.getPresignedUrl이 존재하므로 오류가 발생하지 않습니다.
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
    <div>
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
      />
    </div>
  );
}
// 파일 위치: apps/frontend/src/components/Editor.tsx
'use client';

import { Editor as TuiEditor, EditorProps } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { useRef } from 'react';

// Editor 컴포넌트가 받을 props 타입을 정의합니다.
interface EditorPropsWithHandlers extends EditorProps {
  onChange: (value: string) => void;
  initialValue?: string;
}

export default function Editor({ onChange, initialValue = '' }: EditorPropsWithHandlers) {
  // Editor 인스턴스를 저장하기 위한 ref
  const editorRef = useRef<TuiEditor>(null);

  // 내용이 변경될 때마다 호출될 함수
  const handleContentChange = () => {
    if (editorRef.current) {
      // 에디터의 현재 내용을 Markdown 문자열로 가져옵니다.
      const content = editorRef.current.getInstance().getMarkdown();
      // 부모 컴포넌트로 변경된 내용을 전달합니다.
      onChange(content);
    }
  };

  return (
    <div>
      <TuiEditor
        ref={editorRef}
        initialValue={initialValue}
        previewStyle="vertical" // 미리보기 스타일 (탭 또는 수직 분할)
        height="600px"
        initialEditType="markdown" // 초기 편집 타입 (마크다운 또는 위지윅)
        useCommandShortcut={true}
        language="ko-KR" // 언어 설정
        // 내용이 변경될 때마다 handleContentChange 함수를 호출
        onChange={handleContentChange} 
      />
    </div>
  );
}
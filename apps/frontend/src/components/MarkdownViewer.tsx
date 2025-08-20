// 파일 위치: apps/frontend/src/components/MarkdownViewer.tsx (v1.1 - 타입 오류 해결 최종본)
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ComponentProps } from 'react';
import '@toast-ui/editor/dist/toastui-editor-viewer.css';


interface MarkdownViewerProps {
    content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
    return (
        // [해결] className을 적용하기 위해 div로 한번 감싸줍니다.
        <div className="toastui-editor-contents">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    // [해결] code 컴포넌트의 props 타입을 명시적으로 지정하고, 로직을 수정합니다.
                    code(props: ComponentProps<'code'>) {
                        const { children, className, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || '');

                        return match ? (
                            <SyntaxHighlighter
                                // [해결] style prop의 타입 불일치 문제를 해결하기 위해 any 타입으로 단언합니다.
                                style={materialDark as any}
                                language={match[1]}
                                PreTag="div"
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
                            <code {...rest} className={className}>
                                {children}
                            </code>
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
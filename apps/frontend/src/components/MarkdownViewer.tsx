// 파일 위치: apps/frontend/src/components/MarkdownViewer.tsx
'use client';

import { useState, useEffect, ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CSSProperties } from 'react';
import { useTheme } from 'next-themes';

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "yet-another-react-lightbox/styles.css";
import '@toast-ui/editor/dist/toastui-editor-viewer.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css';

interface MarkdownViewerProps {
    content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
    const [index, setIndex] = useState(-1);
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const imageSources = content.match(/!\[.*?\]\((.*?)\)/g)?.map(imgTag => {
        const url = imgTag.match(/\((.*?)\)/)?.[1];
        return { src: url || '' };
    }) || [];

    return (
        // [수정] 부모(PostContent)가 테마 클래스를 관리하므로, 여기서는 기본 클래스만 유지합니다.
        <div className="toastui-editor-contents">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    code(props: ComponentProps<'code'>) {
                        const { children, className, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                            <div className={theme === 'dark' && mounted ? 'bg-gray-900/50 rounded-lg border border-gray-700 p-1' : ''}>
                                <SyntaxHighlighter
                                    style={materialDark as { [key: string]: CSSProperties }}
                                    customStyle={{
                                        border: 'none',
                                    }}
                                    language={match[1]}
                                    PreTag="div"
                                >
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            </div>
                        ) : (
                            <code {...rest} className={className}>
                                {children}
                            </code>
                        );
                    },
                    img: ({ ...props }) => { 
                        const imageIndex = imageSources.findIndex(slide => slide.src === props.src);
                        return (
                            <img
                                {...props}
                                onClick={() => setIndex(imageIndex)}
                                className="cursor-pointer"
                                alt={props.alt || '블로그 이미지'}
                            />
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
            <Lightbox
                open={index >= 0}
                index={index}
                close={() => setIndex(-1)}
                slides={imageSources}
                controller={{ closeOnBackdropClick: true }}
                plugins={[Zoom]}
            />
        </div>
    );
}
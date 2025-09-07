// 파일 위치: apps/frontend/src/components/MarkdownViewer.tsx (v2.2 - API v3 호환 최종본)
'use client';

import { useState, ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CSSProperties } from 'react';

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom"; // [핵심] Zoom 플러그인의 정확한 import 경로

// [수정] 각 모듈에 대한 스타일을 명시적으로 import 합니다.
import "yet-another-react-lightbox/styles.css";
import '@toast-ui/editor/dist/toastui-editor-viewer.css';

interface MarkdownViewerProps {
    content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
    // [추가] Lightbox의 상태를 관리하기 위한 state 변수들을 선언합니다.
    const [index, setIndex] = useState(-1);

    // [추가] 마크다운 본문에서 이미지 URL들만 추출하여 Lightbox 슬라이드 목록을 생성합니다.
    const imageSources = content.match(/!\[.*?\]\((.*?)\)/g)?.map(imgTag => {
        const url = imgTag.match(/\((.*?)\)/)?.[1];
        return { src: url || '' };
    }) || [];

    return (
        // [유지] 기존의 스타일링 wrapper div는 그대로 유지합니다.
        <div className="toastui-editor-contents">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    // --- [유지] code 컴포넌트 로직은 변경 없이 그대로 사용합니다. ---
                    code(props: ComponentProps<'code'>) {
                        const { children, className, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                            <SyntaxHighlighter
                                style={materialDark as { [key: string]: CSSProperties }}
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

                    // --- [핵심 추가] img 컴포넌트를 오버라이드하여 클릭 이벤트를 추가합니다. ---
                    img: ({ ...props }) => { 
                        const imageIndex = imageSources.findIndex(slide => slide.src === props.src);
                        return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                {...props}
                                onClick={() => setIndex(imageIndex)}
                                className="cursor-pointer" // 클릭 가능하다는 시각적 힌트
                                alt={props.alt || '블로그 이미지'}
                            />
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>

            {/* [추가] Lightbox 컴포넌트. open prop을 통해 열고 닫기를 제어합니다. */}
            <Lightbox
                // --- 기본 props ---
                open={index >= 0}
                index={index}
                close={() => setIndex(-1)}
                slides={imageSources}

                // --- [핵심 수정] UX 개선 props (API v3+ 방식) ---

                // 1. controller prop을 사용하여 상세 동작을 제어합니다.
                controller={{ closeOnBackdropClick: true }}

                // 2. 사용할 플러그인 목록을 전달합니다.
                plugins={[Zoom]}
            />
        </div>
    );
}
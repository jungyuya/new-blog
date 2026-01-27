// 파일 위치: apps/frontend/src/components/MarkdownViewer.tsx
'use client';

import { useState, useEffect, ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';

// 스타일 테마 import
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CSSProperties } from 'react';
import { useTheme } from 'next-themes';
import CodeBlock from './CodeBlock'; // [신규] CodeBlock 컴포넌트 import

// 목차 import
import TableOfContents from './TableOfContents'; // [신규] TableOfContents 컴포넌트 import
import type { Heading } from '@/utils/toc'; // [신규] Heading 타입 import

// 코드하이라이팅 필요한 언어 파서들만 개별적으로 import 합니다.
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup'; // HTML은 'markup'으로 import
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "yet-another-react-lightbox/styles.css";
import '@toast-ui/editor/dist/toastui-editor-viewer.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css';

// [추가] 3. import한 언어들을 SyntaxHighlighter에 등록합니다.
// 이 코드는 컴포넌트 바깥에서 한 번만 실행됩니다.
SyntaxHighlighter.registerLanguage('ts', ts);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('js', js);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('docker', docker);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('rust', rust);

// 코드하이라이터 영역 끝

interface MarkdownViewerProps {
    content: string;
    headings: Heading[];
}

export default function MarkdownViewer({ content, headings }: MarkdownViewerProps) {
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
                rehypePlugins={[
                    rehypeRaw,
                    rehypeSlug,
                    [
                        rehypeAutolinkHeadings,
                        {
                            behavior: 'append', // 'wrap' 대신 'append' 또는 'prepend'를 사용
                            content: () => (<span></span>) // 아이콘을 숨기기 위해 빈 span을 렌더링
                        }
                    ]
                ]}
                components={{
                    p: (props) => {
                        const { node } = props;
                        if (node && node.children[0] && 'value' in node.children[0] && (node.children[0].value === '[toc]' || node.children[0].value === '[목차]')) {
                            // --- [핵심 수정] 감싸는 div와 h2 제목을 제거합니다. ---
                            // 기존: <div className="..."><h2 ...>목차</h2><TableOfContents ... /></div>
                            return <TableOfContents headings={headings} activeId="" />;
                        }
                        return <p>{props.children}</p>;
                    },
                    code(props: ComponentProps<'code'>) {
                        const { children, className, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || '');
                        // inline prop이 react-markdown 최신 버전에서 제대로 전달되지 않을 수 있으므로
                        // match 여부나 node 속성을 확인할 수 있지만, 여기서는 match 유무와 상위 로직에 의존
                        const isInline = !match;

                        return (
                            <CodeBlock
                                className={className}
                                inline={isInline}
                                {...rest}
                            >
                                {children}
                            </CodeBlock>
                        );
                    },
                    img: ({ ...props }) => {
                        const imageIndex = imageSources.findIndex(slide => slide.src === props.src);
                        return (
                            // eslint-disable-next-line @next/next/no-img-element
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
'use client';

import { useState, useEffect, ComponentProps } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useTheme } from 'next-themes';
import { catppuccinMocha, catppuccinLatte } from '../styles/code-themes';
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';

// 언어 파서 등록은 MarkdownViewer에서 이미 되어있으므로 여기선 생략하거나 prop으로 받을 수 있지만, 
// SyntaxHighlighter가 singleton처럼 동작하므로 이미 등록된 언어는 사용 가능합니다.
// 하지만 안전을 위해 필요한 경우 여기서도 import 할 수 있습니다. 
// (지금은 MarkdownViewer가 상위에서 로드하므로 생략)

interface CodeBlockProps extends ComponentProps<'code'> {
    inline?: boolean;
    className?: string;
    children: React.ReactNode;
}

export default function CodeBlock({ inline, className, children, ...props }: CodeBlockProps) {
    const { theme } = useTheme();
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    // 언어 추출 (예: "language-typescript")
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    // 인라인 코드인 경우
    if (inline || !match) {
        return (
            <code className={className} {...props}>
                {children}
            </code>
        );
    }

    const codeString = String(children).replace(/\n$/, '');
    const lineCount = codeString.split('\n').length;

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 테마 설정 (시스템 테마 고려는 제외하고 단순 dark/light 처리)
    // hydration mismatch 방지를 위해 mounted 전에는 기본 테마(예: light)를 사용하거나
    // 서버와 클라이언트가 동일하게 렌더링되도록 해야 합니다.
    // 여기서는 mounted 전에는 'light' (catppuccinLatte)를 강제합니다.
    const effectiveTheme = mounted ? theme : 'light';
    const style = effectiveTheme === 'dark' ? catppuccinMocha : catppuccinLatte;

    const [showToast, setShowToast] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // 접기/펴기 클릭 이벤트 전파 방지
        try {
            await navigator.clipboard.writeText(codeString);
            setCopied(true);
            setShowToast(true);
            setTimeout(() => setCopied(false), 2000);
            setTimeout(() => setShowToast(false), 2500);
        } catch (err) {
            console.error('Failed to copy code', err);
        }
    };

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <>
            <div className="font-mono my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-[#eff1f5] dark:bg-[#1e1e2e]">
                {/* Header */}
                <div
                    className="flex justify-between items-center px-4 py-2 bg-[#e6e9ef] dark:bg-[#181825] border-b border-gray-200 dark:border-gray-700 cursor-pointer select-none"
                    onClick={toggleExpand}
                    title={isExpanded ? "접기" : "펼치기"}
                >
                    {/* Left: Language Label & Expand Icon */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 transition-transform duration-200">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            {language || 'text'}
                        </span>
                    </div>

                    {/* Right: Copy Button */}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs text-gray-600 dark:text-gray-400"
                        aria-label="Copy code"
                    >
                        {copied ? (
                            <>
                                <Check size={14} className="text-green-500" />
                                <span className="text-green-600 dark:text-green-400">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={14} />
                                <span>Copy</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Code Body */}
                {isExpanded && (
                    <div className="relative animate-in slide-in-from-top-2 duration-200">
                        <SyntaxHighlighter
                            style={style as any}
                            language={language}
                            PreTag="div"
                            showLineNumbers={lineCount > 3} // 3줄 초과 시 라인 넘버 표시
                            lineNumberStyle={{
                                minWidth: '2.5em',
                                paddingRight: '1em',
                                textAlign: 'right',
                                color: effectiveTheme === 'dark' ? '#6c7086' : '#9ca0b0'
                            }}
                            customStyle={{
                                margin: 0,
                                padding: '1.5rem', // 넉넉한 패딩
                                background: 'transparent', // 배경색은 부모 div가 담당
                                fontSize: '0.9rem',
                                lineHeight: '1.6',
                            }}
                        >
                            {codeString}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>

            {/* [A-4] Toast 알림 - 화면 하단 고정 */}
            {
                showToast && (
                    <div
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 
                           px-4 py-2 rounded-lg shadow-lg
                           bg-green-600 text-white text-sm font-medium
                           animate-in slide-in-from-bottom-4 duration-300"
                    >
                        <div className="flex items-center gap-2">
                            <Check size={16} />
                            <span>코드가 복사되었습니다!</span>
                        </div>
                    </div>
                )
            }
        </>
    );
}

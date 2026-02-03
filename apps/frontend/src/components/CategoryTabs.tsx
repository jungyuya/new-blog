// 파일 위치: apps/frontend/src/components/CategoryTabs.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Category = 'all' | 'post' | 'learning';

const CATEGORIES: { id: Category; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'post', label: '회고록' },
    { id: 'learning', label: '학습 노트' },
];

export default function CategoryTabs() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL 쿼리 파라미터에서 현재 카테고리 파악 (없으면 'all')
    const currentCategory = (searchParams.get('category') as Category) || 'all';

    const handleSelect = (category: Category) => {
        // 스크롤 위치 유지를 위해 shallow routing 사용
        const newUrl = category === 'all' ? '/' : `/?category=${category}`;

        // URL만 변경하고 스크롤 유지 (SPA처럼 동작)
        window.history.replaceState(
            { ...window.history.state, as: newUrl, url: newUrl },
            '',
            newUrl
        );

        // Next.js router와 동기화 (컴포넌트 리렌더링 트리거)
        router.replace(newUrl, { scroll: false });
    };

    return (
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {CATEGORIES.map((category) => (
                <button
                    key={category.id}
                    onClick={() => handleSelect(category.id)}
                    className={`
                        relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
                        ${currentCategory === category.id
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }
                    `}
                    aria-pressed={currentCategory === category.id}
                >
                    {category.label}
                    {/* 활성 탭 언더라인 애니메이션 */}
                    {currentCategory === category.id && (
                        <span
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full"
                            style={{
                                animation: 'slideIn 0.2s ease-out forwards',
                            }}
                        />
                    )}
                </button>
            ))}

            {/* 언더라인 애니메이션용 keyframes */}
            <style jsx>{`
                @keyframes slideIn {
                    from {
                        width: 0;
                        opacity: 0;
                    }
                    to {
                        width: 2rem;
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}

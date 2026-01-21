'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

type Category = 'all' | 'post' | 'learning';

const CATEGORIES: { id: Category; label: string }[] = [
    { id: 'all', label: '전체 보기' },
    { id: 'post', label: '회고록' },
    { id: 'learning', label: '학습 노트' },
];

export default function CategoryDropdown() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // URL 쿼리 파라미터에서 현재 카테고리 파악 (없으면 'all')
    const currentCategory = (searchParams.get('category') as Category) || 'all';

    const handleSelect = (category: Category) => {
        setIsOpen(false);
        if (category === 'all') {
            router.push('/', { scroll: false });
        } else {
            router.push(`/?category=${category}`, { scroll: false });
        }
    };

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentLabel = CATEGORIES.find((c) => c.id === currentCategory)?.label || '전체 보기';

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex justify-center items-center w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-stone-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:text-gray-200"
                    id="options-menu"
                    aria-expanded="true"
                    aria-haspopup="true"
                >
                    {currentLabel}
                    <svg
                        className={`-mr-1 ml-2 h-5 w-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div
                    className="origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-white dark:bg-stone-900 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="options-menu"
                >
                    <div className="py-1" role="none">
                        {CATEGORIES.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => handleSelect(category.id)}
                                className={`block w-full text-left px-4 py-2 text-sm ${currentCategory === category.id
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                role="menuitem"
                            >
                                {category.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

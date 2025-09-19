// 파일 위치: apps/frontend/src/components/TagFilter.tsx
'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/utils/api';

const fetcher = () => api.fetchPopularTags();

export default function TagFilter() {
  const { data, error } = useSWR('popularTags', fetcher);

  if (error) return <div>Failed to load tags.</div>;
  if (!data) return null; // 로딩 중이거나 데이터가 없으면 렌더링하지 않음

  return (
    <div className="flex flex-wrap gap-3">
      {data.tags.map(tag => (
        <Link
          href={`/tags/${encodeURIComponent(tag.name)}`}
          key={tag.name}
          className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-full text-sm hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          # {tag.name}
        </Link>
      ))}
    </div>
  );
}
// 파일 위치: apps/frontend/src/components/ClientOnlyLocalDate.tsx
'use client';

import { useState, useEffect } from 'react';

interface ClientOnlyLocalDateProps {
  dateString: string;
  // 나중에 'YYYY-MM-DD' 와 같은 특정 포맷을 원할 경우를 위해 옵션 추가
  options?: Intl.DateTimeFormatOptions; 
}

/**
 * 서버에서는 렌더링되지 않고, 클라이언트에서만 사용자의 지역 설정에 맞게
 * 날짜를 포맷팅하여 보여주는 컴포넌트입니다. Hydration 오류를 방지합니다.
 */
export default function ClientOnlyLocalDate({ dateString, options }: ClientOnlyLocalDateProps) {
  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    // dateString이 유효한 경우에만 날짜 포맷팅을 수행합니다.
    if (dateString) {
      const date = new Date(dateString);
      // toLocaleDateString에 옵션을 전달할 수 있습니다.
      setFormattedDate(date.toLocaleDateString(undefined, options));
    }
  }, [dateString, options]);

  // formattedDate 상태가 업데이트될 때까지 아무것도 렌더링하지 않거나,
  // 스켈레톤 UI 등을 보여줄 수 있습니다. 지금은 간단하게 텍스트를 반환합니다.
  return <span>{formattedDate}</span>;
}
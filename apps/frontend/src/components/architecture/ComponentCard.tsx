// 파일 위치: apps/frontend/src/components/architecture/ComponentCard.tsx
'use client';

import Image from 'next/image';
import type { ComponentCardData } from '@/app/architecture/data';
import { iconMap } from './iconMap';
import { useState, useEffect } from 'react';
import type { StaticImageData } from 'next/image';

export default function ComponentCard({ icon, name, desc, isHighlight }: ComponentCardData) {
  // [신규] 동적으로 로드된 이미지 소스를 저장할 상태
  const [iconSrc, setIconSrc] = useState<StaticImageData | null>(null);

  useEffect(() => {
    // icon prop(문자열 키)에 해당하는 이미지 모듈을 동적으로 import 합니다.
    const loadIcon = async () => {
      // iconMap에 icon 키가 있는지 확인
      if (iconMap[icon]) {
        try {
          const imageModule = await iconMap[icon]();
          setIconSrc(imageModule.default);
        } catch (error) {
          console.error(`Failed to load icon: ${icon}`, error);
          setIconSrc(null); // 로드 실패 시 null로 설정
        }
      }
    };
    loadIcon();
  }, [icon]); // icon prop이 변경될 때마다 다시 로드

  return (
    // isHighlight가 true일 때 특별한 스타일을 적용하는 로직 추가
    <div className={`component-card ${isHighlight ? 'highlight' : ''}`}>
      <div className="component-icon">
        {iconSrc ? (
          // [핵심] Image 컴포넌트를 사용하여 아이콘을 렌더링합니다.
          <Image
            src={iconSrc}
            alt={`${name} icon`}
            width={40}
            height={40}
            unoptimized={true} // 외부 SVG/PNG의 경우, 또는 로컬 파일이라도 최적화가 불필요할 때
          />
        ) : (
          // 아이콘 로딩 중 또는 실패 시 보여줄 Fallback UI
          <div className="w-10 h-10 bg-gray-700 rounded-md animate-pulse" />
        )}
      </div>
      <div className="component-name">{name}</div>
      <div className="component-desc">{desc}</div>
    </div>
  );
}
// 파일 위치: apps/frontend/src/components/architecture/ExpandableSection.tsx
'use client';

import { useState, ReactNode, forwardRef, ComponentType } from 'react';

interface ExpandableSectionProps {
  id: string;
  icon: string | ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

const ExpandableSection = forwardRef<HTMLDivElement, ExpandableSectionProps>(
  ({ id, title, icon: Icon, children, defaultExpanded = false }, ref) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
      <div id={id} ref={ref} className={`expandable-section ${isExpanded ? 'expanded' : ''}`}>
        <div className="section-header" onClick={() => setIsExpanded(!isExpanded)}>
          <h3>
            {/* [핵심 수정] icon prop이 문자열(이모지)일 때와 컴포넌트일 때를 모두 처리합니다. */}
            {typeof Icon === 'string' ? (
              <span>{Icon}</span>
            ) : (
              // lucide-react 아이콘은 stroke 기반일 수 있으므로 fill 대신 text 색상을 사용
              <Icon className="w-6 h-6 text-purple-400" /> 
            )}
            {title}
          </h3>
          <span className="toggle-icon">▼</span>
        </div>
        <div className="section-content">
          {children}
        </div>
      </div>
    );
  }
);

ExpandableSection.displayName = 'ExpandableSection';
export default ExpandableSection;
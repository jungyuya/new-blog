// 파일 위치: apps/frontend/src/app/architecture/page.tsx
'use client';

import React, { useRef, createRef } from 'react';
import { mainFlowNodes, architectureSections } from './data';
import ComponentCard from '@/components/architecture/ComponentCard';
import Pipeline from '@/components/architecture/Pipeline';
import ExpandableSection from '@/components/architecture/ExpandableSection';
import styles from './architecture.module.css';
import './architecture.global.css';  



export default function ArchitecturePage() {
  // --- [핵심 수정 1] 각 섹션에 대한 ref를 생성하여 DOM에 접근합니다. ---
  const sectionRefs = useRef(architectureSections.map(() => createRef<HTMLDivElement>()));

  // --- [핵심 수정 2] 메인 플로우 노드 클릭 핸들러를 React 방식으로 변경합니다. ---
  const handleNodeClick = (targetId: string) => {
    if (!targetId || targetId === 'none') return;

    const targetIndex = architectureSections.findIndex(section => section.id === targetId);
    if (targetIndex === -1) return;

    const targetRef = sectionRefs.current[targetIndex];
    const targetElement = targetRef.current;

    if (targetElement) {
      // 1. 섹션을 펼칩니다. (React 상태가 아닌 DOM을 직접 제어하지만, 일회성 인터랙션이므로 허용)
      //    더 복잡한 상호작용이 필요하다면, isExpanded 상태를 부모로 끌어올려야 합니다.
      if (!targetElement.classList.contains('expanded')) {
        targetElement.querySelector('.section-header')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      
      // 2. 부드럽게 스크롤합니다.
      const offset = 80;
      const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });

      // 3. 시각적 피드백 효과
      targetElement.style.transition = 'all 0.1s ease-in-out';
      targetElement.style.borderColor = '#00d4ff';
      targetElement.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.4)';
      setTimeout(() => {
        targetElement.style.borderColor = '';
        targetElement.style.boxShadow = '';
      }, 1000);
    }
  };

  // --- [핵심 수정 3] useEffect를 완전히 제거합니다. ---

  return (
    <div className={styles.body}>
      <div className={styles.container}>
        <h1 className={styles.h1}>🐬 DEEP DIVE! : Cloud Architecture </h1>
        <p className={styles.subtitle}>Cloud-Native Intelligent Content Platform on AWS</p>
        
        <div className="main-flow">
          <div className="flow-title">⚡ Main Request Flow (핵심 데이터 흐름)</div>
          <div className="flow-diagram">
            {mainFlowNodes.map((node, index) => (
              <React.Fragment key={node.id}>
                <div className={`flow-node ${node.type}`} onClick={() => handleNodeClick(node.target)}>
                  <div className="node-icon">{node.icon}</div>
                  <div className="node-name">{node.name}</div>
                  <div className="node-detail">{node.detail}</div>
                </div>
                {index < mainFlowNodes.length - 1 && <div className="flow-arrow">→</div>}
              </React.Fragment>
            ))}
          </div>
          <div className="info-box">
            <strong>💡 핵심 포인트:</strong> CloudFront가 단일 진입점으로 경로별 라우팅 (/→Frontend, /api/*→Backend, /assets/*→S3, /speeches/*→S3)
          </div>
        </div>

        <div className="layer-badge aws">☁️ AWS CLOUD LAYER</div>
        {architectureSections.slice(0, 7).map((section, index) => (
          <ExpandableSection
            key={section.id}
            ref={sectionRefs.current[index]}
            id={section.id}
            title={section.title}
            icon={section.icon}
            defaultExpanded={index < 3}
          >
            {section.components && (
              <div className="component-grid">
                {section.components.map(comp => <ComponentCard key={comp.name} {...comp} />)}
              </div>
            )}
            {section.pipelines && section.pipelines.map(p => <Pipeline key={p.title} {...p} />)}
          </ExpandableSection>
        ))}

        <div className="layer-badge devops" style={{ marginTop: '40px' }}>🛠️ DEVELOPER EXPERIENCE (DevOps)</div>
        <ExpandableSection
          key={architectureSections[7].id}
          ref={sectionRefs.current[7]}
          id={architectureSections[7].id}
          title={architectureSections[7].title}
          icon={architectureSections[7].icon}
        >
          {architectureSections[7].pipelines?.map(p => <Pipeline key={p.title} {...p} />)}
        </ExpandableSection>
      </div>
    </div>
  );
}
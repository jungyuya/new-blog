// 파일 위치: apps/frontend/src/components/architecture/Pipeline.tsx
'use client';

import type { PipelineData } from '@/app/architecture/data';
import React from 'react';

export default function Pipeline({ title, steps }: PipelineData) {
  return (
    <div className="pipeline">
      <div className="pipeline-title">{title}</div>
      <div className="pipeline-flow">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="pipeline-step">{step}</div>
            {index < steps.length - 1 && <span className="pipeline-arrow">→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
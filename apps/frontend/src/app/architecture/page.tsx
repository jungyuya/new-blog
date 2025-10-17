// 파일 위치: apps/frontend/src/app/architecture/page.tsx
'use client'; // useEffect를 사용하기 위해 클라이언트 컴포넌트로 지정

import { useEffect } from 'react';

export default function ArchitecturePage() {
  // Step 1.4: JavaScript 로직 이식
  useEffect(() => {
    // 1. 아코디언 섹션을 토글하는 함수 정의
    function toggleSection(header: HTMLElement) {
      const section = header.parentElement;
      section?.classList.toggle('expanded');
    }

    // 2. 클릭 이벤트를 body에 위임하여, .section-header 클릭 시 toggleSection 호출
    //    (이벤트 위임 패턴을 사용하여, 각 헤더에 개별적으로 리스너를 붙이지 않아도 됨)
    const handleHeaderClick = (event: MouseEvent) => {
      const header = (event.target as HTMLElement).closest('.section-header');
      if (header) {
        toggleSection(header as HTMLElement);
      }
    };
    document.body.addEventListener('click', handleHeaderClick);

    // 3. 메인 플로우 노드 클릭 시 부드럽게 스크롤하는 이벤트 리스너 추가
    const flowNodes = document.querySelectorAll('.flow-node');
    const handleNodeClick = function(this: HTMLElement) {
        const targetId = this.dataset.target;
        if (!targetId || targetId === 'none') return;

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            if (!targetSection.classList.contains('expanded')) {
                targetSection.classList.add('expanded');
            }

            const offset = 80;
            const elementPosition = targetSection.getBoundingClientRect().top + window.scrollY;
            
            window.scrollTo({
                top: elementPosition - offset,
                behavior: 'smooth'
            });

            // 시각적 피드백 효과
            targetSection.style.transition = 'all 0.1s ease-in-out';
            targetSection.style.borderColor = '#00d4ff';
            targetSection.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.4)';
            setTimeout(() => {
                targetSection.style.borderColor = '';
                targetSection.style.boxShadow = '';
            }, 1000);
        }
    };
    flowNodes.forEach(node => {
        node.addEventListener('click', handleNodeClick);
    });

    // 4. 페이지 로드 시, 첫 3개 섹션을 기본으로 펼치는 로직
    const mainSections = document.querySelectorAll('.expandable-section');
    mainSections.forEach((section, index) => {
        if (index < 3) {
            section.classList.add('expanded');
        }
    });

    // 5. Cleanup 함수: 컴포넌트가 언마운트될 때 이벤트 리스너를 제거하여 메모리 누수 방지
    return () => {
      document.body.removeEventListener('click', handleHeaderClick);
      flowNodes.forEach(node => {
        node.removeEventListener('click', handleNodeClick);
      });
    };
  }, []); // 빈 배열 []: 컴포넌트가 처음 마운트될 때 이 useEffect를 한 번만 실행

  // Step 1.2 & 1.3: HTML 구조를 JSX로 변환하고, CSS는 globals.css로 옮겼다고 가정
  return (
    <>
      <div className="arch-body">
        <div className="arch-container">
            <h1 className="arch-h1">🚀 JUNGYU's Blog: Cloud Architecture</h1>
            <p className="arch-subtitle">Cloud-Native Intelligent Content Platform on AWS</p>

            <div className="main-flow">
                <div className="flow-title">⚡ Main Request Flow (핵심 데이터 흐름)</div>
                <div className="flow-diagram">
                    <div className="flow-node user" data-target="none">
                        <div className="node-icon">💻</div>
                        <div className="node-name">User</div>
                        <div className="node-detail">Web Browser</div>
                    </div>
                    <div className="flow-arrow">→</div>
                    <div className="flow-node edge" data-target="section-edge">
                        <div className="node-icon">🌍</div>
                        <div className="node-name">CloudFront</div>
                        <div className="node-detail">CDN + Routing</div>
                    </div>
                    <div className="flow-arrow">→</div>
                    <div className="flow-node compute" data-target="section-compute">
                        <div className="node-icon">⚛️</div>
                        <div className="node-name">Frontend</div>
                        <div className="node-detail">Next.js SSR</div>
                    </div>
                    <div className="flow-arrow">→</div>
                    <div className="flow-node compute" data-target="section-compute">
                        <div className="node-icon">🔧</div>
                        <div className="node-name">Backend</div>
                        <div className="node-detail">Hono API</div>
                    </div>
                    <div className="flow-arrow">→</div>
                    <div className="flow-node data" data-target="section-data">
                        <div className="node-icon">🗄️</div>
                        <div className="node-name">Database</div>
                        <div className="node-detail">DynamoDB</div>
                    </div>
                </div>
                <div className="info-box">
                    <strong>💡 핵심 포인트:</strong> CloudFront가 단일 진입점으로 경로별 라우팅 (/→Frontend, /api/*→Backend, /assets/*→S3, /speeches/*→S3)
                </div>
            </div>

            <div className="layer-badge aws">☁️ AWS CLOUD LAYER</div>

            <div id="section-edge" className="expandable-section">
                <div className="section-header">
                    <h3>🌐 Content Delivery & Edge</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="component-grid">
                        <div className="component-card"><div className="component-icon">🔀</div><div className="component-name">Route 53</div><div className="component-desc">DNS Management</div></div>
                        <div className="component-card"><div className="component-icon">🔒</div><div className="component-name">ACM</div><div className="component-desc">SSL/TLS Certificates</div></div>
                        <div className="component-card"><div className="component-icon">🌍</div><div className="component-name">CloudFront</div><div className="component-desc">Global CDN + Router</div></div>
                    </div>
                </div>
            </div>

            <div id="section-compute" className="expandable-section">
                <div className="section-header">
                    <h3>⚛️ Frontend & Backend Services</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="component-grid">
                        <div className="component-card"><div className="component-icon">🐳</div><div className="component-name">Frontend Lambda</div><div className="component-desc">Docker + Next.js SSR</div></div>
                        <div className="component-card"><div className="component-icon">📦</div><div className="component-name">S3 Assets</div><div className="component-desc">Static Files (JS/CSS)</div></div>
                        <div className="component-card"><div className="component-icon">🚪</div><div className="component-name">API Gateway</div><div className="component-desc">HTTP API Endpoints</div></div>
                        <div className="component-card"><div className="component-icon">λ</div><div className="component-name">Backend Lambda</div><div className="component-desc">Hono 3-Tier Architecture</div></div>
                        <div className="component-card"><div className="component-icon">🔍</div><div className="component-name">Search Lambda</div><div className="component-desc">OpenSearch Integration</div></div>
                    </div>
                </div>
            </div>

            <div id="section-data" className="expandable-section">
                <div className="section-header">
                    <h3>💾 Data & Storage</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="component-grid">
                        <div className="component-card"><div className="component-icon">🗄️</div><div className="component-name">DynamoDB</div><div className="component-desc">Single-Table + GSI + Stream</div></div>
                        <div className="component-card"><div className="component-icon">🖼️</div><div className="component-name">Image S3 Bucket</div><div className="component-desc">Images & Thumbnails</div></div>
                        <div className="component-card"><div className="component-icon">🔊</div><div className="component-name">Speech S3 Bucket</div><div className="component-desc">Generated Audio Files</div></div>
                    </div>
                </div>
            </div>

            <div id="section-pipelines" className="expandable-section">
                <div className="section-header">
                    <h3>⚙️ Asynchronous Pipelines (Event-Driven)</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="pipeline"><div className="pipeline-title">📐 Image Resizing Pipeline</div><div className="pipeline-flow"><div className="pipeline-step">S3 Image Upload</div><span className="pipeline-arrow">→</span><div className="pipeline-step">EventBridge</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Image Processor λ (sharp)</div><span className="pipeline-arrow">→</span><div className="pipeline-step">S3 Thumbnails</div></div></div>
                    <div className="pipeline"><div className="pipeline-title">🤖 AI Speech Synthesis Pipeline</div><div className="pipeline-flow"><div className="pipeline-step">API Request</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Backend λ (Invoke)</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Speech Synthesis λ</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Polly</div><span className="pipeline-arrow">→</span><div className="pipeline-step">S3</div><span className="pipeline-arrow">→</span><div className="pipeline-step">SNS</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Update URL λ</div><span className="pipeline-arrow">→</span><div className="pipeline-step">DynamoDB</div></div></div>
                    <div className="pipeline"><div className="pipeline-title">🔍 Search Indexing Pipeline</div><div className="pipeline-flow"><div className="pipeline-step">DynamoDB Stream</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Indexing λ</div><span className="pipeline-arrow">→</span><div className="pipeline-step">OpenSearch</div></div></div>
                </div>
            </div>

            <div id="section-ai" className="expandable-section">
                <div className="section-header">
                    <h3>🧠 AI & Search Services</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="component-grid">
                        <div className="component-card"><div className="component-icon">🤖</div><div className="component-name">Bedrock (Claude)</div><div className="component-desc">AI Summary Generation</div></div>
                        <div className="component-card"><div className="component-icon">🗣️</div><div className="component-name">Polly</div><div className="component-desc">Text-to-Speech</div></div>
                        <div className="component-card"><div className="component-icon">🔎</div><div className="component-name">OpenSearch</div><div className="component-desc">Full-text Search Cluster</div></div>
                    </div>
                </div>
            </div>

            <div id="section-security" className="expandable-section">
                <div className="section-header">
                    <h3>🔐 Security & Authentication</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="component-grid">
                        <div className="component-card"><div className="component-icon">👤</div><div className="component-name">Cognito</div><div className="component-desc">User Authentication</div></div>
                        <div className="component-card"><div className="component-icon">🛡️</div><div className="component-name">IAM</div><div className="component-desc">Least Privilege Access</div></div>
                    </div>
                </div>
            </div>

            <div id="section-observability" className="expandable-section">
                <div className="section-header">
                    <h3>📊 Observability & Monitoring</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="component-grid">
                        <div className="component-card"><div className="component-icon">📈</div><div className="component-name">CloudWatch</div><div className="component-desc">Logs, Metrics & Alarms</div></div>
                        <div className="component-card"><div className="component-icon">🗺️</div><div className="component-name">X-Ray</div><div className="component-desc">Distributed Tracing</div></div>
                        <div className="component-card"><div className="component-icon">⚠️</div><div className="component-name">Sentry</div><div className="component-desc">Error Tracking</div></div>
                    </div>
                </div>
            </div>

            <div className="layer-badge devops" style={{ marginTop: '40px' }}>🛠️ DEVELOPER EXPERIENCE (DevOps)</div>
            
            <div id="section-devops" className="expandable-section">
                <div className="section-header">
                    <h3>🔄 CI/CD Pipeline</h3>
                    <span className="toggle-icon">▼</span>
                </div>
                <div className="section-content">
                    <div className="pipeline"><div className="pipeline-title">🚀 Deployment Flow</div><div className="pipeline-flow"><div className="pipeline-step">💻 VS Code</div><span className="pipeline-arrow">→</span><div className="pipeline-step">Git Push</div><span className="pipeline-arrow">→</span><div className="pipeline-step">🐙 GitHub</div><span className="pipeline-arrow">→</span><div className="pipeline-step">🔄 GitHub Actions</div><span className="pipeline-arrow">→</span><div className="pipeline-step">🖥️ Self-hosted Runner (EC2)</div><span className="pipeline-arrow">→</span><div className="pipeline-step">📦 ECR (Docker)</div><span className="pipeline-arrow">→</span><div className="pipeline-step">🏗️ CDK Deploy</div><span className="pipeline-arrow">→</span><div className="pipeline-step">☁️ AWS Infrastructure</div></div></div>
                </div>
            </div>
        </div>
      </div>
    </>
  );
}
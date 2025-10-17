// 파일 위치: apps/frontend/src/app/architecture/data.ts

// 각 기술 카드의 데이터 타입을 정의합니다.
export interface ComponentCardData {
  icon: string;
  name: string;
  desc: string;
}

// 각 파이프라인의 데이터 타입을 정의합니다.
export interface PipelineData {
  title: string;
  steps: string[];
}

// 각 상세 섹션의 데이터 타입을 정의합니다.
export interface SectionData {
  id: string;
  title: string;
  icon: string;
  components?: ComponentCardData[];
  pipelines?: PipelineData[];
}

// --- 실제 데이터 정의 ---

export const mainFlowNodes = [
  { id: 'user', type: 'user', icon: '💻', name: 'User', detail: 'Web Browser', target: 'none' },
  { id: 'cloudfront', type: 'edge', icon: '🌍', name: 'CloudFront', detail: 'CDN + Routing', target: 'section-edge' },
  { id: 'frontend', type: 'compute', icon: '⚛️', name: 'Frontend', detail: 'Next.js SSR', target: 'section-compute' },
  { id: 'backend', type: 'compute', icon: '🔧', name: 'Backend', detail: 'Hono API', target: 'section-compute' },
  { id: 'database', type: 'data', icon: '🗄️', name: 'Database', detail: 'DynamoDB', target: 'section-data' },
];

export const architectureSections: SectionData[] = [
  {
    id: 'section-edge',
    title: 'Content Delivery & Edge',
    icon: '🌐',
    components: [
      { icon: '🔀', name: 'Route 53', desc: 'DNS Management' },
      { icon: '🔒', name: 'ACM', desc: 'SSL/TLS Certificates' },
      { icon: '🌍', name: 'CloudFront', desc: 'Global CDN + Router' },
    ],
  },
  {
    id: 'section-compute',
    title: 'Frontend & Backend Services',
    icon: '⚛️',
    components: [
      { icon: '🐳', name: 'Frontend Lambda', desc: 'Docker + Next.js SSR' },
      { icon: '📦', name: 'S3 Assets', desc: 'Static Files (JS/CSS)' },
      { icon: '🚪', name: 'API Gateway', desc: 'HTTP API Endpoints' },
      { icon: 'λ', name: 'Backend Lambda', desc: 'Hono 3-Tier Architecture' },
      { icon: '🔍', name: 'Search Lambda', desc: 'OpenSearch Integration' },
    ],
  },
  {
    id: 'section-data',
    title: 'Data & Storage',
    icon: '💾',
    components: [
        { icon: '🗄️', name: 'DynamoDB', desc: 'Single-Table + GSI + Stream' },
        { icon: '🖼️', name: 'Image S3 Bucket', desc: 'Images & Thumbnails' },
        { icon: '🔊', name: 'Speech S3 Bucket', desc: 'Generated Audio Files' },
    ],
  },
  {
    id: 'section-pipelines',
    title: 'Asynchronous Pipelines (Event-Driven)',
    icon: '⚙️',
    pipelines: [
      { title: 'Image Resizing Pipeline', steps: ['S3 Image Upload', 'EventBridge', 'Image Processor λ (sharp)', 'S3 Thumbnails'] },
      { title: 'AI Speech Synthesis Pipeline', steps: ['API Request', 'Backend λ (Invoke)', 'Speech Synthesis λ', 'Polly', 'S3', 'SNS', 'Update URL λ', 'DynamoDB'] },
      { title: 'Search Indexing Pipeline', steps: ['DynamoDB Stream', 'Indexing λ', 'OpenSearch'] },
    ],
  },
  {
    id: 'section-ai',
    title: 'AI & Search Services',
    icon: '🧠',
    components: [
        { icon: '🤖', name: 'Bedrock (Claude)', desc: 'AI Summary Generation' },
        { icon: '🗣️', name: 'Polly', desc: 'Text-to-Speech' },
        { icon: '🔎', name: 'OpenSearch', desc: 'Full-text Search Cluster' },
    ],
  },
  {
    id: 'section-security',
    title: 'Security & Authentication',
    icon: '🔐',
    components: [
        { icon: '👤', name: 'Cognito', desc: 'User Authentication' },
        { icon: '🛡️', name: 'IAM', desc: 'Least Privilege Access' },
    ],
  },
  {
    id: 'section-observability',
    title: 'Observability & Monitoring',
    icon: '📊',
    components: [
        { icon: '📈', name: 'CloudWatch', desc: 'Logs, Metrics & Alarms' },
        { icon: '🗺️', name: 'X-Ray', desc: 'Distributed Tracing' },
        { icon: '⚠️', name: 'Sentry', desc: 'Error Tracking' },
    ],
  },
  {
    id: 'section-devops',
    title: 'CI/CD Pipeline',
    icon: '🔄',
    pipelines: [
        { title: 'Deployment Flow', steps: ['💻 VS Code', 'Git Push', '🐙 GitHub', '🔄 GitHub Actions', '🖥️ Self-hosted Runner (EC2)', '📦 ECR (Docker)', '🏗️ CDK Deploy', '☁️ AWS Infrastructure'] },
    ],
  },
];
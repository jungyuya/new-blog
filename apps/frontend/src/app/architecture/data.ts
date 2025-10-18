// 파일 위치: apps/frontend/src/app/architecture/data.ts

// icon 타입을 간단한 문자열로 정의합니다.
export interface ComponentCardData {
  icon: string;
  name: string;
  desc: string;
  isHighlight?: boolean;
}

export interface PipelineData {
  title: string;
  steps: string[];
}

export interface SectionData {
  id: string;
  title: string;
  icon: string;
  components?: ComponentCardData[];
  pipelines?: PipelineData[];
}

// --- [핵심 수정] 실제 데이터 정의: icon 속성을 iconMap의 키(key) 문자열로 교체 ---

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
      { icon: 'Globe', name: 'Route 53', desc: 'DNS Management' },
      { icon: 'ShieldCheck', name: 'ACM', desc: 'SSL/TLS Certificates' },
      { icon: 'CloudFront', name: 'CloudFront', desc: 'Global CDN + Router' },
    ],
  },
  {
    id: 'section-compute',
    title: 'Frontend & Backend Services',
    icon: '⚛️',
    components: [
      { icon: 'Lambda', name: 'Frontend Lambda', desc: 'Docker + Next.js SSR', isHighlight: true },
      { icon: 'S3', name: 'S3 Assets', desc: 'Static Files (JS/CSS)' },
      { icon: 'ApiGateway', name: 'API Gateway', desc: 'HTTP API Endpoints' },
      { icon: 'Lambda', name: 'Backend Lambda', desc: 'Hono 3-Tier Architecture' },
      { icon: 'Lambda', name: 'Search Lambda', desc: 'OpenSearch Integration' },
    ],
  },
  {
    id: 'section-data',
    title: 'Data & Storage',
    icon: '💾',
    components: [
        { icon: 'DynamoDb', name: 'DynamoDB', desc: 'Single-Table + GSI + Stream', isHighlight: true },
        { icon: 'S3', name: 'Image S3 Bucket', desc: 'Images & Thumbnails' },
        { icon: 'S3', name: 'Speech S3 Bucket', desc: 'Generated Audio Files' },
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
        { icon: 'Bedrock', name: 'Bedrock (Claude)', desc: 'AI Summary Generation' },
        { icon: 'Polly', name: 'Polly', desc: 'Text-to-Speech' },
        { icon: 'OpenSearch', name: 'OpenSearch', desc: 'Full-text Search Cluster' },
    ],
  },
  {
    id: 'section-security',
    title: 'Security & Authentication',
    icon: '🔐',
    components: [
        { icon: 'Cognito', name: 'Cognito', desc: 'User Authentication' },
        { icon: 'Iam', name: 'IAM', desc: 'Least Privilege Access' },
    ],
  },
  {
    id: 'section-observability',
    title: 'Observability & Monitoring',
    icon: '📊',
    components: [
        { icon: 'CloudWatch', name: 'CloudWatch', desc: 'Logs, Metrics & Alarms' },
        { icon: 'XRay', name: 'X-Ray', desc: 'Distributed Tracing' },
        { icon: 'Sentry', name: 'Sentry', desc: 'Error Tracking' },
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
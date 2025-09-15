// 파일 위치: apps/frontend/tailwind.config.ts (v1.2 - CSS 변수 연동)
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // --- [핵심 수정] 색상 정의를 CSS 변수를 참조하도록 변경합니다. ---
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'header-bg': 'var(--header-bg)',
        'header-text': 'var(--header-text)',
        // 필요에 따라 다른 커스텀 색상도 추가할 수 있습니다.
        // 예: border: 'var(--border-color)',
      },
    },
  },
  plugins: [],
};

export default config;
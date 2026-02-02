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

        // [Design System] Semantic Colors
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
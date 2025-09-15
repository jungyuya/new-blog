// 파일 위치: apps/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. 다크 모드 전략을 'class'로 설정합니다.
  // <html> 태그에 'dark' 클래스가 있으면 다크 모드 스타일이 적용됩니다.
  darkMode: 'class',

  // 2. Tailwind CSS가 스타일을 스캔할 파일 경로를 지정합니다.
  // App Router 환경에 맞게 'src' 디렉토리 내부를 모두 포함합니다.
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // 3. 디자인 시스템을 정의하는 'theme' 객체입니다.
  theme: {
    extend: {
      // 3.1. 의미론적인 이름으로 커스텀 색상 팔레트를 정의합니다.
      colors: {
        'light-bg': '#FFFFFF',      // 라이트 모드 기본 배경
        'dark-bg': '#111827',       // 다크 모드 기본 배경 (어두운 남색 계열)
        
        'light-text': '#1F2937',    // 라이트 모드 기본 텍스트
        'dark-text': '#E5E7EB',     // 다크 모드 기본 텍스트 (완전한 흰색이 아님)
        
        'light-card-bg': '#FFFFFF', // 라이트 모드 카드 배경
        'dark-card-bg': '#1F2937',  // 다크 모드 카드 배경
        
        'light-border': '#E5E7EB',  // 라이트 모드 경계선
        'dark-border': '#374151',   // 다크 모드 경계선

        'primary': {
          DEFAULT: '#4F46E5',      // 기본 (라이트 모드) 주요 색상 (indigo-600)
          hover: '#4338CA',       // 기본 호버 색상 (indigo-700)
          dark: '#818CF8',         // 다크 모드 주요 색상 (indigo-400)
          'dark-hover': '#6366F1', // 다크 모드 호버 색상 (indigo-500)
        }
      },
      // 3.2. 다크 모드를 위한 커스텀 그림자(box-shadow)를 정의합니다.
      boxShadow: {
        'dark-lg': '0 10px 15px -3px rgba(255, 255, 255, 0.03), 0 4px 6px -4px rgba(255, 255, 255, 0.03)',
        'dark-2xl': '0 25px 50px -12px rgba(255, 255, 255, 0.05)',
      }
    },
  },

  // 4. 플러그인 (필요 시 추가)
  plugins: [],
}
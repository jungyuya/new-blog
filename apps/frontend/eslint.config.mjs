import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals"; // [추가]
import tseslint from "typescript-eslint"; // [추가]
import react from "eslint-plugin-react"; // [추가]
import nextPlugin from "@next/eslint-plugin-next"; // [추가]

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  // Next.js의 기본 설정을 가져옵니다.
  ...compat.extends("next/core-web-vitals"),
  
  // [핵심 수정] 우리가 직접 규칙을 커스터마이징하기 위한 객체를 추가합니다.
  {
    files: ["**/*.ts", "**/*.tsx"], // TypeScript 파일에만 이 규칙을 적용
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react": react,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Next.js 기본 규칙 외에, 우리가 추가하거나 덮어쓸 규칙을 여기에 정의합니다.
      
      // [핵심] @typescript-eslint/no-unused-vars 규칙을 수정합니다.
      "@typescript-eslint/no-unused-vars": [
        "warn", // 규칙 위반 시 '경고(warn)'로 표시합니다.
        {
          // args: 'all' - 모든 파라미터를 검사 대상으로 합니다.
          // argsIgnorePattern: '^_': 하지만, '_'로 시작하는 파라미터는 검사에서 제외합니다.
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
        }
      ],

      // 이전에 발생했던 no-explicit-any 에러를 다시 활성화하여 코드 품질을 유지합니다.
      "@typescript-eslint/no-explicit-any": "error",
    }
  }
];

export default eslintConfig;
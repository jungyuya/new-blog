// 파일 위치: apps/frontend/src/utils/toc.ts

import Slugger from 'github-slugger';

export interface Heading {
    id: string;
    level: number;
    text: string;
}

/**
 * 마크다운 텍스트에서 h1, h2, h3 제목들을 추출하여 목차 데이터 배열을 생성합니다.
 * github-slugger를 사용하여 rehype-slug와 동일한 ID 생성 규칙을 보장합니다.
 * @param markdownContent 마크다운 원본 텍스트
 * @returns Heading 객체 배열
 */
export function generateToc(markdownContent: string): Heading[] {
    const headings: Heading[] = [];
    const headingRegex = /^(#{1,3})\s+(.*)/gm;

    // Slugger 인스턴스를 생성합니다. 이 인스턴스는 ID 중복을 내부적으로 관리합니다.
    const slugger = new Slugger();

    // 1차 필터링: 코드 블록(```...```)을 먼저 제거하여, 코드 블록 내의 # 주석 등을 제목으로 인식하는 것을 방지합니다.
    const contentWithoutCodeBlocks = markdownContent.replace(/```[\s\S]*?```/g, '');

    let match;
    while ((match = headingRegex.exec(contentWithoutCodeBlocks)) !== null) {
        const level = match[1].length;

        // 2차 필터링: 제목 텍스트에서 ** 등 마크다운 문법을 제거합니다.
        const rawText = match[2].trim();
        const text = rawText
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            .replace(/(\*|_)(.*?)\1/g, '$2')
            .replace(/`/g, '')
            .replace(/\\/g, ''); // 백슬래시 제거
        
        // slugger.slug()를 사용하여 ID를 생성합니다.
        const id = slugger.slug(text);

        headings.push({
            id,
            level,
            text,
        });
    }

    return headings;
}
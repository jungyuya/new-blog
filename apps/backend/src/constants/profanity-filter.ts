// 파일 위치: apps/backend/src/constants/profanity-filter.ts

/**
 * 욕설 및 부적절한 표현 필터링을 위한 상수
 * 
 * 주의: 이 리스트는 기본적인 필터링을 위한 것이며,
 * 실제 프로덕션에서는 더 정교한 필터링이 필요할 수 있습니다.
 */

// 한국어 욕설 리스트
export const KOREAN_PROFANITY: string[] = [
    '시발',
    'ㅅㅂ',
    '씨발',
    '병신',
    'ㅂㅅ',
    '새끼',
    'ㅅㄲ',
    '개새',
    '좆',
    'ㅈ같',
    '지랄',
    '미친놈',
    '미친년',
    '또라이',
];

// 영어 욕설 리스트
export const ENGLISH_PROFANITY: string[] = [
    'fuck',
    'shit',
    'bitch',
    'asshole',
];

// 정규식 패턴으로 감지해야 하는 변형 욕설
export const PROFANITY_PATTERNS: RegExp[] = [
    /[ㅅ시][ㅂ바발]/gi,  // 시발, 씨발 등의 변형
    /[ㅂ병][ㅅ신]/gi,    // 병신 변형
    /[ㅅ새][ㄲ끼기]/gi,  // 새끼 변형
    /f+u+c+k+/gi,        // fuck 변형
    /s+h+i+t+/gi,        // shit 변형
];

// 스팸으로 간주할 반복 패턴
export const SPAM_PATTERNS: RegExp[] = [
    /(.)\1{9,}/,          // 같은 문자 10회 이상 반복
    /(ㅋ|ㅎ){10,}/,       // ㅋㅋㅋ, ㅎㅎㅎ 10회 이상
];

// URL 패턴
export const URL_PATTERN = /https?:\/\/[^\s]+/gi;

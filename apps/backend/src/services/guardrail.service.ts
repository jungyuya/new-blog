// 파일 위치: apps/backend/src/services/guardrail.service.ts

import {
    KOREAN_PROFANITY,
    ENGLISH_PROFANITY,
    PROFANITY_PATTERNS,
    SPAM_PATTERNS,
    URL_PATTERN,
} from '../constants/profanity-filter';

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

/**
 * 질문의 적절성을 검증하는 가드레일 서비스
 */
export class GuardrailService {

    /**
     * 질문이 적절한지 검증합니다.
     * 
     * @param question 사용자 질문
     * @returns 검증 결과 (isValid: true/false, reason: 차단 사유)
     */
    static validateQuestion(question: string): ValidationResult {
        // 1. 질문 길이 검증
        const lengthValidation = this.validateLength(question);
        if (!lengthValidation.isValid) {
            return lengthValidation;
        }

        // 2. 욕설 필터링
        const profanityValidation = this.checkProfanity(question);
        if (!profanityValidation.isValid) {
            return profanityValidation;
        }

        // 3. 스팸 패턴 검증
        const spamValidation = this.checkSpamPatterns(question);
        if (!spamValidation.isValid) {
            return spamValidation;
        }

        // 4. URL 스팸 검증
        const urlValidation = this.checkUrlSpam(question);
        if (!urlValidation.isValid) {
            return urlValidation;
        }

        // 모든 검증 통과
        return { isValid: true };
    }

    /**
     * 질문 길이를 검증합니다.
     */
    private static validateLength(question: string): ValidationResult {
        const trimmedLength = question.trim().length;

        if (trimmedLength < 2) {
            return {
                isValid: false,
                reason: '질문이 너무 짧습니다. 최소 2자 이상 입력해주세요.',
            };
        }

        if (trimmedLength > 500) {
            return {
                isValid: false,
                reason: '질문이 너무 깁니다. 최대 500자까지 입력 가능합니다.',
            };
        }

        return { isValid: true };
    }

    /**
     * 욕설 및 부적절한 표현을 검사합니다.
     */
    private static checkProfanity(question: string): ValidationResult {
        const lowerQuestion = question.toLowerCase();

        // 한국어 욕설 체크
        for (const word of KOREAN_PROFANITY) {
            if (lowerQuestion.includes(word.toLowerCase())) {
                return {
                    isValid: false,
                    reason: '부적절한 표현이 감지되었습니다. 정중한 표현을 사용해주세요.',
                };
            }
        }

        // 영어 욕설 체크
        for (const word of ENGLISH_PROFANITY) {
            if (lowerQuestion.includes(word.toLowerCase())) {
                return {
                    isValid: false,
                    reason: '부적절한 표현이 감지되었습니다. 정중한 표현을 사용해주세요.',
                };
            }
        }

        // 정규식 패턴 체크 (변형 욕설)
        for (const pattern of PROFANITY_PATTERNS) {
            if (pattern.test(question)) {
                return {
                    isValid: false,
                    reason: '부적절한 표현이 감지되었습니다. 정중한 표현을 사용해주세요.',
                };
            }
        }

        return { isValid: true };
    }

    /**
     * 스팸 패턴을 검사합니다.
     */
    private static checkSpamPatterns(question: string): ValidationResult {
        for (const pattern of SPAM_PATTERNS) {
            if (pattern.test(question)) {
                return {
                    isValid: false,
                    reason: '스팸으로 의심되는 패턴이 감지되었습니다.',
                };
            }
        }

        return { isValid: true };
    }

    /**
     * 과도한 URL 포함 여부를 검사합니다.
     */
    private static checkUrlSpam(question: string): ValidationResult {
        const urls = question.match(URL_PATTERN);

        if (urls && urls.length > 3) {
            return {
                isValid: false,
                reason: '질문에 너무 많은 URL이 포함되어 있습니다.',
            };
        }

        return { isValid: true };
    }
}

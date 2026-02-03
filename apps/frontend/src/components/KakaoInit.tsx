'use client';

import Script from 'next/script';

export default function KakaoInit() {
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY;

    // [추가] 로드 실패/지연 대비용 백업 초기화 로직
    /* eslint-disable react-hooks/exhaustive-deps */
    // useEffect(() => {
    //     const Kakao = (window as any).Kakao;
    //     if (Kakao && !Kakao.isInitialized() && kakaoKey) {
    //         Kakao.init(kakaoKey);
    //     }
    // }, []);

    return (
        <Script
            src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
            // integrity 속성 제거 (버전 불일치 가능성 배제)
            // crossOrigin="anonymous" 
            strategy="afterInteractive"
            onLoad={() => {
                const Kakao = (window as any).Kakao;
                if (Kakao && !Kakao.isInitialized() && kakaoKey) {
                    try {
                        Kakao.init(kakaoKey);
                        console.log('Kakao SDK initialized successfully');
                    } catch (error) {
                        console.error('Failed to initialize Kakao SDK:', error);
                    }
                }
            }}
        />
    );
}

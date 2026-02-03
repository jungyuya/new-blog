'use client';

import { useEffect } from 'react';

export default function ErrorTestPage() {
    useEffect(() => {
        // 렌더링 직후 에러를 발생시켜 Error Boundary를 테스트합니다.
        throw new Error('의도된 테스트 에러입니다. error.tsx가 잘 작동하나요?');
    }, []);

    return (
        <div className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">에러 테스트 페이지</h1>
            <p>잠시 후 에러가 발생합니다..</p>
        </div>
    );
}
 
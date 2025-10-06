// 파일 위치: apps/frontend/src/instrumentation.ts

export async function register() {
  // Next.js 서버 런타임 환경에서만 이 코드가 실행되도록 보장합니다.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  try {
    // CommonJS-style의 require를 사용하여 빌드 시점의 정적 분석 문제를 최소화합니다.
    const AWSXRay = require('aws-xray-sdk-core');
    const http = require('http');
    const https = require('https');

    // 1. 기존 http/https 모듈을 패치합니다.
    AWSXRay.captureHTTPsGlobal(http);
    AWSXRay.captureHTTPsGlobal(https);
    AWSXRay.capturePromise();

    // 2. 글로벌 fetch 함수를 래핑(wrapping)하여 X-Ray 헤더를 주입합니다.
    const globalAny = global as any;
    if (typeof globalAny.fetch === 'function' && !globalAny.fetch.__xrayPatched) {
      const originalFetch = globalAny.fetch.bind(globalAny);

      globalAny.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const segment = AWSXRay.getSegment();
        let modifiedInit = init ? { ...init } : {};

        if (segment) {
          const traceHeader = `Root=${segment.trace_id};Parent=${segment.id};Sampled=${segment.notTraced ? '0' : '1'}`;
          
          modifiedInit.headers = {
            ...modifiedInit.headers,
            'X-Amzn-Trace-Id': traceHeader,
          };
        }
        
        return originalFetch(input, modifiedInit);
      };
      
      // 중복 패치를 방지하기 위한 플래그
      globalAny.fetch.__xrayPatched = true;
      console.log('[X-Ray] Global fetch function has been patched.');
    }
    
    console.log('[X-Ray] Instrumentation registered successfully.');

  } catch (err) {
    console.error('[X-Ray] Instrumentation failed to register:', err);
  }
}
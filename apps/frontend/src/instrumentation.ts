// 파일 위치: apps/frontend/src/instrumentation.ts

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  try {
    const AWSXRay = require('aws-xray-sdk-core');
    const http = require('http');
    const https = require('https-');

    AWSXRay.captureHTTPsGlobal(http);
    AWSXRay.captureHTTPsGlobal(https);
    AWSXRay.capturePromise();

    // --- [핵심 수정] 'any' 타입을 사용하지 않고 global 타입을 확장합니다. ---
    type GlobalWithFetch = typeof global & {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
      __xrayPatched?: boolean;
    };

    const globalWithFetch = global as GlobalWithFetch;

    if (typeof globalWithFetch.fetch === 'function' && !globalWithFetch.__xrayPatched) {
      const originalFetch = globalWithFetch.fetch.bind(globalWithFetch);

      globalWithFetch.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
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
      
      globalWithFetch.__xrayPatched = true;
      console.log('[X-Ray] Global fetch function has been patched.');
    }
    
    console.log('[X-Ray] Instrumentation registered successfully.');

  } catch (err) {
    console.error('[X-Ray] Instrumentation failed to register:', err);
  }
}
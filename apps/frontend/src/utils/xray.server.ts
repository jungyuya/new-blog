// 파일 위치: apps/frontend/src/utils/xray.server.ts (이름 변경 후)

import * as AWSXRay from 'aws-xray-sdk';
import http from 'http';
import https from 'https';

let isXRayInitialized = false;

export function captureXRayTrace() {
  // 'typeof window' 체크는 여전히 유용하므로 유지합니다.
  if (typeof window === 'undefined' && !isXRayInitialized) {
    console.log('[X-Ray] Initializing server-side HTTP capture...');
    AWSXRay.captureHTTPsGlobal(http);
    AWSXRay.captureHTTPsGlobal(https);
    AWSXRay.capturePromise();
    isXRayInitialized = true;
  }
}
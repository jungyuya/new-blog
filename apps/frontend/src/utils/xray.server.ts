// 파일 위치: apps/frontend/src/utils/xray.server.ts (신규 생성)
'use server'; // 이 파일이 서버 전용 모듈임을 명시합니다.

import * as AWSXRay from 'aws-xray-sdk';
import http from 'http';
import https from 'https';

let isXRayInitialized = false;

export function captureXRayTrace() {
  if (typeof window === 'undefined' && !isXRayInitialized) {
    console.log('[X-Ray] Initializing server-side HTTP capture...');
    AWSXRay.captureHTTPsGlobal(http);
    AWSXRay.captureHTTPsGlobal(https);
    AWSXRay.capturePromise();
    isXRayInitialized = true;
  }
}
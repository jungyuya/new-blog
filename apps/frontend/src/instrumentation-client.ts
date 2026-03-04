// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e898f40fc8fa77656be4b04ac9c4b117@o4510066308874240.ingest.us.sentry.io/4510066371985408",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  // 프로덕션 환경에서 모든 트랜잭션을 추적하면 오버헤드가 발생합니다.
  // 20% 샘플링으로도 블로그 트래픽 수준에서 충분한 에러 모니터링이 가능합니다.
  tracesSampleRate: 0.2,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
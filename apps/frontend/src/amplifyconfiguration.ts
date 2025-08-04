// apps/frontend/src/amplifyconfiguration.ts (Phase 5 최종 완성본)

// 이 파일은 더 이상 수동으로 관리되지 않습니다.
// 모든 값은 AWS CDK가 'pnpm build' 시점에 환경 변수(process.env)를 통해 동적으로 주입합니다.
// 이것이 "인프라와 코드의 완전한 동기화"입니다.

const amplifyConfig = {
  Auth: {
    Cognito: {
      // 이전: "ap-northeast-2_27WIBgYjt" (하드코딩)
      // 변경: process.env 객체에서 CDK가 주입한 값을 읽어옵니다.
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      region: process.env.NEXT_PUBLIC_REGION!,
    }
  },
  API: {
    REST: {
      "MyBlogAPI": {
        // 이전: "https://oaghj8029h..." (하드코딩)
        // 변경: process.env 객체에서 CDK가 주입한 API 엔드포인트를 읽어옵니다.
        endpoint: process.env.NEXT_PUBLIC_API_ENDPOINT!,
        region: process.env.NEXT_PUBLIC_REGION!,
        "authorizationType": "AMAZON_COGNITO_USER_POOLS"
      }
    }
  }
};

export default amplifyConfig;
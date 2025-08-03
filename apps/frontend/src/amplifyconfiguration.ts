// apps/frontend/src/amplifyconfiguration.ts (최종 완성본)

// 1. 설정 정보를 담을 JavaScript 객체를 'amplifyConfig'라는 상수로 선언합니다.
const amplifyConfig = {
  // 2. Auth 카테고리: Cognito 인증과 관련된 모든 설정을 이 안에 그룹화합니다.
  Auth: {
    Cognito: {
      // 이 값들은 outputs.json 파일에서 정확하게 복사-붙여넣기 해야 합니다.
      userPoolId: "ap-northeast-2_27WIBgYjt",          // <--- outputs.json의 UserPoolIdOutput 값
      userPoolClientId: "57nplr76c82u3sjmvt7cub8gf5",    // <--- outputs.json의 UserPoolClientIdOutput 값
      region: "ap-northeast-2"                         // <--- outputs.json의 RegionOutput 값
    }
  },
  // 3. API 카테고리: API Gateway와 관련된 모든 설정을 이 안에 그룹화합니다.
  API: {
    REST: {
      // 'MyBlogAPI'는 우리가 코드에서 이 API를 부를 때 사용할 별명입니다.
      "MyBlogAPI": {
        endpoint: "https://oaghj8029h.execute-api.ap-northeast-2.amazonaws.com", // <--- outputs.json의 ApiGatewayEndpoint 값 (마지막 '/' 제외)
        region: "ap-northeast-2",                                              // <--- outputs.json의 RegionOutput 값
        // 이 API는 Cognito User Pool 토큰으로 인증한다고 명확히 알려줍니다.
        "authorizationType": "AMAZON_COGNITO_USER_POOLS"
      }
    }
  }
};

// 4. 이 파일의 핵심: 위에서 정의한 'amplifyConfig' 객체를
//    이 모듈의 기본 내보내기(default export)로 지정합니다.
//    이제 다른 파일에서 이 파일을 import하면, 이 객체를 직접 받게 됩니다.
export default amplifyConfig;
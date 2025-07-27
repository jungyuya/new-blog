"use strict";

// asset-input/apps/backend/dist/src/index.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var handler = async (event, context) => {
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      // CORS 허용 (개발용)
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
    },
    body: JSON.stringify({
      message: "Hello from your backend Lambda!",
      input: event
      // 받은 이벤트를 그대로 반환하여 디버깅에 도움
    })
  };
};
exports.handler = handler;

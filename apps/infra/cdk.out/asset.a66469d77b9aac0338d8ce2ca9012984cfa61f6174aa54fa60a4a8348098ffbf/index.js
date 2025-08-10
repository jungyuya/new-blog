"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// apps/cache-gateway/src/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
var import_client_secrets_manager = require("@aws-sdk/client-secrets-manager");
var cacheBucketName = process.env.CACHE_BUCKET_NAME;
var turboTokenSecretArn = process.env.TURBO_TOKEN_SECRET_ARN;
var region = process.env.AWS_REGION || "ap-northeast-2";
if (!cacheBucketName || !turboTokenSecretArn) {
  throw new Error("Required environment variables CACHE_BUCKET_NAME and TURBO_TOKEN_SECRET_ARN are not set.");
}
var s3Client = new import_client_s3.S3Client({ region });
var secretsManagerClient = new import_client_secrets_manager.SecretsManagerClient({ region });
var cachedToken = null;
async function getTurboToken() {
  if (cachedToken) {
    return cachedToken;
  }
  const command = new import_client_secrets_manager.GetSecretValueCommand({ SecretId: turboTokenSecretArn });
  const response = await secretsManagerClient.send(command);
  if (!response.SecretString) {
    throw new Error("Secret value is empty in Secrets Manager.");
  }
  cachedToken = response.SecretString;
  return cachedToken;
}
var handler = async (event) => {
  try {
    const requestToken = event.headers.authorization?.replace("Bearer ", "");
    const expectedToken = await getTurboToken();
    if (!requestToken || requestToken !== expectedToken) {
      console.warn("Authentication failed: Invalid or missing token.");
      return { statusCode: 401, body: "Unauthorized" };
    }
    const artifactHash = event.pathParameters?.proxy;
    if (!artifactHash) {
      return { statusCode: 400, body: "Bad Request: Missing artifact hash." };
    }
    const s3Key = `v8/artifacts/${artifactHash}`;
    switch (event.requestContext.http.method) {
      // --- 캐시 다운로드 (GET) ---
      case "GET": {
        const command = new import_client_s3.GetObjectCommand({ Bucket: cacheBucketName, Key: s3Key });
        const presignedUrl = await (0, import_s3_request_presigner.getSignedUrl)(s3Client, command, { expiresIn: 300 });
        return {
          statusCode: 307,
          headers: { "Location": presignedUrl }
        };
      }
      // --- 캐시 업로드 (PUT) ---
      case "PUT": {
        try {
          await s3Client.send(new import_client_s3.HeadObjectCommand({ Bucket: cacheBucketName, Key: s3Key }));
          console.log(`Cache hit on PUT for ${s3Key}. Skipping upload.`);
          return { statusCode: 200, body: "Cache hit, upload skipped." };
        } catch (error) {
          if (error.name !== "NotFound") {
            throw error;
          }
        }
        const command = new import_client_s3.PutObjectCommand({ Bucket: cacheBucketName, Key: s3Key });
        const presignedUrl = await (0, import_s3_request_presigner.getSignedUrl)(s3Client, command, { expiresIn: 300 });
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: presignedUrl })
        };
      }
      default:
        return { statusCode: 405, body: "Method Not Allowed" };
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});

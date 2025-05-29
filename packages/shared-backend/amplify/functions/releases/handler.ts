import type { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, path } = event;

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (httpMethod === "GET" && path === "/releases/latest") {
    // S3から最新のリリース情報を取得
    const releaseInfo = {
      version: "0.1.9", // 実際はS3やDynamoDBから取得
      platforms: {
        "darwin-aarch64": {
          signature: "...", // 実際の署名
          url: "https://d1234567890abcdef.cloudfront.net/releases/hedge-system/macos/aarch64/Hedge System_0.1.9.dmg",
        },
        "darwin-x86_64": {
          signature: "...", // 実際の署名
          url: "https://d1234567890abcdef.cloudfront.net/releases/hedge-system/macos/x64/Hedge System_0.1.9.dmg",
        },
        "windows-x86_64": {
          signature: "...", // 実際の署名
          url: "https://d1234567890abcdef.cloudfront.net/releases/hedge-system/windows/x64/Hedge System_0.1.9.exe",
        },
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(releaseInfo),
    };
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: "Not found" }),
  };
};
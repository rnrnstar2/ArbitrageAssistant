import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "ArbitrageAssistantReleases",
  access: (allow) => ({
    "releases/*": [
      // パブリックアクセス（認証不要）でリリースファイルをダウンロード可能
      allow.guest.to(["read"]),
      // 認証済みユーザーはアップロード可能（GitHub Actions用）
      allow.authenticated.to(["read", "write", "delete"]),
    ],
  }),
});
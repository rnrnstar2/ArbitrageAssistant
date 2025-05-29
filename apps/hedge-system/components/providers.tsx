"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import "../utils/amplify-i18n"; // i18n設定を初期化
import { useAutoUpdater } from "@/hooks/useAutoUpdater";

Amplify.configure(outputs);

// 自動アップデーター用のラッパーコンポーネント
function AutoUpdaterWrapper({ children }: { children: React.ReactNode }) {
  // 完全自動アップデート：ユーザー確認なしで更新
  useAutoUpdater({
    silent: true,              // サイレントモード（ユーザー確認なし）
    checkInterval: 15 * 60 * 1000,  // 15分ごとにチェック
    initialDelay: 5 * 1000,    // 起動5秒後に初回チェック
  });

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <AutoUpdaterWrapper>
        {children}
      </AutoUpdaterWrapper>
    </NextThemesProvider>
  );
}

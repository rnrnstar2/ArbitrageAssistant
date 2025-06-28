"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import "@repo/shared-amplify/utils/i18n"; // i18n設定を初期化
import { UpdateNotification } from "./UpdateNotification";
import { AuthProvider } from "@repo/shared-auth"; // 統合AuthProviderを使用
import { systemManager, SystemManager } from "../lib/system-manager";
// shared-amplifyをインポートすることで自動的にAmplify設定が実行される
import "@repo/shared-amplify/config";

// System Context作成
const SystemContext = React.createContext<SystemManager | null>(null);

export function useSystemManager() {
  const context = React.useContext(SystemContext);
  if (!context) {
    throw new Error('useSystemManager must be used within SystemProvider');
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // System Manager初期化
  React.useEffect(() => {
    const initializeSystem = async () => {
      try {
        await systemManager.start();
        // ✅ Hedge System initialized successfully
      } catch (error) {
        console.error('❌ Failed to initialize Hedge System:', error);
      }
    };
    
    initializeSystem();
    
    // クリーンアップ
    return () => {
      systemManager.stop().catch(console.error);
    };
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <SystemContext.Provider value={systemManager}>
        <AuthProvider 
          options={{
            enableWebSocket: true,
            websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
            appType: 'hedge-system'
          }}
          enableDebugLogs={process.env.NODE_ENV === 'development'}
        >
          {children}
          <UpdateNotification />
        </AuthProvider>
      </SystemContext.Provider>
    </NextThemesProvider>
  );
}

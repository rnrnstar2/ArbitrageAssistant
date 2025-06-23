"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import "../utils/amplify-i18n"; // i18n設定を初期化
import { UpdateNotification } from "./UpdateNotification";
import { AuthProvider } from "@repo/ui/components/auth";
import { AuthService } from "@repo/shared-auth";
import { systemManager, SystemManager } from "../lib/system-manager";

Amplify.configure(outputs);

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
  const [authService] = React.useState(() => new AuthService({
    enableWebSocket: true,
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL
  }));
  
  const [authState, setAuthState] = React.useState(() => authService.getState());
  
  // System Manager初期化
  React.useEffect(() => {
    const initializeSystem = async () => {
      try {
        await systemManager.start();
        console.log('✅ Hedge System initialized successfully');
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
  
  React.useEffect(() => {
    const unsubscribe = authService.subscribe(() => {
      setAuthState(authService.getState());
    });
    return unsubscribe;
  }, [authService]);

  const authContextValue = {
    ...authState,
    user: authState.user as Record<string, unknown> | null,
    signIn: authService.signIn.bind(authService),
    signOut: authService.signOut.bind(authService),
    checkAuthState: authService.checkAuthState.bind(authService),
    getWebSocketConnectionOptions: () => {
      const options = authService.getWebSocketConnectionOptions();
      return options as Record<string, unknown> | null;
    },
  };

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <SystemContext.Provider value={systemManager}>
        <AuthProvider value={authContextValue}>
          {children}
          <UpdateNotification />
        </AuthProvider>
      </SystemContext.Provider>
    </NextThemesProvider>
  );
}

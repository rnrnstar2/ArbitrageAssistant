"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import "../utils/amplify-i18n"; // i18n設定を初期化
import { UpdateNotification } from "./UpdateNotification";
import { AuthProvider } from "@repo/ui/components/auth";
import { AuthService } from "@repo/shared-auth";

Amplify.configure(outputs);

export function Providers({ children }: { children: React.ReactNode }) {
  const [authService] = React.useState(() => new AuthService({
    enableWebSocket: true,
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL
  }));
  
  const [authState, setAuthState] = React.useState(() => authService.getState());
  
  React.useEffect(() => {
    const unsubscribe = authService.subscribe(() => {
      setAuthState(authService.getState());
    });
    return unsubscribe;
  }, [authService]);

  const authContextValue = {
    ...authState,
    signIn: authService.signIn.bind(authService),
    signOut: authService.signOut.bind(authService),
    checkAuthState: authService.checkAuthState.bind(authService),
    getWebSocketConnectionOptions: authService.getWebSocketConnectionOptions.bind(authService),
  };

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <AuthProvider value={authContextValue}>
        {children}
        <UpdateNotification />
      </AuthProvider>
    </NextThemesProvider>
  );
}

"use client";

import * as React from "react";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { AuthProvider } from "@repo/ui/components/auth";
import { AuthService } from "@repo/shared-auth";

// Amplify設定をモジュールレベルで実行
Amplify.configure(outputs);

export function Providers({ children }: { children: React.ReactNode }) {
  const [authService, setAuthService] = React.useState<AuthService | null>(null);
  const [authState, setAuthState] = React.useState<ReturnType<AuthService['getState']>>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    authToken: null,
    groups: [],
  });
  
  React.useEffect(() => {
    // Amplify.configure()の後にAuthServiceを初期化
    const service = new AuthService({
      enableWebSocket: false
    });
    setAuthService(service);
    setAuthState(service.getState());

    const unsubscribe = service.subscribe(() => {
      setAuthState(service.getState());
    });
    return unsubscribe;
  }, []);

  const authContextValue = {
    ...authState,
    user: authState.user as Record<string, unknown> | null,
    signIn: authService?.signIn.bind(authService) || (async () => { throw new Error('Auth service not initialized'); }),
    signOut: authService?.signOut.bind(authService) || (async () => { throw new Error('Auth service not initialized'); }),
    checkAuthState: authService?.checkAuthState.bind(authService) || (async () => { throw new Error('Auth service not initialized'); }),
    getWebSocketConnectionOptions: () => {
      const options = authService?.getWebSocketConnectionOptions();
      return options as Record<string, unknown> | null;
    },
  };

  return (
    <AuthProvider value={authContextValue}>
      {children}
    </AuthProvider>
  );
}
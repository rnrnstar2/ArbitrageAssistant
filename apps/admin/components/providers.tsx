"use client";

import * as React from "react";
import { AuthProvider } from "@repo/shared-auth";
// shared-amplifyをインポートすることで自動的にAmplify設定が実行される
import "@repo/shared-amplify/config";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider 
      options={{
        enableWebSocket: false,
        appType: 'admin'
      }}
      enableDebugLogs={process.env.NODE_ENV === 'development'}
    >
      {children}
    </AuthProvider>
  );
}
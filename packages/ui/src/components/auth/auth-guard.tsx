"use client";

import { useContext } from "react";
import { AuthContext } from "./auth-provider";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((authContext: { signIn: (email: string, password: string) => Promise<unknown>; isLoading: boolean }) => React.ReactNode);
  loadingComponent?: React.ReactNode;
}

export function AuthGuard({ children, fallback, loadingComponent }: AuthGuardProps) {
  const context = useContext(AuthContext);
  
  // AuthProviderが存在しない場合の処理
  if (context === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-xl font-medium text-red-600">認証システムエラー</div>
          <div className="text-sm text-muted-foreground">AuthProviderが見つかりません</div>
        </div>
      </div>
    );
  }
  
  const { isAuthenticated, isLoading } = context;

  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="text-lg font-medium">認証情報を確認中...</div>
          <div className="text-sm text-muted-foreground">しばらくお待ちください</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      if (typeof fallback === 'function') {
        return <>{fallback({ signIn: context.signIn, isLoading: context.isLoading })}</>;
      }
      return <>{fallback}</>;
    }

    // デフォルトの未認証表示
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-xl font-medium">認証が必要です</div>
          <div className="text-sm text-muted-foreground">ログインしてください</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
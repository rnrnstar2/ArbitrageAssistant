"use client";

import { Header } from "./header";
import { useAuth } from "@repo/shared-auth";
import { AuthContainer } from "@repo/ui/components/auth";
import { Loader2 } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isAuthenticated, isLoading, signIn } = useAuth();

  if (isLoading) {
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
    return (
      <AuthContainer
        loginTitle="管理者ログイン"
        loginDescription="Arbitrage Assistant 管理画面にログインしてください"
        emailPlaceholder="admin@example.com"
        signUpTitle="管理者アカウント作成"
        signUpDescription="新しい管理者アカウントを作成してください"
        enableSignUp={true}
        enableForgotPassword={true}
        signIn={signIn}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
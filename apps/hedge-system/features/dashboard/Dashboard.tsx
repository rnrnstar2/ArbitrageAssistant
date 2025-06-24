"use client";

import React from 'react';
import { SystemProvider } from './context/SystemContext';
import { MinimalSystemOverview } from './components/MinimalSystemOverview';
import { DashboardProps } from './types';
import { useAuth } from '@repo/shared-auth';
import { AuthContainer } from '@repo/ui/components/auth';
import { Loader2 } from 'lucide-react';

function DashboardContent({ className }: DashboardProps) {
  return (
    <SystemProvider>
      <div className={`min-h-screen bg-gray-50 ${className || ''}`}>
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4">
              <h1 className="text-xl font-bold text-gray-900">
                Hedge System Monitor
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                ポジション管理型自動取引システム - リアルタイム監視
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <MinimalSystemOverview />
        </div>
      </div>
    </SystemProvider>
  );
}

export function Dashboard(props: DashboardProps) {
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
        loginTitle="Hedge System"
        loginDescription="Hedge System にログインしてください"
        emailPlaceholder="user@example.com"
        enableSignUp={false}
        enableForgotPassword={true}
        signIn={signIn}
        isLoading={isLoading}
      />
    );
  }

  return <DashboardContent {...props} />;
}
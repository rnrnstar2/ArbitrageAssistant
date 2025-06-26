"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { useAuth } from "@repo/shared-auth";
import { AuthContainer } from "@repo/ui/components/auth";
import { 
  Loader2, 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  Zap, 
  Settings, 
  Menu,
  X,
  ChevronRight,
  Home
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  description?: string;
}

const navigation: NavigationItem[] = [
  { 
    name: 'ダッシュボード', 
    href: '/dashboard', 
    icon: LayoutDashboard,
    description: 'システム概要とリアルタイム監視'
  },
  { 
    name: 'アカウント管理', 
    href: '/accounts', 
    icon: Users,
    description: 'MT4/MT5口座とクレジット管理'
  },
  { 
    name: 'ポジション管理', 
    href: '/positions', 
    icon: TrendingUp,
    description: '両建てポジションとトレール設定'
  },
  { 
    name: 'アクション管理', 
    href: '/actions', 
    icon: Zap,
    description: '実行待ちアクションと履歴'
  },
  { 
    name: 'クライアント監視', 
    href: '/clients', 
    icon: Users,
    description: 'Hedge System接続状況'
  },
];

/**
 * NavigationLayout - MVPシステム設計書準拠
 * サイドバーナビゲーション、ブレッドクラム、ユーザーメニュー
 */
function NavigationLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // Breadcrumb生成
  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'ホーム', href: '/', icon: Home }];
    
    let path = '';
    segments.forEach((segment) => {
      path += `/${segment}`;
      const navItem = navigation.find(item => item.href === path);
      if (navItem) {
        breadcrumbs.push({
          name: navItem.name,
          href: path,
          icon: navItem.icon
        });
      }
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AA</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">ArbitrageAssistant</h1>
                <p className="text-xs text-muted-foreground">管理コンソール</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-blue-700" : "text-gray-500"
                      )} />
                      <span className="flex-1">{item.name}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                    {item.description && (
                      <p className="px-3 py-1 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || 'Unknown User'}
                </p>
                <p className="text-xs text-muted-foreground">管理者</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut()}
            >
              ログアウト
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Breadcrumb */}
              <nav className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center space-x-2">
                    {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div className="flex items-center space-x-1">
                      <crumb.icon className="h-4 w-4 text-muted-foreground" />
                      <Link
                        href={crumb.href}
                        className={cn(
                          "hover:text-blue-600 transition-colors",
                          index === breadcrumbs.length - 1 
                            ? "text-gray-900 font-medium" 
                            : "text-muted-foreground"
                        )}
                      >
                        {crumb.name}
                      </Link>
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Header actions */}
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="hidden sm:inline-flex">
                オンライン
              </Badge>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
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

  return <NavigationLayout>{children}</NavigationLayout>;
}
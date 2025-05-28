"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, FileText, Settings, LogOut } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@repo/ui/components/ui/navigation-menu";
import { useAuth } from "@/hooks/useAuth";
import "./globals.css";

interface MenuItem {
  title: string;
  href: string;
}

interface NavigationProps {
  children: React.ReactNode;
}
export function NavigationLayout({ children }: NavigationProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const menuItems: MenuItem[] = [
    { title: "ホーム", href: "/" },
    { title: "ドキュメント", href: "/documents" },
    { title: "分析", href: "/analytics" },
    { title: "設定", href: "/settings" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header/Menu Bar */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background text-accent-foreground px-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <span>Hedge System</span>
        </div>

        <nav className="flex-1">
          <NavigationMenu>
            <NavigationMenuList className="flex gap-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <NavigationMenuItem key={item.href}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={item.href}
                        className={`px-3 py-2 rounded-lg ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-primary/5"
                        }`}
                      >
                        {isActive ? <strong>{item.title}</strong> : item.title}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:cursor-pointer"
              >
                <Avatar className="h-7 w-7 rounded-full ring-2 ring-background">
                  <AvatarImage src="/placeholder.png" alt="avatar" />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user?.signInDetails?.loginId?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-50 w-56 overflow-hidden rounded-xl border bg-background p-0"
            >
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-full border-2 border-primary/10">
                    <AvatarImage src="/placeholder.png" alt="avatar" />
                    <AvatarFallback className="bg-primary/5 text-primary">
                      {user?.signInDetails?.loginId?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {user?.signInDetails?.loginId || "ユーザー"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user?.signInDetails?.loginId || ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-1">
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  プロフィール
                </DropdownMenuItem>
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  ドキュメント
                </DropdownMenuItem>
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  設定
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="p-1">
                <DropdownMenuItem 
                  onClick={signOut}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  ログアウト
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}

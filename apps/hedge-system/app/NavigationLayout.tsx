"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User, FileText, Settings, LogOut } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@repo/ui/components/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "@repo/ui/components/sheet";
import "./globals.css";

interface MenuItem {
  title: string;
  href: string;
}

interface NavigationProps {
  children: React.ReactNode;
}
export function NavigationLayout({ children }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

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
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">メニュー切替</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:hidden">
            <nav className="grid gap-2 text-lg font-medium">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:text-primary"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {isActive ? `▶ ${item.title}` : item.title}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 font-semibold">
          <span>Template</span>
        </div>

        <nav className="hidden flex-1 sm:block">
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

        <div className="flex-1 sm:hidden"></div>

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
                    Name
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
                      Name
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">名前</span>
                    <span className="text-xs text-muted-foreground">
                      example@gmail.com
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
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50">
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

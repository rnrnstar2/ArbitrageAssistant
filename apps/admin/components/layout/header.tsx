"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@repo/ui/components/auth";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@repo/ui/components/ui/navigation-menu";
import { User, Settings, LogOut, Menu } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const navigationItems = [
  {
    title: "ダッシュボード",
    href: "/dashboard",
  },
  {
    title: "口座管理",
    href: "/clients",
  },
  {
    title: "ポジション",
    href: "/positions",
  },
  {
    title: "アクション",
    href: "/actions",
  },
];

export function Header() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-6">
        {/* Brand */}
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="mr-8 transition-opacity hover:opacity-80"
          >
            <span className="text-xl font-bold tracking-tight">ArbitrageAssistant</span>
          </Link>
        </div>

        {/* Navigation - Desktop */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {navigationItems.map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild>
                  <Link 
                    href={item.href}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "h-9 px-4 py-2 text-sm font-medium transition-colors",
                      pathname === item.href 
                        ? "bg-accent text-accent-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.title}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-9 px-3 gap-2 data-[state=open]:bg-accent"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-muted">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm hidden sm:inline-block">
                  {(user as { signInDetails?: { loginId?: string } })?.signInDetails?.loginId?.split("@")[0] || "管理者"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">管理者アカウント</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {(user as { signInDetails?: { loginId?: string } })?.signInDetails?.loginId || "admin@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                設定
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">メニュー</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navigationItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link 
                      href={item.href} 
                      className={cn(
                        "w-full cursor-pointer",
                        pathname === item.href && "bg-accent text-accent-foreground"
                      )}
                    >
                      {item.title}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
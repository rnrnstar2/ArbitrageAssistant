// "use client";
import * as React from "react";
// import Link from "next/link";
// import { Menu } from "lucide-react";
// import { Button } from "@repo/ui/components/button";
// import {
//   Avatar,
//   AvatarFallback,
//   AvatarImage,
// } from "@repo/ui/components/avatar";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@repo/ui/components/dropdown-menu";
// import { Sheet, SheetContent, SheetTrigger } from "@repo/ui/components/sheet";
// import "./globals.css";

// interface MenuItem {
//   title: string;
//   href: string;
// }

interface TemplateProps {
  children: React.ReactNode;
}
export function RootTemplate({ children }: TemplateProps) {
  // const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // const menuItems: MenuItem[] = [
  //   { title: "ホーム", href: "/" },
  //   { title: "ドキュメント", href: "/documents" },
  //   { title: "分析", href: "/analytics" },
  //   { title: "設定", href: "/settings" },
  // ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header/Menu Bar */}
      {/* <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">メニュー切替</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:hidden">
            <nav className="grid gap-2 text-lg font-medium">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-2 py-1 hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 font-semibold">
          <span>あああ</span>
        </div>

        <nav className="hidden flex-1 sm:block">
          <ul className="flex gap-4">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm font-medium hover:text-primary"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 sm:hidden"></div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={"/placeholder.svg"} alt="placeholder" />
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>アカウント</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>プロフィール</DropdownMenuItem>
            <DropdownMenuItem>設定</DropdownMenuItem>
            <DropdownMenuItem>サポート</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>ログアウト</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header> */}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Monitor, 
  TrendingUp,
  LogOut
} from "lucide-react";
import { useAuth } from "@repo/ui/components/auth";
import { Button } from "@repo/ui/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "ダッシュボード",
    icon: LayoutDashboard,
  },
  {
    href: "/clients",
    label: "口座管理",
    icon: Monitor,
  },
  {
    href: "/trading",
    label: "取引操作",
    icon: TrendingUp,
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <nav className="w-64 bg-white shadow-sm border-r">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">
          Arbitrage Assistant
        </h1>
        <p className="text-sm text-gray-500 mt-1">管理画面</p>
      </div>
      
      <div className="px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      
      <div className="absolute bottom-0 w-64 p-3 border-t">
        <Button
          variant="ghost"
          onClick={() => signOut()}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="mr-3 h-5 w-5" />
          ログアウト
        </Button>
      </div>
    </nav>
  );
}
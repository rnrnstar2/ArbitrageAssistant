"use client";

import { User, LogOut } from 'lucide-react';
import { useAuth } from '@repo/ui/components/auth';

export function SystemHeader() {
  const { user, signOut } = useAuth();

  return (
    <div className="h-10 bg-a8-primary flex items-center justify-between px-4 text-white font-medium shadow-md">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
        <span className="text-sm">HEDGE SYSTEM</span>
        <span className="text-xs opacity-80">EA監視コンソール</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs bg-white/10 px-2 py-1 rounded">
          <User className="w-3 h-3" />
          <span>{(user as any)?.signInDetails?.loginId || "ユーザー"}</span>
        </div>
        <button
          onClick={signOut}
          className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded transition-colors"
          title="ログアウト"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
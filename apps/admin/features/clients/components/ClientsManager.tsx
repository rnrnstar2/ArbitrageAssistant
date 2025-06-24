"use client";

import { AccountManager } from "../../accounts/components/AccountManager";

export const ClientsManager = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">口座管理</h1>
      </div>
      
      <AccountManager />
    </div>
  );
};
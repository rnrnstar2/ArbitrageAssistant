"use client";

import type { Account } from "../hooks/useAccounts";

interface AccountListProps {
  accounts: Account[];
}

export function AccountList({ accounts }: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">利用可能なアカウントがありません</p>
        <p className="text-sm text-gray-400 mt-2">
          まずクライアントPCを接続してアカウントを登録してください
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 border">
      <h3 className="text-lg font-semibold mb-4">アカウント一覧</h3>
      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
          >
            <div>
              <div className="font-medium">
                {account.broker} - {account.accountNumber}
              </div>
              <div className="text-sm text-gray-600">
                残高: ${account.balance.toFixed(2)} | 
                ボーナス: ${(account.bonusAmount || 0).toFixed(2)} | 
                有効証拠金: ${account.equity.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              {account.marginLevel && (
                <div className="text-sm">
                  証拠金維持率: {account.marginLevel.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
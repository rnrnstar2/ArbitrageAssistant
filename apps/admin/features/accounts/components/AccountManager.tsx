'use client';

import React, { useState } from 'react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Account, UpdateAccountInput } from '@repo/shared-types';
import { StatCard, StatusBadge } from '../../../components/common';

interface AccountManagerProps {
  accounts: Account[];
  onUpdateAccount: (input: UpdateAccountInput) => Promise<void>;
  onCreateAccount?: (input: any) => Promise<void>;
  onDeleteAccount?: (accountId: string) => Promise<void>;
  onToggleConnection?: (accountId: string) => Promise<void>;
}

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(value);
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ja-JP');
};

export const AccountManager: React.FC<AccountManagerProps> = ({
  accounts,
  onUpdateAccount,
  onCreateAccount,
  onDeleteAccount,
  onToggleConnection
}) => {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const handleConnection = async (accountId: string) => {
    if (onToggleConnection) {
      await onToggleConnection(accountId);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (onDeleteAccount && confirm('この口座を削除しますか？')) {
      await onDeleteAccount(accountId);
    }
  };

  return (
    <div className="space-y-6">
      {/* 口座統計 */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard 
          title="総口座数" 
          value={accounts.length}
          color="blue"
        />
        <StatCard 
          title="接続中" 
          value={accounts.filter(acc => acc.isConnected).length}
          color="green"
        />
        <StatCard 
          title="総残高" 
          value={accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)}
          format="currency"
          color="purple"
        />
        <StatCard 
          title="有効証拠金" 
          value={accounts.reduce((sum, acc) => sum + (acc.equity || 0), 0)}
          format="currency"
          color="orange"
        />
      </div>

      {/* 口座管理操作 */}
      <Card>
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">口座管理</h3>
          {onCreateAccount && (
            <Button onClick={() => onCreateAccount({})}>
              新しい口座を追加
            </Button>
          )}
        </div>
      </Card>

      {/* 口座一覧 */}
      <Card>
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">口座一覧</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">表示名</th>
                <th className="px-6 py-3 text-left">口座番号</th>
                <th className="px-6 py-3 text-left">ブローカー</th>
                <th className="px-6 py-3 text-left">残高</th>
                <th className="px-6 py-3 text-left">クレジット</th>
                <th className="px-6 py-3 text-left">証拠金</th>
                <th className="px-6 py-3 text-left">接続状態</th>
                <th className="px-6 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => (
                <tr key={account.id} className="border-t">
                  <td className="px-6 py-4 font-medium">{account.displayName}</td>
                  <td className="px-6 py-4 text-sm">{account.accountNumber}</td>
                  <td className="px-6 py-4 text-sm">{account.brokerType}</td>
                  <td className="px-6 py-4">{formatCurrency(account.balance)}</td>
                  <td className="px-6 py-4">{formatCurrency(account.credit)}</td>
                  <td className="px-6 py-4">{formatCurrency(account.equity)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={account.isConnected ? 'CONNECTED' : 'DISCONNECTED'} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={account.isConnected ? "outline" : "default"}
                        onClick={() => handleConnection(account.id)}
                      >
                        {account.isConnected ? '切断' : '接続'}
                      </Button>
                      {onDeleteAccount && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDelete(account.id)}
                        >
                          削除
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Badge } from '@repo/ui/components/ui/badge';
import { Plus } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';

interface CreateAccountInput {
  brokerType: string;
  accountNumber: string;
  serverName: string;
  displayName: string;
}

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(value);
};

const CreateAccountDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAccountInput) => Promise<void>;
}> = ({ open, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateAccountInput>({
    brokerType: '',
    accountNumber: '',
    serverName: '',
    displayName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({
        brokerType: '',
        accountNumber: '',
        serverName: '',
        displayName: ''
      });
      onClose();
    } catch (error) {
      console.error('Failed to create account:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border shadow-lg">
        <DialogHeader>
          <DialogTitle>新しい口座を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="displayName">表示名</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="brokerType">ブローカー</Label>
            <Input
              id="brokerType"
              value={formData.brokerType}
              onChange={(e) => setFormData({ ...formData, brokerType: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">口座番号</Label>
            <Input
              id="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="serverName">サーバー名</Label>
            <Input
              id="serverName"
              value={formData.serverName}
              onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '作成中...' : '作成'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AccountTable: React.FC<{
  accounts: any[];
  onUpdate: (accountId: string, updates: any) => Promise<void>;
}> = ({ accounts, onUpdate }) => {
  const handleToggleActive = async (accountId: string, isActive: boolean) => {
    try {
      await onUpdate(accountId, { isActive: !isActive });
    } catch (error) {
      console.error('Failed to update account status:', error);
    }
  };

  return (
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
            <th className="px-6 py-3 text-left">状態</th>
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
                <Badge variant={account.isActive ? "default" : "secondary"}>
                  {account.isActive ? 'アクティブ' : '非アクティブ'}
                </Badge>
              </td>
              <td className="px-6 py-4">
                <Button 
                  size="sm" 
                  variant={account.isActive ? "outline" : "default"}
                  onClick={() => handleToggleActive(account.id, account.isActive)}
                >
                  {account.isActive ? '無効化' : '有効化'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AccountManager: React.FC = () => {
  const { accounts, loading, error, createAccount, updateAccount } = useAccounts();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateAccount = async (data: CreateAccountInput) => {
    try {
      await createAccount(data);
      console.log('口座を作成しました');
    } catch (error) {
      console.error('口座の作成に失敗しました:', error);
    }
  };

  // デバッグ情報表示
  console.log('AccountManager state:', { loading, error, accountsCount: accounts.length });

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">エラーが発生しました</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-red-600">{error.message}</p>
              <p className="text-xs text-gray-500">
                ブラウザの開発者ツール（F12）→ Consoleタブでより詳細な情報を確認できます
              </p>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                ページを再読み込み
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>口座管理</CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              口座追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>読み込み中...</div>
          ) : (
            <AccountTable 
              accounts={accounts} 
              onUpdate={updateAccount}
            />
          )}
        </CardContent>
      </Card>

      {/* Account作成ダイアログ */}
      <CreateAccountDialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateAccount}
      />
    </div>
  );
};
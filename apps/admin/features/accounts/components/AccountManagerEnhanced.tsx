'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Badge } from '@repo/ui/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { Plus, RefreshCw, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle, Trash2, Edit } from 'lucide-react';
import { useAccountsWithRealtime } from '../hooks/useAccountsWithRealtime';

interface CreateAccountInput {
  brokerType: string;
  accountNumber: string;
  serverName: string;
  displayName: string;
  balance?: number;
  credit?: number;
}

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null) return '¥0';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(value);
};

const formatPercentage = (value: number) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
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
    displayName: '',
    balance: 0,
    credit: 0
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
        displayName: '',
        balance: 0,
        credit: 0
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="balance">初期残高</Label>
              <Input
                id="balance"
                type="number"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="credit">初期クレジット</Label>
              <Input
                id="credit"
                type="number"
                value={formData.credit}
                onChange={(e) => setFormData({ ...formData, credit: parseFloat(e.target.value) || 0 })}
              />
            </div>
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

const EditAccountDialog: React.FC<{
  account: any;
  open: boolean;
  onClose: () => void;
  onSubmit: (accountId: string, updates: any) => Promise<void>;
}> = ({ account, open, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    displayName: account?.displayName || '',
    balance: account?.balance || 0,
    credit: account?.credit || 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(account.id, formData);
      onClose();
    } catch (error) {
      console.error('Failed to update account:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border shadow-lg">
        <DialogHeader>
          <DialogTitle>口座情報を編集</DialogTitle>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="balance">残高</Label>
              <Input
                id="balance"
                type="number"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="credit">クレジット</Label>
              <Input
                id="credit"
                type="number"
                value={formData.credit}
                onChange={(e) => setFormData({ ...formData, credit: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '更新中...' : '更新'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AccountDetailsCard: React.FC<{ account: any }> = ({ account }) => {
  const creditUtilization = account.credit > 0 ? (account.balance / account.credit) : 0;
  const isHighUtilization = creditUtilization > 0.8;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{account.displayName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {account.brokerType} - {account.accountNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={account.isActive ? "default" : "secondary"}>
              {account.isActive ? 'アクティブ' : '非アクティブ'}
            </Badge>
            {account.lastUpdated && (
              <Badge variant="outline" className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                {new Date(account.lastUpdated).toLocaleTimeString('ja-JP')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">残高</p>
            <p className="text-xl font-semibold">{formatCurrency(account.balance)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">クレジット</p>
            <p className="text-xl font-semibold text-blue-600">{formatCurrency(account.credit)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">証拠金</p>
            <p className="text-xl font-semibold">{formatCurrency(account.equity)}</p>
          </div>
        </div>
        
        {account.credit > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-muted-foreground">クレジット活用率</p>
              <p className={`text-sm font-medium ${isHighUtilization ? 'text-red-600' : 'text-green-600'}`}>
                {formatPercentage(creditUtilization)}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  isHighUtilization ? 'bg-red-600' : 'bg-green-600'
                }`}
                style={{ width: `${Math.min(creditUtilization * 100, 100)}%` }}
              />
            </div>
            {isHighUtilization && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  クレジット活用率が高くなっています。リスク管理にご注意ください。
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CreditHistoryMock: React.FC<{ accountId: string }> = ({ accountId }) => {
  // Mock credit history data
  const mockHistory = [
    { date: '2025-01-28 10:00', credit: 500000, change: 50000, type: 'increase' },
    { date: '2025-01-27 15:30', credit: 450000, change: -20000, type: 'decrease' },
    { date: '2025-01-26 09:00', credit: 470000, change: 0, type: 'stable' },
    { date: '2025-01-25 14:00', credit: 470000, change: 100000, type: 'increase' },
    { date: '2025-01-24 11:00', credit: 370000, change: 0, type: 'stable' },
  ];

  return (
    <div className="space-y-2">
      {mockHistory.map((item, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              item.type === 'increase' ? 'bg-green-100' : 
              item.type === 'decrease' ? 'bg-red-100' : 
              'bg-gray-100'
            }`}>
              {item.type === 'increase' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : item.type === 'decrease' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (
                <div className="h-4 w-4 rounded-full bg-gray-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{formatCurrency(item.credit)}</p>
              <p className="text-xs text-muted-foreground">{item.date}</p>
            </div>
          </div>
          {item.change !== 0 && (
            <Badge variant={item.type === 'increase' ? 'default' : 'destructive'}>
              {item.type === 'increase' ? '+' : ''}{formatCurrency(Math.abs(item.change))}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
};

export const AccountManagerEnhanced: React.FC = () => {
  const { 
    accounts, 
    loading, 
    error, 
    createAccount, 
    updateAccount, 
    deleteAccount,
    refreshAccounts,
    isRealtime 
  } = useAccountsWithRealtime();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCreateAccount = async (data: CreateAccountInput) => {
    try {
      await createAccount(data);
      console.log('口座を作成しました');
    } catch (error) {
      console.error('口座の作成に失敗しました:', error);
      throw error;
    }
  };

  const handleUpdateAccount = async (accountId: string, updates: any) => {
    try {
      await updateAccount(accountId, updates);
      console.log('口座を更新しました');
    } catch (error) {
      console.error('口座の更新に失敗しました:', error);
      throw error;
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (confirm('この口座を削除してもよろしいですか？')) {
      try {
        await deleteAccount(accountId);
        console.log('口座を削除しました');
      } catch (error) {
        console.error('口座の削除に失敗しました:', error);
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAccounts();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">エラーが発生しました</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error.message}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              再読み込み
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">口座管理</h1>
          <p className="text-muted-foreground">MT4/MT5口座の管理とクレジット履歴の確認</p>
        </div>
        <div className="flex items-center gap-2">
          {isRealtime && (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
              リアルタイム更新
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            口座追加
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>口座一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">読み込み中...</div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>口座が登録されていません</p>
                  <Button 
                    variant="link" 
                    onClick={() => setShowCreateDialog(true)}
                    className="mt-2"
                  >
                    最初の口座を追加
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map(account => (
                    <AccountDetailsCard key={account.id} account={account} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>口座詳細</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedAccountId ? (
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="info">基本情報</TabsTrigger>
                    <TabsTrigger value="history">クレジット履歴</TabsTrigger>
                    <TabsTrigger value="actions">操作</TabsTrigger>
                  </TabsList>
                  <TabsContent value="info" className="space-y-4">
                    {(() => {
                      const account = accounts.find(a => a.id === selectedAccountId);
                      if (!account) return null;
                      
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>ブローカー</Label>
                              <p className="font-medium">{account.brokerType}</p>
                            </div>
                            <div>
                              <Label>口座番号</Label>
                              <p className="font-medium">{account.accountNumber}</p>
                            </div>
                            <div>
                              <Label>サーバー</Label>
                              <p className="font-medium">{account.serverName}</p>
                            </div>
                            <div>
                              <Label>状態</Label>
                              <Badge variant={account.isActive ? "default" : "secondary"}>
                                {account.isActive ? 'アクティブ' : '非アクティブ'}
                              </Badge>
                            </div>
                          </div>
                          <div className="pt-4 border-t">
                            <h4 className="font-medium mb-3">財務情報</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">残高</span>
                                <span className="font-medium">{formatCurrency(account.balance)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">クレジット</span>
                                <span className="font-medium text-blue-600">{formatCurrency(account.credit)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">証拠金</span>
                                <span className="font-medium">{formatCurrency(account.equity)}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </TabsContent>
                  <TabsContent value="history">
                    <CreditHistoryMock accountId={selectedAccountId} />
                  </TabsContent>
                  <TabsContent value="actions" className="space-y-3">
                    {(() => {
                      const account = accounts.find(a => a.id === selectedAccountId);
                      if (!account) return null;
                      
                      return (
                        <>
                          <Button 
                            className="w-full"
                            variant={account.isActive ? "outline" : "default"}
                            onClick={() => handleUpdateAccount(account.id, { isActive: !account.isActive })}
                          >
                            {account.isActive ? '無効化' : '有効化'}
                          </Button>
                          <Button 
                            className="w-full"
                            variant="outline"
                            onClick={() => setEditingAccount(account)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            編集
                          </Button>
                          <Button 
                            className="w-full"
                            variant="destructive"
                            onClick={() => handleDeleteAccount(account.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </Button>
                        </>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  口座を選択してください
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>口座統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">総口座数</span>
                  <span className="font-medium text-lg">{accounts.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">アクティブ口座</span>
                  <span className="font-medium text-lg text-green-600">
                    {accounts.filter(a => a.isActive).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">総残高</span>
                  <span className="font-medium text-lg">
                    {formatCurrency(accounts.reduce((sum, a) => sum + (a.balance || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">総クレジット</span>
                  <span className="font-medium text-lg text-blue-600">
                    {formatCurrency(accounts.reduce((sum, a) => sum + (a.credit || 0), 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 口座一覧テーブル（詳細表示） */}
      <Card>
        <CardHeader>
          <CardTitle>口座詳細テーブル</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    表示名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    口座番号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ブローカー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    残高
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    クレジット
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    証拠金
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr 
                    key={account.id} 
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{account.displayName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.accountNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.brokerType}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(account.balance)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-blue-600">{formatCurrency(account.credit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(account.equity)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? 'アクティブ' : '非アクティブ'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant={account.isActive ? "outline" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateAccount(account.id, { isActive: !account.isActive });
                          }}
                        >
                          {account.isActive ? '無効化' : '有効化'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAccount(account);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAccount(account.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateAccountDialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateAccount}
      />

      {/* Edit Dialog */}
      {editingAccount && (
        <EditAccountDialog
          account={editingAccount}
          open={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          onSubmit={handleUpdateAccount}
        />
      )}
    </div>
  );
};
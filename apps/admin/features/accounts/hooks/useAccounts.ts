import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Account } from '@repo/shared-amplify/types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = useMemo(() => generateClient(), []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading accounts...');
      
      // ユーザー認証確認
      const user = await getCurrentUser();
      console.log('Current user:', { userId: user.userId, groups: user.signInDetails });
      
      // MVPシステム設計書v7.0準拠 - GSI accountsByUserIdを使用した高速クエリ
      const result = await (client as any).models.Account.listAccountByUserId({
        userId: user.userId
      });
      console.log('Account list result:', result);
      
      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors.map((e: any) => e.message).join(', ');
        console.error('GraphQL errors:', result.errors);
        throw new Error(`GraphQL Error: ${errorMsg}`);
      }
      
      // GSIから直接取得（フィルタリング不要）
      const userAccounts = result.data || [];
      
      console.log('Filtered accounts:', userAccounts);
      setAccounts(userAccounts);
      
    } catch (err) {
      console.error('Failed to load accounts:', err);
      
      // より詳細なエラーメッセージ
      if (err instanceof Error) {
        if (err.message.includes('Network')) {
          setError(new Error('ネットワーク接続の問題です'));
        } else if (err.message.includes('Unauthorized') || err.message.includes('unauthorized')) {
          setError(new Error('認証エラー: 管理者権限が必要です'));
        } else {
          setError(err);
        }
      } else {
        setError(new Error('不明なエラーが発生しました'));
      }
      
      setAccounts([]); // 安全なフォールバック
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (accountData: {
    brokerType: string;
    accountNumber: string;
    serverName: string;
    displayName: string;
  }) => {
    try {
      const user = await getCurrentUser();
      
      const result = await (client as any).models.Account.create({
        userId: user.userId,
        ...accountData,
        balance: 0,
        credit: 0,
        equity: 0,
        isActive: true
      });
      
      if (result.errors) {
        throw new Error(result.errors.map((e: any) => e.message).join(', '));
      }
      
      await loadAccounts(); // Refresh list
      return result.data;
      
    } catch (err) {
      console.error('Failed to create account:', err);
      throw err;
    }
  };

  const updateAccount = async (
    accountId: string, 
    updates: Partial<Account>
  ): Promise<void> => {
    try {
      const result = await (client as any).models.Account.update({
        id: accountId,
        ...updates
      });
      
      if (result.errors) {
        throw new Error(result.errors.map((e: any) => e.message).join(', '));
      }
      
      await loadAccounts(); // Refresh list
      
    } catch (err) {
      console.error('Failed to update account:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []); // 空の依存配列で初回のみ実行

  return {
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    refreshAccounts: loadAccounts
  };
}
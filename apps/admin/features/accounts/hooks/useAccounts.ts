import { useState, useEffect, useCallback } from 'react';
import { dummyAccounts } from '../../../lib/mock-data';
import type { Account } from '@repo/shared-types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Loading dummy accounts...');
      
      // ダミーデータ読み込み（ローディング演出）
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setAccounts(dummyAccounts);
      console.log('✅ Dummy accounts loaded:', dummyAccounts.length);
      
    } catch (err) {
      console.error('❌ Failed to load dummy accounts:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAccount = useCallback(async (accountData: {
    brokerType: string;
    accountNumber: string;
    serverName: string;
    displayName: string;
  }) => {
    try {
      console.log('📝 Creating dummy account:', accountData);
      
      // ダミー実装：新しいアカウントを一時的に追加
      const newAccount: Account = {
        id: `acc-${Date.now()}`,
        userId: 'user-1',
        ...accountData,
        balance: 0,
        credit: 0,
        equity: 0,
        isActive: true,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // 成功メッセージとしてログ出力
      console.log('✅ Dummy account created:', newAccount.id);
      
      // 実際には何もしない（ダミー）
      return newAccount;
      
    } catch (err) {
      console.error('❌ Failed to create dummy account:', err);
      throw err;
    }
  }, []);

  const updateAccount = useCallback(async (
    accountId: string, 
    updates: Partial<Account>
  ): Promise<void> => {
    try {
      console.log('📝 Updating dummy account:', accountId, updates);
      
      // ダミー実装：成功をログ出力
      console.log('✅ Dummy account updated');
      
      // 実際には何もしない（ダミー）
      
    } catch (err) {
      console.error('❌ Failed to update dummy account:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return {
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    refreshAccounts: loadAccounts
  };
}
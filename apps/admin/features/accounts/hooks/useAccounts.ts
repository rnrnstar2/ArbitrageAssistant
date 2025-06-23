import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Account } from '@repo/shared-types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = generateClient();

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await getCurrentUser();
      
      const result = await (client as any).models.Account.list({
        filter: { 
          userId: { eq: user.userId }
        }
      });
      
      if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
      }
      
      setAccounts(result.data);
      
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  const createAccount = useCallback(async (accountData: {
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
        throw new Error(result.errors.map(e => e.message).join(', '));
      }
      
      await loadAccounts(); // Refresh list
      return result.data;
      
    } catch (err) {
      console.error('Failed to create account:', err);
      throw err;
    }
  }, [client, loadAccounts]);

  const updateAccount = useCallback(async (
    accountId: string, 
    updates: Partial<Account>
  ): Promise<void> => {
    try {
      const result = await (client as any).models.Account.update({
        id: accountId,
        ...updates
      });
      
      if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
      }
      
      await loadAccounts(); // Refresh list
      
    } catch (err) {
      console.error('Failed to update account:', err);
      throw err;
    }
  }, [client, loadAccounts]);

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
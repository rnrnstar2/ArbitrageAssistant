import { useState, useEffect, useCallback } from 'react';
import { useAccounts as useAmplifyAccounts } from '@repo/shared-amplify/hooks';
import { subscriptionService } from '@repo/shared-amplify/services';
import { accountService } from '@repo/shared-amplify/services';
import type { Account, CreateAccountInput } from '@repo/shared-types';

export function useAccountsWithRealtime() {
  const { accounts: amplifyAccounts, loading: amplifyLoading, error: amplifyError, refresh } = useAmplifyAccounts();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(amplifyAccounts);
  }, [amplifyAccounts]);

  useEffect(() => {
    setLoading(amplifyLoading);
  }, [amplifyLoading]);

  useEffect(() => {
    setError(amplifyError);
  }, [amplifyError]);

  // Set up real-time subscription
  useEffect(() => {
    let subscriptionIdLocal: string | null = null;

    const setupSubscription = async () => {
      try {
        console.log('📡 Setting up account subscription...');
        
        const id = await subscriptionService.subscribeToAccounts((updatedAccount) => {
          console.log('📊 Account update received:', updatedAccount);
          
          setAccounts(prevAccounts => {
            const existingIndex = prevAccounts.findIndex(acc => acc.id === updatedAccount.id);
            
            if (existingIndex >= 0) {
              // Update existing account
              const newAccounts = [...prevAccounts];
              newAccounts[existingIndex] = updatedAccount;
              return newAccounts;
            } else {
              // Add new account
              return [...prevAccounts, updatedAccount];
            }
          });
        });

        subscriptionIdLocal = id;
        setSubscriptionId(id);
        console.log('✅ Account subscription established:', id);
      } catch (error) {
        console.error('❌ Failed to setup account subscription:', error);
      }
    };

    if (!amplifyLoading && !amplifyError) {
      setupSubscription();
    }

    return () => {
      if (subscriptionIdLocal) {
        console.log('🔄 Cleaning up account subscription:', subscriptionIdLocal);
        subscriptionService.unsubscribe(subscriptionIdLocal);
      }
    };
  }, [amplifyLoading, amplifyError]);

  const createAccount = useCallback(async (accountData: Omit<CreateAccountInput, 'userId'>) => {
    try {
      console.log('📝 Creating account:', accountData);
      const newAccount = await accountService.createAccount(accountData);
      console.log('✅ Account created:', newAccount);
      
      // Refresh the list to ensure consistency
      await refresh();
      
      return newAccount;
    } catch (error) {
      console.error('❌ Failed to create account:', error);
      throw error;
    }
  }, [refresh]);

  const updateAccount = useCallback(async (accountId: string, updates: Partial<Account>) => {
    try {
      console.log('📝 Updating account:', accountId, updates);
      
      // Convert Account updates to UpdateAccountInput format
      const updateInput: any = {};
      if (updates.balance !== undefined) updateInput.balance = updates.balance ?? undefined;
      if (updates.credit !== undefined) updateInput.credit = updates.credit ?? undefined;
      if (updates.equity !== undefined) updateInput.equity = updates.equity ?? undefined;
      if (updates.isActive !== undefined) updateInput.isActive = updates.isActive ?? undefined;
      if (updates.displayName !== undefined) updateInput.displayName = updates.displayName;
      
      const updatedAccount = await accountService.updateAccount(accountId, updateInput);
      console.log('✅ Account updated:', updatedAccount);
      
      // Update local state immediately for better UX
      setAccounts(prevAccounts => 
        prevAccounts.map(acc => 
          acc.id === accountId ? { ...acc, ...updates } : acc
        )
      );
      
      return updatedAccount;
    } catch (error) {
      console.error('❌ Failed to update account:', error);
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (accountId: string) => {
    try {
      console.log('🗑️ Deleting account:', accountId);
      const success = await accountService.deleteAccount(accountId);
      
      if (success) {
        console.log('✅ Account deleted:', accountId);
        
        // Update local state immediately
        setAccounts(prevAccounts => 
          prevAccounts.filter(acc => acc.id !== accountId)
        );
        
        // Refresh to ensure consistency
        await refresh();
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to delete account:', error);
      throw error;
    }
  }, [refresh]);

  const refreshAccounts = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    deleteAccount,
    refreshAccounts,
    isRealtime: !!subscriptionId
  };
}
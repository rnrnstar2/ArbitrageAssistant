/**
 * useAccounts Hook - 口座一覧取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { AccountService } from '../services/account';
import type { Account, AccountFilters } from '../types';

const accountService = new AccountService();

export function useAccounts(filters?: AccountFilters) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await accountService.listUserAccounts(filters);
      setAccounts(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const refresh = useCallback(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { 
    accounts, 
    loading, 
    error, 
    refresh 
  };
}
/**
 * useAccount Hook - 単一口座取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { AccountService } from '../services/account';
import type { Account } from '../types';

const accountService = new AccountService();

export function useAccount(id: string | null) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!id) {
      setAccount(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await accountService.getAccount(id);
      setAccount(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const refresh = useCallback(() => {
    fetchAccount();
  }, [fetchAccount]);

  return { 
    account, 
    loading, 
    error, 
    refresh 
  };
}
/**
 * useCreditUtilization Hook - 信用利用率監視
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { AccountService } from '../services/account';
import type { CreditUtilization } from '../types';

const accountService = new AccountService();

export function useCreditUtilization(accountId?: string) {
  const [creditUtilization, setCreditUtilization] = useState<CreditUtilization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCreditUtilization = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await accountService.calculateCreditUtilization(accountId);
      setCreditUtilization(Array.isArray(result) ? result : [result]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchCreditUtilization();
  }, [fetchCreditUtilization]);

  const refresh = useCallback(() => {
    fetchCreditUtilization();
  }, [fetchCreditUtilization]);

  return { 
    creditUtilization, 
    loading, 
    error, 
    refresh 
  };
}
/**
 * useUserStatus Hook - ユーザー状態監視
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { UserService } from '../services/user';
import { getCurrentUserId } from '../client';
import type { User, PCStatus } from '../types';

const userService = new UserService();

export function useUserStatus() {
  const [userStatus, setUserStatus] = useState<Pick<User, 'pcStatus' | 'isActive'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = await getCurrentUserId();
      const result = await userService.getUser(userId);
      if (result) {
        setUserStatus({
          pcStatus: result.pcStatus,
          isActive: result.isActive
        });
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (pcStatus: PCStatus) => {
    try {
      setError(null);
      await userService.updatePCStatus(pcStatus);
      // ステータス更新後に再取得
      await fetchUserStatus();
    } catch (err) {
      setError(err as Error);
    }
  }, [fetchUserStatus]);

  useEffect(() => {
    fetchUserStatus();
  }, [fetchUserStatus]);

  const refresh = useCallback(() => {
    fetchUserStatus();
  }, [fetchUserStatus]);

  return { 
    userStatus, 
    loading, 
    error, 
    refresh,
    updateStatus
  };
}
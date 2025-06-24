/**
 * useCurrentUser Hook - 現在ユーザー取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { UserService } from '../services/user';
import { getCurrentUserId } from '../client';
import type { User } from '../types';

const userService = new UserService();

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = await getCurrentUserId();
      const result = await userService.getUser(userId);
      setCurrentUser(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const refresh = useCallback(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return { 
    currentUser, 
    loading, 
    error, 
    refresh 
  };
}
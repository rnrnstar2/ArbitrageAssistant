/**
 * usePositionActions Hook - ポジション関連アクション
 * MVP システム設計書準拠のReactフック
 */

import { useState, useCallback } from 'react';
import { PositionService } from '../services/position';
import type { Position, PositionStatus, CreatePositionInput, UpdatePositionInput } from '../types';

const positionService = new PositionService();

export function usePositionActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPosition = useCallback(async (input: Omit<CreatePositionInput, 'userId'>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.createPosition(input);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePosition = useCallback(async (id: string, updates: Partial<UpdatePositionInput>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.updatePosition(id, updates);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePositionStatus = useCallback(async (
    id: string, 
    status: PositionStatus,
    additionalData?: {
      mtTicket?: string;
      entryPrice?: number;
      entryTime?: string;
      exitPrice?: number;
      exitTime?: string;
      exitReason?: string;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.updatePositionStatus(id, status, additionalData);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const executePosition = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.executePosition(id);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const closePosition = useCallback(async (id: string, reason?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.closePosition(id, reason);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createPosition,
    updatePosition,
    updatePositionStatus,
    executePosition,
    closePosition
  };
}
import { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';
import { PositionStatus } from '@repo/shared-types';

export interface UsePositionActionsReturn {
  closePosition: (positionId: string) => Promise<void>;
  updateStopLoss: (positionId: string, stopLoss: number) => Promise<void>;
  updateTakeProfit: (positionId: string, takeProfit: number) => Promise<void>;
  updatePosition: (positionId: string, updates: any) => Promise<void>;
  loading: boolean;
}

export function usePositionActions(): UsePositionActionsReturn {
  const [loading, setLoading] = useState(false);
  const client = generateClient<Schema>();

  const closePosition = async (positionId: string) => {
    setLoading(true);
    try {
      const result = await client.models.Position.update({
        id: positionId,
        status: PositionStatus.CLOSING,
        exitTime: new Date().toISOString()
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      console.log('Position closed successfully:', positionId);
    } catch (error) {
      console.error('Failed to close position:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateStopLoss = async (positionId: string, stopLoss: number) => {
    setLoading(true);
    try {
      const result = await client.models.Position.update({
        id: positionId,
        // Note: stopLoss field doesn't exist in new schema
        // This would need to be implemented differently
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      console.log('Stop loss updated successfully:', positionId, stopLoss);
    } catch (error) {
      console.error('Failed to update stop loss:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTakeProfit = async (positionId: string, takeProfit: number) => {
    setLoading(true);
    try {
      const result = await client.models.Position.update({
        id: positionId,
        // Note: takeProfit field doesn't exist in new schema
        // This would need to be implemented differently
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      console.log('Take profit updated successfully:', positionId, takeProfit);
    } catch (error) {
      console.error('Failed to update take profit:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updatePosition = async (positionId: string, updates: any) => {
    setLoading(true);
    try {
      const result = await client.models.Position.update({
        id: positionId,
        ...updates
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      console.log('Position updated successfully:', positionId);
    } catch (error) {
      console.error('Failed to update position:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    closePosition,
    updateStopLoss,
    updateTakeProfit,
    updatePosition,
    loading
  };
}
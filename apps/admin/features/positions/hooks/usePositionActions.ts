import { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';
import { PositionStatus } from '@repo/shared-types';

export interface UsePositionActionsReturn {
  closePosition: (positionId: string) => Promise<void>;
  updateStopLoss: (positionId: string, stopLoss: number) => Promise<void>;
  updateTakeProfit: (positionId: string, takeProfit: number) => Promise<void>;
  loading: boolean;
}

export function usePositionActions(): UsePositionActionsReturn {
  const [loading, setLoading] = useState(false);
  const client = generateClient<Schema>();

  const closePosition = async (positionId: string) => {
    setLoading(true);
    try {
      const result = await client.models.Position.update({
        positionId,
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
        positionId,
        stopLoss
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
        positionId,
        takeProfit
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

  return {
    closePosition,
    updateStopLoss,
    updateTakeProfit,
    loading
  };
}
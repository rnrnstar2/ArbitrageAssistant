/**
 * useHedgeAnalysis Hook - ヘッジ分析データ
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { PositionService } from '../services/position';
import { AccountService } from '../services/account';
import type { HedgeAnalysis } from '../types';

const positionService = new PositionService();
const accountService = new AccountService();

export function useHedgeAnalysis(accountId?: string) {
  const [hedgeAnalysis, setHedgeAnalysis] = useState<HedgeAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHedgeAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const accounts = await accountService.listUserAccounts();
      const targetAccounts = accountId ? accounts.filter(acc => acc.id === accountId) : accounts;
      
      const analysisResults = await Promise.all(
        targetAccounts.map(async (account) => {
          const [positions, netPositions, creditUtilization] = await Promise.all([
            positionService.listUserPositions({ accountId: account.id }),
            positionService.calculateNetPositions(account.id),
            accountService.calculateCreditUtilization(account.id)
          ]);
          
          const openPositions = positions.filter(p => p.status === 'OPEN');
          const trailPositions = positions.filter(p => p.trailWidth && p.trailWidth > 0);
          
          // リスクスコア計算（簡易版）
          const totalVolume = openPositions.reduce((sum, pos) => sum + (pos.volume || 0), 0);
          const riskScore = Math.min(100, (totalVolume / 10) * 20); // 例: 10ロットで20%リスク
          
          return {
            accountId: account.id,
            netPositions,
            totalPositions: positions,
            openPositions,
            trailPositions,
            creditUtilization: Array.isArray(creditUtilization) ? 
              creditUtilization[0]?.creditRatio || 0 : 
              creditUtilization.creditRatio || 0,
            riskScore
          };
        })
      );
      
      setHedgeAnalysis(analysisResults);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchHedgeAnalysis();
  }, [fetchHedgeAnalysis]);

  const refresh = useCallback(() => {
    fetchHedgeAnalysis();
  }, [fetchHedgeAnalysis]);

  return { 
    hedgeAnalysis, 
    loading, 
    error, 
    refresh 
  };
}
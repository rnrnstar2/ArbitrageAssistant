/**
 * useDashboardData Hook - ダッシュボード統合データ
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { PositionService } from '../services/position';
import { ActionService } from '../services/action';
import { AccountService } from '../services/account';
import type { Position, Action, Account } from '../types';

const positionService = new PositionService();
const actionService = new ActionService();
const accountService = new AccountService();

interface DashboardData {
  positions: Position[];
  actions: Action[];
  accounts: Account[];
  stats: {
    totalPositions: number;
    openPositions: number;
    pendingActions: number;
    executingActions: number;
    totalEquity: number;
    totalCredit: number;
  };
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    positions: [],
    actions: [],
    accounts: [],
    stats: {
      totalPositions: 0,
      openPositions: 0,
      pendingActions: 0,
      executingActions: 0,
      totalEquity: 0,
      totalCredit: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [positions, actions, accounts] = await Promise.all([
        positionService.listUserPositions(),
        actionService.listUserActions(),
        accountService.listUserAccounts()
      ]);
      
      // 統計計算
      const openPositions = positions.filter(p => p.status === 'OPEN').length;
      const pendingActions = actions.filter(a => a.status === 'PENDING').length;
      const executingActions = actions.filter(a => a.status === 'EXECUTING').length;
      const totalEquity = accounts.reduce((sum, acc) => sum + (acc.equity || 0), 0);
      const totalCredit = accounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);
      
      const stats = {
        totalPositions: positions.length,
        openPositions,
        pendingActions,
        executingActions,
        totalEquity,
        totalCredit
      };
      
      setData({
        positions,
        actions,
        accounts,
        stats
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refresh = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return { 
    data, 
    loading, 
    error, 
    refresh 
  };
}
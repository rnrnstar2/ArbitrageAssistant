import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';
import type { 
  WithdrawalDashboardData, 
  WithdrawalScore, 
  WithdrawalRisk
} from '@repo/shared-types';

const client = generateClient<Schema>();

interface UseWithdrawalDataOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseWithdrawalDataResult {
  data: WithdrawalDashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  runEmergencyAnalysis: (accountId: string) => Promise<WithdrawalScore | null>;
}

/**
 * 出金監視データ管理用Hook
 * リアルタイム計算ベース（DB永続化なし）
 */
export function useWithdrawalData({
  autoRefresh = true,
  refreshInterval = 5 * 60 * 1000 // 5分
}: UseWithdrawalDataOptions = {}): UseWithdrawalDataResult {
  const [data, setData] = useState<WithdrawalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  /**
   * リアルタイム出金監視データ取得
   */
  const fetchWithdrawalData = useCallback(async (): Promise<WithdrawalDashboardData> => {
    try {
      // TODO: Account model is not yet implemented in MVP
      // Using mock data for now
      const accountsResult = { data: [], errors: null };
      
      if (accountsResult.errors) {
        throw new Error(accountsResult.errors[0].message);
      }

      const accounts = accountsResult.data;
      const dashboardData: WithdrawalDashboardData = {
        accounts: []
      };

      // 各アカウントのリアルタイム分析実行
      for (const account of accounts) {
        try {
          // TODO: TradeAnalysisEngineでリアルタイム分析
          // const analysisEngine = new TradeAnalysisEngine();
          // const withdrawalScore = await analysisEngine.analyzeTradeHistory(account.id);
          
          // 暫定データ（実装時は上記のリアルタイム分析結果を使用）
          const mockScore = generateMockWithdrawalScore(account.id);

          // 最終手動取引日取得（MT4/MT5から直接）
          const lastManualTrade = await getLastManualTradeFromMT4(account.id);

          dashboardData.accounts.push({
            id: account.id,
            broker: account.broker,
            accountNumber: account.accountNumber,
            withdrawalScore: mockScore.score,
            riskLevel: mockScore.riskLevel,
            recommendations: mockScore.recommendations,
            metrics: {
              totalVolume: mockScore.totalVolume,
              systemRatio: mockScore.systemRatio,
              manualRatio: mockScore.manualRatio,
              lastManualTrade
            }
          });
        } catch (accountError) {
          console.error(`Error processing account ${account.id}:`, accountError);
          
          // エラー時の暫定データ
          dashboardData.accounts.push({
            id: account.id,
            broker: account.broker,
            accountNumber: account.accountNumber,
            withdrawalScore: 0,
            riskLevel: 'DANGER',
            recommendations: ['⚠️ 分析データの取得に失敗しました。手動分析を実行してください。'],
            metrics: {
              totalVolume: 0,
              systemRatio: 0,
              manualRatio: 0,
              lastManualTrade: null
            }
          });
        }
      }

      return dashboardData;
    } catch (error) {
      console.error('Error fetching withdrawal data:', error);
      throw error;
    }
  }, []);

  /**
   * MT4/MT5から最終手動取引日取得
   * SystemTradeテーブル削除により、MT4のコメント欄で判定
   */
  const getLastManualTradeFromMT4 = async (accountId: string): Promise<Date | null> => {
    try {
      // TODO: MT4/MT5 APIから直接取引履歴取得
      // const mt4History = await fetchMT4TradeHistory(accountId);
      // システム取引はMT4のコメント欄で判定（例: "EA_Trade"などの固定文字列）
      
      // 模擬データ（実装時はMT4履歴から手動取引を抽出）
      const mockLastManualTrade = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
      return mockLastManualTrade;
      
    } catch (error) {
      console.error(`Error getting last manual trade for account ${accountId}:`, error);
      return null;
    }
  };

  /**
   * 模擬出金スコア生成（実装時はTradeAnalysisEngineを使用）
   */
  const generateMockWithdrawalScore = (accountId: string): WithdrawalScore => {
    // アカウントIDに基づく疑似ランダム生成
    const seed = accountId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const random = (seed * 9301 + 49297) % 233280 / 233280;
    
    const score = Math.floor(random * 100);
    const systemRatio = 0.4 + random * 0.5; // 0.4-0.9
    const manualRatio = 1 - systemRatio;
    
    let riskLevel: WithdrawalRisk;
    if (score >= 80) riskLevel = 'SAFE';
    else if (score >= 50) riskLevel = 'CAUTION';
    else riskLevel = 'DANGER';
    
    const recommendations = generateRecommendations(score, systemRatio);
    
    return {
      score,
      totalVolume: 20 + random * 80, // 20-100
      systemRatio,
      manualRatio,
      riskLevel,
      recommendations,
      lastCalculated: new Date()
    };
  };
  
  /**
   * 推奨アクション生成
   */
  const generateRecommendations = (score: number, systemRatio: number): string[] => {
    const recommendations: string[] = [];
    
    if (score < 50) {
      recommendations.push('🚨 出金リスク高 - 手動取引を増やしてください');
    }
    
    if (systemRatio > 0.8) {
      recommendations.push('⚠️ システム取引比率が高すぎます（80%以上）');
      recommendations.push('💡 小ロットでの手動スキャルピングを推奨');
    }
    
    if (score >= 80) {
      recommendations.push('✅ 出金可能レベルです');
    }
    
    if (systemRatio > 0.7) {
      recommendations.push('🎯 異なる時間帯での手動取引を推奨');
      recommendations.push('🔄 異なる通貨ペアでの取引を推奨');
    }
    
    return recommendations;
  };

  /**
   * データ更新
   */
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const newData = await fetchWithdrawalData();
      setData(newData);
      setLastUpdate(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to refresh withdrawal data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithdrawalData]);

  /**
   * 緊急分析実行
   */
  const runEmergencyAnalysis = useCallback(async (accountId: string): Promise<WithdrawalScore | null> => {
    try {
      setLoading(true);
      
      // TODO: WithdrawalAnalysisBatchの緊急分析実行
      // const batch = new WithdrawalAnalysisBatch();
      // const analysisResult = await batch.runEmergencyAnalysis(accountId);
      
      console.log(`Emergency analysis requested for account: ${accountId}`);
      
      // 分析完了後、データを再取得
      await refresh();
      
      // 模擬結果
      const mockResult: WithdrawalScore = {
        score: 45,
        totalVolume: 25.5,
        systemRatio: 0.85,
        manualRatio: 0.15,
        riskLevel: 'CAUTION',
        recommendations: ['⚠️ システム取引比率が高すぎます'],
        lastCalculated: new Date()
      };
      
      return mockResult;
    } catch (error) {
      console.error(`Emergency analysis failed for account ${accountId}:`, error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  // 初期データ読み込み
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh,
    runEmergencyAnalysis
  };
}

/**
 * 出金監視統計情報取得Hook
 */
export function useWithdrawalStats(data: WithdrawalDashboardData | null) {
  return {
    total: data?.accounts.length || 0,
    safe: data?.accounts.filter(a => a.riskLevel === 'SAFE').length || 0,
    caution: data?.accounts.filter(a => a.riskLevel === 'CAUTION').length || 0,
    danger: data?.accounts.filter(a => a.riskLevel === 'DANGER').length || 0,
    averageScore: data?.accounts.length 
      ? Math.round(data.accounts.reduce((sum, a) => sum + a.withdrawalScore, 0) / data.accounts.length)
      : 0,
    highRiskAccounts: data?.accounts.filter(a => a.withdrawalScore < 50) || [],
    needsAttention: data?.accounts.filter(a => a.riskLevel !== 'SAFE') || []
  };
}
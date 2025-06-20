import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";
import { Position } from "../../monitoring/types";
import { 
  CloseFormData, 
  CloseResult, 
  HedgeCloseSettings, 
  CloseRecommendation, 
  RebuildSettings, 
  BatchCloseInput, 
  BatchCloseResult,
  ClosingSummary 
} from "../close/types";

const client = generateClient<Schema>();

export class PositionManagementService {
  /**
   * 単一ポジション決済
   */
  static async closePosition(closeData: CloseFormData): Promise<CloseResult> {
    try {
      // 1. バリデーション
      const validation = this.validateCloseData(closeData);
      if (!validation.isValid) {
        return {
          id: '',
          positionId: closeData.positionId,
          status: 'failed',
          error: validation.error,
        };
      }

      // 2. ポジション存在確認
      const position = await this.getPosition(closeData.positionId);
      if (!position) {
        return {
          id: '',
          positionId: closeData.positionId,
          status: 'failed',
          error: 'ポジションが見つかりません',
        };
      }

      // 3. GraphQL mutation実行
      const result = await client.mutations.closePosition({
        positionId: closeData.positionId,
        closePrice: closeData.closePrice,
        closeType: closeData.closeType,
        trailSettings: closeData.trailSettings ? JSON.stringify(closeData.trailSettings) : undefined,
        linkedAction: closeData.linkedAction ? JSON.stringify(closeData.linkedAction) : undefined,
      });

      console.log("Close position mutation result:", result);

      if (result.data && typeof result.data === 'object') {
        return {
          id: String(result.data.id || ''),
          positionId: closeData.positionId,
          status: 'pending',
          executedPrice: closeData.closeType === 'market' ? position.currentPrice : closeData.closePrice,
          profit: this.calculateExpectedProfit(position, closeData.closePrice),
        };
      }

      throw new Error('決済処理に失敗しました');
    } catch (error) {
      console.error("Close position error:", error);
      return {
        id: '',
        positionId: closeData.positionId,
        status: 'failed',
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
      };
    }
  }

  /**
   * 両建てペア決済
   */
  static async closeHedgePair(
    position1Id: string,
    position2Id: string,
    settings: HedgeCloseSettings
  ): Promise<CloseResult[]> {
    try {
      const results: CloseResult[] = [];

      // ポジション1の決済
      const close1Data: CloseFormData = {
        positionId: position1Id,
        closePrice: settings.position1Price || 0,
        closeType: settings.closeType,
        trailSettings: settings.trailBoth ? settings.trailSettings : undefined,
      };

      // ポジション2の決済
      const close2Data: CloseFormData = {
        positionId: position2Id,
        closePrice: settings.position2Price || 0,
        closeType: settings.closeType,
        trailSettings: settings.trailBoth ? settings.trailSettings : undefined,
      };

      if (settings.synchronous) {
        // 同期実行
        const [result1, result2] = await Promise.all([
          this.closePosition(close1Data),
          this.closePosition(close2Data),
        ]);
        results.push(result1, result2);
      } else {
        // 順次実行
        const result1 = await this.closePosition(close1Data);
        results.push(result1);
        
        // 100ms待機後に2つ目を実行
        await new Promise(resolve => setTimeout(resolve, 100));
        const result2 = await this.closePosition(close2Data);
        results.push(result2);
      }

      return results;
    } catch (error) {
      console.error("Close hedge pair error:", error);
      throw error;
    }
  }

  /**
   * 日次整理推奨の取得（新しいサービスを使用）
   */
  static async getDailyCloseRecommendations(): Promise<CloseRecommendation[]> {
    try {
      // 新しいDailyCloseProposalServiceを使用
      const { DailyCloseProposalService } = await import('./daily-close-proposal-service');
      const enhancedProposals = await DailyCloseProposalService.generateDailyCloseProposals();
      
      // EnhancedCloseRecommendationをCloseRecommendationに変換
      return enhancedProposals.map(proposal => ({
        positionId: proposal.positionId,
        reason: proposal.reason,
        priority: proposal.priority,
        estimatedSavings: proposal.estimatedSavings,
        swapCost: proposal.swapCost,
        holdingDays: proposal.holdingDays,
        currentProfit: proposal.currentProfit,
      }));
    } catch (error) {
      console.error("Error getting close recommendations:", error);
      return [];
    }
  }

  /**
   * ポジション再構築
   */
  static async rebuildPositions(
    closedPositions: Position[],
    rebuildSettings: RebuildSettings
  ): Promise<any[]> {
    try {
      const entries: any[] = [];

      for (const closedPosition of closedPositions) {
        if (!rebuildSettings.immediate) {
          // 遅延実行の場合は遅延を設定
          await new Promise(resolve => 
            setTimeout(resolve, (rebuildSettings.delayMinutes || 0) * 60 * 1000)
          );
        }

        const entryData = {
          accountId: rebuildSettings.targetAccounts?.length 
            ? rebuildSettings.targetAccounts[0] 
            : closedPosition.accountId,
          symbol: rebuildSettings.sameSymbol ? closedPosition.symbol : closedPosition.symbol,
          type: closedPosition.type,
          lots: rebuildSettings.sameLots ? closedPosition.lots : closedPosition.lots * 0.5,
          price: undefined, // 成行
        };

        // エントリー実行（TradingServiceを使用）
        // const result = await TradingService.executeEntry(entryData);
        entries.push(entryData);
      }

      return entries;
    } catch (error) {
      console.error("Error rebuilding positions:", error);
      throw error;
    }
  }

  /**
   * 一括決済
   */
  static async batchClosePositions(input: BatchCloseInput): Promise<BatchCloseResult> {
    try {
      const results: CloseResult[] = [];
      let successful = 0;
      let failed = 0;

      // 優先度によって実行順序を決定
      const sortedPositionIds = input.priority === 'high' 
        ? input.positionIds 
        : input.positionIds.sort();

      for (const positionId of sortedPositionIds) {
        try {
          const position = await this.getPosition(positionId);
          if (!position) {
            failed++;
            results.push({
              id: '',
              positionId,
              status: 'failed',
              error: 'ポジションが見つかりません',
            });
            continue;
          }

          const closeData: CloseFormData = {
            positionId,
            closePrice: position.currentPrice,
            closeType: input.closeType,
            trailSettings: input.trailSettings,
          };

          const result = await this.closePosition(closeData);
          results.push(result);

          if (result.status === 'failed') {
            failed++;
          } else {
            successful++;
          }

          // 各決済間に短い間隔を設ける
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failed++;
          results.push({
            id: '',
            positionId,
            status: 'failed',
            error: error instanceof Error ? error.message : '不明なエラー',
          });
        }
      }

      return {
        totalRequested: input.positionIds.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      console.error("Batch close error:", error);
      throw error;
    }
  }

  /**
   * 決済サマリー取得
   */
  static async getClosingSummary(dateFrom?: Date, dateTo?: Date): Promise<ClosingSummary> {
    try {
      // TODO: 実際のクエリを実装
      return {
        dailyCloseCount: 0,
        totalProfit: 0,
        swapSaved: 0,
        averageHoldingPeriod: 0,
        successRate: 0,
      };
    } catch (error) {
      console.error("Error getting closing summary:", error);
      throw error;
    }
  }

  // ヘルパーメソッド

  private static async getPosition(positionId: string): Promise<Position | null> {
    try {
      const result = await client.models.Position.get({ id: positionId });
      return result.data as Position | null;
    } catch (error) {
      console.error("Error getting position:", error);
      return null;
    }
  }

  private static async getAllOpenPositions(): Promise<Position[]> {
    try {
      const result = await client.models.Position.list({
        filter: { status: { eq: 'open' } },
        limit: 1000,
      });
      return (result.data || []) as Position[];
    } catch (error) {
      console.error("Error getting open positions:", error);
      return [];
    }
  }

  private static validateCloseData(data: CloseFormData): { isValid: boolean; error?: string } {
    if (!data.positionId) {
      return { isValid: false, error: "ポジションIDが必要です" };
    }

    if (!["market", "limit"].includes(data.closeType)) {
      return { isValid: false, error: "決済方法が不正です" };
    }

    if (data.closeType === 'limit' && (!data.closePrice || data.closePrice <= 0)) {
      return { isValid: false, error: "指値決済の場合は決済価格が必要です" };
    }

    // トレール設定のバリデーション
    if (data.trailSettings?.enabled) {
      if (!data.trailSettings.startPips || data.trailSettings.startPips <= 0) {
        return { isValid: false, error: "トレール開始PIPSが不正です" };
      }
      if (!data.trailSettings.trailPips || data.trailSettings.trailPips <= 0) {
        return { isValid: false, error: "トレールPIPSが不正です" };
      }
    }

    return { isValid: true };
  }

  private static calculateExpectedProfit(position: Position, closePrice: number): number {
    const priceDiff = position.type === 'buy' 
      ? closePrice - position.openPrice
      : position.openPrice - closePrice;
    
    // 簡易的な損益計算（実際は通貨ペア毎の計算が必要）
    return priceDiff * position.lots * 100000;
  }

  private static getHoldingDays(openTime: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - openTime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private static calculateSwapCost(position: Position, holdingDays: number): number {
    // 新しいSwapCostCalculatorを使用
    try {
      const { SwapCostCalculator } = require('./swap-cost-calculator');
      const swapInfo = SwapCostCalculator.calculateDailySwap(position);
      return swapInfo.cumulativeSwapCost;
    } catch (error) {
      // フォールバック: 従来の計算方法
      return holdingDays * position.lots * 0.5;
    }
  }
}
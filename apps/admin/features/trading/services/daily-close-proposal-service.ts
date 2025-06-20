import { Position } from "../../monitoring/types";
import { CloseRecommendation } from "../close/types";
import { SwapCostCalculator, SwapCostInfo } from "./swap-cost-calculator";
import { PositionManagementService } from "./position-management-service";

export interface DailyCloseProposalSettings {
  minSwapCostThreshold: number;
  minHoldingDays: number;
  maxHoldingDays: number;
  profitTargetMultiplier: number;
  lossLimitMultiplier: number;
  enableWeekendAdjustment: boolean;
  excludeHedgedPositions: boolean;
}

export interface EnhancedCloseRecommendation extends CloseRecommendation {
  swapInfo: SwapCostInfo;
  proposalType: "swap_optimization" | "risk_management" | "profit_taking" | "long_holding";
  executionUrgency: "immediate" | "today" | "this_week" | "optional";
  rebuildRecommendation: boolean;
  combinedScore: number;
}

export interface ProposalAnalysis {
  totalPositions: number;
  eligiblePositions: number;
  highPriorityCount: number;
  estimatedDailySavings: number;
  estimatedWeeklySavings: number;
  riskPositionCount: number;
  profitablePositionCount: number;
}

export class DailyCloseProposalService {
  private static readonly DEFAULT_SETTINGS: DailyCloseProposalSettings = {
    minSwapCostThreshold: 3.0,
    minHoldingDays: 1,
    maxHoldingDays: 30,
    profitTargetMultiplier: 2.0,
    lossLimitMultiplier: 3.0,
    enableWeekendAdjustment: true,
    excludeHedgedPositions: false,
  };

  /**
   * 日次整理提案を生成
   */
  static async generateDailyCloseProposals(
    settings: Partial<DailyCloseProposalSettings> = {}
  ): Promise<EnhancedCloseRecommendation[]> {
    const finalSettings = { ...this.DEFAULT_SETTINGS, ...settings };
    
    try {
      // オープンポジション取得
      const openPositions = await this.getAllOpenPositions();
      
      // フィルタリング
      const eligiblePositions = this.filterEligiblePositions(openPositions, finalSettings);
      
      // 各ポジションの提案を生成
      const proposals: EnhancedCloseRecommendation[] = [];
      
      for (const position of eligiblePositions) {
        const proposal = this.createProposalForPosition(position, finalSettings);
        if (proposal) {
          proposals.push(proposal);
        }
      }
      
      // スコア順でソート
      return proposals.sort((a, b) => b.combinedScore - a.combinedScore);
    } catch (error) {
      console.error("Error generating daily close proposals:", error);
      return [];
    }
  }

  /**
   * 提案分析サマリーを生成
   */
  static analyzeProposals(
    positions: Position[],
    proposals: EnhancedCloseRecommendation[]
  ): ProposalAnalysis {
    const totalPositions = positions.length;
    const eligiblePositions = proposals.length;
    const highPriorityCount = proposals.filter(p => p.priority === "high").length;
    const riskPositionCount = proposals.filter(p => p.proposalType === "risk_management").length;
    const profitablePositionCount = proposals.filter(p => p.currentProfit > 0).length;
    
    const estimatedDailySavings = proposals.reduce((sum, p) => sum + p.swapInfo.dailySwapCost, 0);
    const estimatedWeeklySavings = estimatedDailySavings * 7;

    return {
      totalPositions,
      eligiblePositions,
      highPriorityCount,
      estimatedDailySavings,
      estimatedWeeklySavings,
      riskPositionCount,
      profitablePositionCount,
    };
  }

  /**
   * 通貨ペア別提案分析
   */
  static analyzeProposalsBySymbol(
    proposals: EnhancedCloseRecommendation[]
  ): { [symbol: string]: {
    count: number;
    totalSwapCost: number;
    averageScore: number;
    highPriorityCount: number;
  }} {
    const analysis: { [symbol: string]: any } = {};
    
    proposals.forEach(proposal => {
      const symbol = proposal.positionId; // TODO: positionからsymbolを取得
      if (!analysis[symbol]) {
        analysis[symbol] = {
          count: 0,
          totalSwapCost: 0,
          totalScore: 0,
          highPriorityCount: 0,
        };
      }
      
      analysis[symbol].count++;
      analysis[symbol].totalSwapCost += proposal.swapInfo.dailySwapCost;
      analysis[symbol].totalScore += proposal.combinedScore;
      if (proposal.priority === "high") {
        analysis[symbol].highPriorityCount++;
      }
    });
    
    // 平均スコアを計算
    Object.keys(analysis).forEach(symbol => {
      analysis[symbol].averageScore = analysis[symbol].totalScore / analysis[symbol].count;
    });
    
    return analysis;
  }

  /**
   * 実行スケジュール提案
   */
  static generateExecutionSchedule(
    proposals: EnhancedCloseRecommendation[],
    maxPositionsPerExecution: number = 10
  ): {
    immediate: EnhancedCloseRecommendation[];
    today: EnhancedCloseRecommendation[];
    thisWeek: EnhancedCloseRecommendation[];
    optional: EnhancedCloseRecommendation[];
  } {
    const schedule = {
      immediate: proposals.filter(p => p.executionUrgency === "immediate").slice(0, maxPositionsPerExecution),
      today: proposals.filter(p => p.executionUrgency === "today").slice(0, maxPositionsPerExecution),
      thisWeek: proposals.filter(p => p.executionUrgency === "this_week"),
      optional: proposals.filter(p => p.executionUrgency === "optional"),
    };
    
    return schedule;
  }

  /**
   * 両建てポジション検出
   */
  static detectHedgedPositions(positions: Position[]): { [symbol: string]: Position[] } {
    const positionsBySymbol: { [symbol: string]: Position[] } = {};
    
    positions.forEach(position => {
      if (!positionsBySymbol[position.symbol]) {
        positionsBySymbol[position.symbol] = [];
      }
      positionsBySymbol[position.symbol].push(position);
    });
    
    const hedgedPositions: { [symbol: string]: Position[] } = {};
    
    Object.keys(positionsBySymbol).forEach(symbol => {
      const symbolPositions = positionsBySymbol[symbol];
      const hasBuy = symbolPositions.some(p => p.type === "buy");
      const hasSell = symbolPositions.some(p => p.type === "sell");
      
      // 両建てが検出された場合
      if (hasBuy && hasSell && symbolPositions.length >= 2) {
        hedgedPositions[symbol] = symbolPositions;
      }
    });
    
    return hedgedPositions;
  }

  // プライベートメソッド

  private static async getAllOpenPositions(): Promise<Position[]> {
    // TODO: 実際のAPI呼び出しを実装
    // 暫定的にPositionManagementServiceを使用
    return [];
  }

  private static filterEligiblePositions(
    positions: Position[],
    settings: DailyCloseProposalSettings
  ): Position[] {
    return positions.filter(position => {
      const holdingDays = this.getHoldingDays(position.openTime);
      const swapInfo = SwapCostCalculator.calculateDailySwap(position);
      
      // 最小保有期間チェック
      if (holdingDays < settings.minHoldingDays) return false;
      
      // 最大保有期間チェック
      if (holdingDays > settings.maxHoldingDays) return true; // 長期保有は必ず対象
      
      // スワップコスト閾値チェック
      if (swapInfo.dailySwapCost < settings.minSwapCostThreshold) return false;
      
      return true;
    });
  }

  private static createProposalForPosition(
    position: Position,
    settings: DailyCloseProposalSettings
  ): EnhancedCloseRecommendation | null {
    const holdingDays = this.getHoldingDays(position.openTime);
    const swapInfo = SwapCostCalculator.calculateDailySwap(position);
    
    // 提案タイプとスコアを決定
    const { proposalType, combinedScore, executionUrgency } = this.evaluatePosition(
      position, swapInfo, holdingDays, settings
    );
    
    // 優先度を決定
    let priority: "low" | "medium" | "high" = "low";
    if (combinedScore > 80) priority = "high";
    else if (combinedScore > 50) priority = "medium";
    
    // 再構築推奨を決定
    const rebuildRecommendation = this.shouldRecommendRebuild(
      position, swapInfo, proposalType
    );
    
    return {
      positionId: position.id,
      reason: this.mapProposalTypeToReason(proposalType),
      priority,
      estimatedSavings: this.calculateEstimatedSavings(swapInfo, holdingDays),
      swapCost: swapInfo.dailySwapCost,
      holdingDays,
      currentProfit: position.profit,
      swapInfo,
      proposalType,
      executionUrgency,
      rebuildRecommendation,
      combinedScore,
    };
  }

  private static evaluatePosition(
    position: Position,
    swapInfo: SwapCostInfo,
    holdingDays: number,
    settings: DailyCloseProposalSettings
  ): {
    proposalType: EnhancedCloseRecommendation["proposalType"];
    combinedScore: number;
    executionUrgency: EnhancedCloseRecommendation["executionUrgency"];
  } {
    let score = 0;
    let proposalType: EnhancedCloseRecommendation["proposalType"] = "swap_optimization";
    let executionUrgency: EnhancedCloseRecommendation["executionUrgency"] = "optional";
    
    // スワップコストスコア (0-40点)
    const swapScore = Math.min(40, (swapInfo.dailySwapCost / 10) * 40);
    score += swapScore;
    
    // 保有期間スコア (0-30点)
    const holdingScore = Math.min(30, (holdingDays / 14) * 30);
    score += holdingScore;
    
    // 損益スコア (0-30点)
    let profitScore = 0;
    if (position.profit < -position.lots * 100) {
      // 大きな損失
      profitScore = 30;
      proposalType = "risk_management";
      executionUrgency = "immediate";
    } else if (position.profit > position.lots * 50) {
      // 利益確定
      profitScore = 20;
      proposalType = "profit_taking";
      executionUrgency = "today";
    } else if (position.profit < 0) {
      // 軽微な損失
      profitScore = 10;
    }
    score += profitScore;
    
    // 長期保有の場合
    if (holdingDays > 14) {
      proposalType = "long_holding";
      if (holdingDays > 21) {
        executionUrgency = "today";
      } else {
        executionUrgency = "this_week";
      }
    }
    
    // スワップコストが非常に高い場合
    if (swapInfo.dailySwapCost > 15) {
      proposalType = "swap_optimization";
      executionUrgency = "immediate";
    } else if (swapInfo.dailySwapCost > 8) {
      executionUrgency = executionUrgency === "optional" ? "today" : executionUrgency;
    }
    
    return { proposalType, combinedScore: score, executionUrgency };
  }

  private static shouldRecommendRebuild(
    position: Position,
    swapInfo: SwapCostInfo,
    proposalType: EnhancedCloseRecommendation["proposalType"]
  ): boolean {
    // リスク管理の場合は再構築しない
    if (proposalType === "risk_management") return false;
    
    // 利益確定の場合は再構築を検討
    if (proposalType === "profit_taking") return true;
    
    // スワップ最適化の場合は再構築推奨
    if (proposalType === "swap_optimization" && swapInfo.dailySwapCost > 5) return true;
    
    return false;
  }

  private static mapProposalTypeToReason(
    proposalType: EnhancedCloseRecommendation["proposalType"]
  ): CloseRecommendation["reason"] {
    switch (proposalType) {
      case "swap_optimization": return "high_swap";
      case "risk_management": return "risk_management";
      case "profit_taking": return "profit_target";
      case "long_holding": return "long_holding";
      default: return "high_swap";
    }
  }

  private static calculateEstimatedSavings(
    swapInfo: SwapCostInfo,
    holdingDays: number
  ): number {
    // 今後1週間のスワップコスト節約
    return swapInfo.weeklySwapCost;
  }

  private static getHoldingDays(openTime: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - openTime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
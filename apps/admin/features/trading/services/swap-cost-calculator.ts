import { Position } from "../../monitoring/types";

export interface SwapRateData {
  symbol: string;
  buySwapRate: number;
  sellSwapRate: number;
  lastUpdated: Date;
  brokerId?: string;
}

export interface SwapCostInfo {
  positionId: string;
  dailySwapCost: number;
  weeklySwapCost: number;
  monthlySwapCost: number;
  cumulativeSwapCost: number;
  swapRate: number;
  projectedYearlySwap: number;
}

export interface SwapCostSummary {
  totalDailySwapCost: number;
  totalWeeklySwapCost: number;
  totalMonthlySwapCost: number;
  totalCumulativeSwapCost: number;
  highestCostPosition: string | null;
  positionCount: number;
  averageDailyCost: number;
}

export class SwapCostCalculator {
  // デフォルトスワップレート（実際の運用時はブローカーAPIから取得）
  private static readonly DEFAULT_SWAP_RATES: { [symbol: string]: SwapRateData } = {
    "EURUSD": {
      symbol: "EURUSD",
      buySwapRate: -0.52,
      sellSwapRate: -0.31,
      lastUpdated: new Date(),
    },
    "GBPUSD": {
      symbol: "GBPUSD", 
      buySwapRate: -0.89,
      sellSwapRate: -0.12,
      lastUpdated: new Date(),
    },
    "USDJPY": {
      symbol: "USDJPY",
      buySwapRate: -0.34,
      sellSwapRate: -0.78,
      lastUpdated: new Date(),
    },
    "AUDUSD": {
      symbol: "AUDUSD",
      buySwapRate: -0.67,
      sellSwapRate: -0.23,
      lastUpdated: new Date(),
    },
    "USDCAD": {
      symbol: "USDCAD",
      buySwapRate: -0.45,
      sellSwapRate: -0.56,
      lastUpdated: new Date(),
    },
    "USDCHF": {
      symbol: "USDCHF",
      buySwapRate: -0.78,
      sellSwapRate: -0.12,
      lastUpdated: new Date(),
    },
    "EURJPY": {
      symbol: "EURJPY",
      buySwapRate: -0.43,
      sellSwapRate: -0.67,
      lastUpdated: new Date(),
    },
    "GBPJPY": {
      symbol: "GBPJPY",
      buySwapRate: -0.56,
      sellSwapRate: -0.89,
      lastUpdated: new Date(),
    },
    "EURGBP": {
      symbol: "EURGBP",
      buySwapRate: -0.34,
      sellSwapRate: -0.45,
      lastUpdated: new Date(),
    },
    "NZDUSD": {
      symbol: "NZDUSD",
      buySwapRate: -0.78,
      sellSwapRate: -0.23,
      lastUpdated: new Date(),
    },
  };

  /**
   * 単一ポジションのスワップコスト情報を計算
   */
  static calculateDailySwap(position: Position): SwapCostInfo {
    const swapRateData = this.getSwapRate(position.symbol);
    const applicableRate = position.type === "buy" 
      ? swapRateData.buySwapRate 
      : swapRateData.sellSwapRate;

    const dailySwapCost = Math.abs(applicableRate * position.lots);
    const holdingDays = this.getHoldingDays(position.openTime);
    const cumulativeSwapCost = dailySwapCost * holdingDays;

    return {
      positionId: position.id,
      dailySwapCost,
      weeklySwapCost: dailySwapCost * 7,
      monthlySwapCost: dailySwapCost * 30,
      cumulativeSwapCost,
      swapRate: applicableRate,
      projectedYearlySwap: dailySwapCost * 365,
    };
  }

  /**
   * 通貨ペアのスワップレートを取得
   */
  static getSwapRate(symbol: string): SwapRateData {
    return this.DEFAULT_SWAP_RATES[symbol] || {
      symbol,
      buySwapRate: -0.5,
      sellSwapRate: -0.5,
      lastUpdated: new Date(),
    };
  }

  /**
   * 週間スワップコストを推定
   */
  static estimateWeeklySwap(position: Position): number {
    const dailySwap = this.calculateDailySwap(position);
    return dailySwap.weeklySwapCost;
  }

  /**
   * 複数ポジションのスワップコストサマリーを計算
   */
  static calculateSwapCostSummary(positions: Position[]): SwapCostSummary {
    if (positions.length === 0) {
      return {
        totalDailySwapCost: 0,
        totalWeeklySwapCost: 0,
        totalMonthlySwapCost: 0,
        totalCumulativeSwapCost: 0,
        highestCostPosition: null,
        positionCount: 0,
        averageDailyCost: 0,
      };
    }

    const swapInfos = positions.map(pos => this.calculateDailySwap(pos));
    
    const totalDailySwapCost = swapInfos.reduce((sum, info) => sum + info.dailySwapCost, 0);
    const totalWeeklySwapCost = swapInfos.reduce((sum, info) => sum + info.weeklySwapCost, 0);
    const totalMonthlySwapCost = swapInfos.reduce((sum, info) => sum + info.monthlySwapCost, 0);
    const totalCumulativeSwapCost = swapInfos.reduce((sum, info) => sum + info.cumulativeSwapCost, 0);

    // 最もスワップコストが高いポジションを特定
    const highestCostInfo = swapInfos.reduce((max, current) => 
      current.dailySwapCost > max.dailySwapCost ? current : max
    );

    return {
      totalDailySwapCost,
      totalWeeklySwapCost,
      totalMonthlySwapCost,
      totalCumulativeSwapCost,
      highestCostPosition: highestCostInfo.positionId,
      positionCount: positions.length,
      averageDailyCost: totalDailySwapCost / positions.length,
    };
  }

  /**
   * スワップコストが高いポジションを特定
   */
  static identifyHighSwapCostPositions(
    positions: Position[], 
    threshold: number = 5.0
  ): Position[] {
    return positions.filter(position => {
      const swapInfo = this.calculateDailySwap(position);
      return swapInfo.dailySwapCost >= threshold;
    });
  }

  /**
   * 通貨ペア別スワップコスト分析
   */
  static analyzeSwapCostBySymbol(positions: Position[]): { [symbol: string]: SwapCostInfo[] } {
    const analysis: { [symbol: string]: SwapCostInfo[] } = {};
    
    positions.forEach(position => {
      const swapInfo = this.calculateDailySwap(position);
      if (!analysis[position.symbol]) {
        analysis[position.symbol] = [];
      }
      analysis[position.symbol].push(swapInfo);
    });

    return analysis;
  }

  /**
   * 日次整理による節約効果を計算
   */
  static calculateDailyCloseEfficiency(
    position: Position, 
    projectedHoldingDays: number = 7
  ): {
    currentCumulativeSwap: number;
    projectedSwapCost: number;
    potentialSavings: number;
    efficiencyRatio: number;
  } {
    const swapInfo = this.calculateDailySwap(position);
    const projectedSwapCost = swapInfo.dailySwapCost * projectedHoldingDays;
    const potentialSavings = projectedSwapCost - swapInfo.cumulativeSwapCost;
    
    // 効率性比率（節約額 / 累積スワップコスト）
    const efficiencyRatio = swapInfo.cumulativeSwapCost > 0 
      ? potentialSavings / swapInfo.cumulativeSwapCost 
      : 0;

    return {
      currentCumulativeSwap: swapInfo.cumulativeSwapCost,
      projectedSwapCost,
      potentialSavings: Math.max(0, potentialSavings),
      efficiencyRatio,
    };
  }

  /**
   * スワップレートの更新（実際のAPIから取得する場合）
   */
  static async updateSwapRates(brokerId?: string): Promise<SwapRateData[]> {
    try {
      // TODO: 実際のブローカーAPIからスワップレートを取得
      // const response = await fetch(`/api/brokers/${brokerId}/swap-rates`);
      // const rates = await response.json();
      
      // 現在はデフォルトレートを返す
      return Object.values(this.DEFAULT_SWAP_RATES);
    } catch (error) {
      console.error("Error updating swap rates:", error);
      return Object.values(this.DEFAULT_SWAP_RATES);
    }
  }

  /**
   * 週末スワップの考慮（水曜日は3倍スワップ）
   */
  static calculateWeekendAdjustedSwap(
    position: Position, 
    targetDate: Date = new Date()
  ): number {
    const baseSwapInfo = this.calculateDailySwap(position);
    const dayOfWeek = targetDate.getDay(); // 0: 日曜日, 3: 水曜日
    
    // 水曜日は3倍スワップ（週末分を含む）
    const multiplier = dayOfWeek === 3 ? 3 : 1;
    
    return baseSwapInfo.dailySwapCost * multiplier;
  }

  /**
   * スワップコスト最適化提案
   */
  static generateOptimizationSuggestions(positions: Position[]): {
    positionId: string;
    symbol: string;
    suggestionType: "close" | "reduce_lots" | "hedge";
    reason: string;
    expectedSavings: number;
    priority: "high" | "medium" | "low";
  }[] {
    const suggestions: any[] = [];
    
    positions.forEach(position => {
      const swapInfo = this.calculateDailySwap(position);
      const efficiency = this.calculateDailyCloseEfficiency(position);
      
      // 高スワップコストポジションの決済提案
      if (swapInfo.dailySwapCost > 10) {
        suggestions.push({
          positionId: position.id,
          symbol: position.symbol,
          suggestionType: "close",
          reason: `高スワップコスト（日次${swapInfo.dailySwapCost.toFixed(2)}ドル）`,
          expectedSavings: efficiency.potentialSavings,
          priority: "high",
        });
      }
      // 中程度のスワップコストでロット数削減提案
      else if (swapInfo.dailySwapCost > 5 && position.lots > 0.5) {
        suggestions.push({
          positionId: position.id,
          symbol: position.symbol,
          suggestionType: "reduce_lots",
          reason: `ロット数削減によるスワップコスト軽減`,
          expectedSavings: swapInfo.dailySwapCost * 0.5 * 7, // 半分にした場合の週間節約
          priority: "medium",
        });
      }
    });

    return suggestions.sort((a, b) => b.expectedSavings - a.expectedSavings);
  }

  // ヘルパーメソッド

  private static getHoldingDays(openTime: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - openTime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 通貨ペアの価値計算に使用する基準値
   */
  private static getCurrencyMultiplier(symbol: string): number {
    // 各通貨ペアの1pip当たりの価値計算用
    const multipliers: { [symbol: string]: number } = {
      "EURUSD": 100000,
      "GBPUSD": 100000,
      "AUDUSD": 100000,
      "NZDUSD": 100000,
      "USDJPY": 1000,
      "USDCHF": 100000,
      "USDCAD": 100000,
      "EURJPY": 1000,
      "GBPJPY": 1000,
      "EURGBP": 100000,
    };
    
    return multipliers[symbol] || 100000;
  }
}
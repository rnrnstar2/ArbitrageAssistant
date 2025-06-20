import type { Account, Position } from '../../../ea-management/types';

export interface MarginCalculationInput {
  balance: number;
  equity: number;
  marginUsed: number;
  bonusAmount: number;
  profit: number;
  credit: number;
  currency: string;
  leverage: number;
  positions: Position[];
}

export interface MarginCalculation {
  // 基本計算
  marginLevel: number; // (Equity / UsedMargin) * 100
  freeMargin: number;  // Equity - UsedMargin
  
  // ボーナス考慮計算
  effectiveEquity: number;     // Balance + Profit + Bonus
  bonusAdjustedMargin: number; // ボーナス除外した実質証拠金維持率
  
  // リスク判定用データ
  realBalance: number;         // ボーナス除外残高
  totalProfit: number;         // 総損益
  marginUsed: number;          // 使用証拠金
  availableMargin: number;     // 利用可能証拠金（ボーナス考慮）
  
  // 計算メタデータ
  calculatedAt: Date;
  accountId: string;
  currency: string;
  leverage: number;
}

export interface MarginLevelThresholds {
  critical: number;    // 20%
  danger: number;      // 50%
  warning: number;     // 100%
  safe: number;        // 150%
}

export class MarginLevelCalculator {
  private static readonly DEFAULT_THRESHOLDS: MarginLevelThresholds = {
    critical: 20,
    danger: 50,
    warning: 100,
    safe: 150,
  };

  /**
   * 証拠金維持率を計算する
   */
  static calculate(
    accountId: string,
    input: MarginCalculationInput
  ): MarginCalculation {
    const {
      balance,
      equity,
      marginUsed,
      bonusAmount,
      profit,
      credit,
      currency,
      leverage,
      positions,
    } = input;

    // 基本計算
    const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 999999;
    const freeMargin = equity - marginUsed;

    // ボーナス考慮計算
    const effectiveEquity = balance + profit + bonusAmount + credit;
    const realBalance = balance + credit; // ボーナス除外の実残高
    const bonusAdjustedEquity = realBalance + profit;
    const bonusAdjustedMargin = marginUsed > 0 ? (bonusAdjustedEquity / marginUsed) * 100 : 999999;

    // 利用可能証拠金（ボーナス含む）
    const availableMargin = Math.max(0, freeMargin);

    // ポジション関連計算
    const totalProfit = positions.reduce((sum, pos) => sum + pos.profit + pos.swap, 0);

    return {
      marginLevel,
      freeMargin,
      effectiveEquity,
      bonusAdjustedMargin,
      realBalance,
      totalProfit,
      marginUsed,
      availableMargin,
      calculatedAt: new Date(),
      accountId,
      currency,
      leverage,
    };
  }

  /**
   * Accountオブジェクトから直接計算する
   */
  static calculateFromAccount(account: Account, bonusAmount: number = 0): MarginCalculation {
    const input: MarginCalculationInput = {
      balance: account.balance,
      equity: account.equity,
      marginUsed: account.margin,
      bonusAmount,
      profit: account.profit,
      credit: account.credit,
      currency: account.currency,
      leverage: account.leverage,
      positions: account.positions,
    };

    return this.calculate(account.accountId, input);
  }

  /**
   * 複数アカウントの証拠金維持率を一括計算
   */
  static calculateMultipleAccounts(
    accounts: Array<{ account: Account; bonusAmount?: number }>
  ): MarginCalculation[] {
    return accounts.map(({ account, bonusAmount = 0 }) => 
      this.calculateFromAccount(account, bonusAmount)
    );
  }

  /**
   * 証拠金維持率の変化を計算
   */
  static calculateChange(
    current: MarginCalculation,
    previous: MarginCalculation
  ): {
    marginLevelChange: number;
    freeMarginChange: number;
    profitChange: number;
    timeDifference: number; // seconds
  } {
    const timeDifference = (current.calculatedAt.getTime() - previous.calculatedAt.getTime()) / 1000;
    
    return {
      marginLevelChange: current.marginLevel - previous.marginLevel,
      freeMarginChange: current.freeMargin - previous.freeMargin,
      profitChange: current.totalProfit - previous.totalProfit,
      timeDifference,
    };
  }

  /**
   * ロスカットまでの損失可能額を計算
   */
  static calculateMaxLossBeforeLosscut(
    calculation: MarginCalculation,
    losscutLevel: number = 20
  ): {
    maxLoss: number;
    currentBuffer: number;
    losscutEquity: number;
  } {
    const { marginUsed, effectiveEquity } = calculation;
    const losscutEquity = (marginUsed * losscutLevel) / 100;
    const maxLoss = effectiveEquity - losscutEquity;
    const currentBuffer = maxLoss;

    return {
      maxLoss: Math.max(0, maxLoss),
      currentBuffer,
      losscutEquity,
      };
  }

  /**
   * 必要証拠金率を計算（新規ポジション用）
   */
  static calculateRequiredMargin(
    symbol: string,
    volume: number,
    price: number,
    leverage: number,
    contractSize: number = 100000
  ): number {
    // 一般的なForex計算式
    // Required Margin = (Contract Size * Volume * Price) / Leverage
    return (contractSize * volume * price) / leverage;
  }

  /**
   * 新規ポジション開設可能ロット数を計算
   */
  static calculateMaxVolume(
    calculation: MarginCalculation,
    symbol: string,
    price: number,
    leverage: number,
    marginRequirementPerLot: number,
    safetyMarginPercent: number = 10
  ): {
    maxVolume: number;
    safeVolume: number;
    marginRequired: number;
  } {
    const availableMargin = calculation.availableMargin;
    const safetyFactor = (100 - safetyMarginPercent) / 100;
    
    const maxVolume = availableMargin / marginRequirementPerLot;
    const safeVolume = maxVolume * safetyFactor;
    
    return {
      maxVolume: Math.max(0, maxVolume),
      safeVolume: Math.max(0, safeVolume),
      marginRequired: marginRequirementPerLot,
    };
  }

  /**
   * バリデーション：計算結果の妥当性チェック
   */
  static validateCalculation(calculation: MarginCalculation): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 基本的な妥当性チェック
    if (calculation.marginLevel < 0) {
      errors.push('Margin level cannot be negative');
    }
    
    if (calculation.marginUsed < 0) {
      errors.push('Used margin cannot be negative');
    }

    if (calculation.effectiveEquity < 0) {
      warnings.push('Effective equity is negative');
    }

    // 論理的整合性チェック
    if (calculation.bonusAdjustedMargin > calculation.marginLevel + 1) {
      warnings.push('Bonus adjusted margin level seems inconsistent with regular margin level');
    }

    // 極端な値のチェック
    if (calculation.marginLevel > 10000) {
      warnings.push('Margin level is extremely high (>10000%)');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * 証拠金履歴の統計計算
   */
  static calculateStatistics(
    calculations: MarginCalculation[]
  ): {
    average: number;
    min: number;
    max: number;
    volatility: number;
    trend: 'up' | 'down' | 'stable';
  } {
    if (calculations.length === 0) {
      return { average: 0, min: 0, max: 0, volatility: 0, trend: 'stable' };
    }

    const marginLevels = calculations.map(c => c.marginLevel);
    const average = marginLevels.reduce((sum, val) => sum + val, 0) / marginLevels.length;
    const min = Math.min(...marginLevels);
    const max = Math.max(...marginLevels);
    
    // 標準偏差による変動率
    const variance = marginLevels.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / marginLevels.length;
    const volatility = Math.sqrt(variance);

    // トレンド判定（最初と最後の10%を比較）
    const firstQuarter = calculations.slice(0, Math.max(1, Math.floor(calculations.length * 0.25)));
    const lastQuarter = calculations.slice(-Math.max(1, Math.floor(calculations.length * 0.25)));
    
    const firstAvg = firstQuarter.reduce((sum, c) => sum + c.marginLevel, 0) / firstQuarter.length;
    const lastAvg = lastQuarter.reduce((sum, c) => sum + c.marginLevel, 0) / lastQuarter.length;
    
    const trendThreshold = average * 0.05; // 5%以上の変化でトレンドとする
    let trend: 'up' | 'down' | 'stable' = 'stable';
    
    if (lastAvg - firstAvg > trendThreshold) {
      trend = 'up';
    } else if (firstAvg - lastAvg > trendThreshold) {
      trend = 'down';
    }

    return {
      average,
      min,
      max,
      volatility,
      trend,
    };
  }
}
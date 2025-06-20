import type { MarginCalculation } from './MarginLevelCalculator';
import type { AlertCondition, RiskAlertState, MarginLevelAlert } from '../alerts/types';

export type RiskLevel = 'safe' | 'warning' | 'danger' | 'critical';

export interface RiskThresholds {
  critical: number;    // 20% - 即座に対応が必要
  danger: number;      // 50% - 危険レベル
  warning: number;     // 100% - 警告レベル
  safe: number;        // 150% - 安全レベル
}

export interface BrokerLossCutLevels {
  [brokerName: string]: number;
}

export interface RiskLevelResult {
  level: RiskLevel;
  marginLevel: number;
  threshold: number;
  message: string;
  severity: AlertCondition['severity'];
  timeToLossCut?: number; // 分
  requiredRecoveryAmount?: number;
  affectedPositions?: string[];
}

export interface RiskDetectionConfig {
  thresholds: RiskThresholds;
  brokerLossCutLevels: BrokerLossCutLevels;
  enablePrediction: boolean;
  includeBonus: boolean;
  customThresholds?: Record<string, RiskThresholds>; // アカウント別設定
}

export interface RiskChangeDetection {
  previousLevel: RiskLevel;
  currentLevel: RiskLevel;
  levelChanged: boolean;
  marginChange: number;
  changeRate: number; // %/min
  isImproving: boolean;
  isDeteriorate: boolean;
}

export class RiskLevelDetector {
  private static readonly DEFAULT_THRESHOLDS: RiskThresholds = {
    critical: 20,
    danger: 50,
    warning: 100,
    safe: 150,
  };

  private static readonly DEFAULT_BROKER_LOSSCUT_LEVELS: BrokerLossCutLevels = {
    'XM': 20,
    'FXGT': 20,
    'Exness': 0,
    'TitanFX': 20,
    'AXIORY': 20,
    'TradeView': 100,
    'default': 20,
  };

  private config: RiskDetectionConfig;

  constructor(config?: Partial<RiskDetectionConfig>) {
    this.config = {
      thresholds: config?.thresholds || { ...RiskLevelDetector.DEFAULT_THRESHOLDS },
      brokerLossCutLevels: config?.brokerLossCutLevels || { ...RiskLevelDetector.DEFAULT_BROKER_LOSSCUT_LEVELS },
      enablePrediction: config?.enablePrediction ?? true,
      includeBonus: config?.includeBonus ?? true,
      customThresholds: config?.customThresholds || {},
    };
  }

  /**
   * 証拠金維持率からリスクレベルを判定
   */
  detectRiskLevel(
    calculation: MarginCalculation,
    brokerName?: string,
    accountId?: string
  ): RiskLevelResult {
    const thresholds = this.getThresholdsForAccount(accountId);
    const marginLevel = this.config.includeBonus ? 
      calculation.marginLevel : 
      calculation.bonusAdjustedMargin;

    const level = this.determineRiskLevel(marginLevel, thresholds);
    const threshold = this.getThresholdForLevel(level, thresholds);
    
    let timeToLossCut: number | undefined;
    let requiredRecoveryAmount: number | undefined;

    // 予測機能が有効な場合
    if (this.config.enablePrediction && (level === 'danger' || level === 'critical')) {
      timeToLossCut = this.predictTimeToLossCut(calculation, brokerName);
      requiredRecoveryAmount = this.calculateRequiredRecoveryAmount(calculation, brokerName);
    }

    return {
      level,
      marginLevel,
      threshold,
      message: this.generateRiskMessage(level, marginLevel, threshold, timeToLossCut),
      severity: this.mapRiskLevelToSeverity(level),
      timeToLossCut,
      requiredRecoveryAmount,
      affectedPositions: calculation.marginUsed > 0 ? ['all'] : [],
    };
  }

  /**
   * リスクレベルの変化を検知
   */
  detectRiskChange(
    current: MarginCalculation,
    previous: MarginCalculation,
    brokerName?: string,
    accountId?: string
  ): RiskChangeDetection {
    const currentRisk = this.detectRiskLevel(current, brokerName, accountId);
    const previousRisk = this.detectRiskLevel(previous, brokerName, accountId);

    const marginChange = current.marginLevel - previous.marginLevel;
    const timeDiff = (current.calculatedAt.getTime() - previous.calculatedAt.getTime()) / (1000 * 60); // 分
    const changeRate = timeDiff > 0 ? marginChange / timeDiff : 0;

    return {
      previousLevel: previousRisk.level,
      currentLevel: currentRisk.level,
      levelChanged: currentRisk.level !== previousRisk.level,
      marginChange,
      changeRate,
      isImproving: this.isRiskImproving(previousRisk.level, currentRisk.level),
      isDeteriorate: this.isRiskDeteriorating(previousRisk.level, currentRisk.level),
    };
  }

  /**
   * 複数アカウントのリスク状況を一括判定
   */
  detectMultipleAccountRisks(
    calculations: Array<{
      calculation: MarginCalculation;
      brokerName?: string;
      accountId?: string;
    }>
  ): RiskLevelResult[] {
    return calculations.map(({ calculation, brokerName, accountId }) =>
      this.detectRiskLevel(calculation, brokerName, accountId)
    );
  }

  /**
   * 緊急アラートが必要かを判定
   */
  requiresEmergencyAlert(riskResult: RiskLevelResult): boolean {
    return riskResult.level === 'critical' || 
           (riskResult.level === 'danger' && riskResult.timeToLossCut !== undefined && riskResult.timeToLossCut < 5);
  }

  /**
   * MarginLevelAlert用の設定生成
   */
  createMarginLevelAlert(
    riskResult: RiskLevelResult,
    accountId: string,
    cooldownPeriod: number = 300
  ): MarginLevelAlert {
    return {
      id: this.generateAlertId(accountId, riskResult.level),
      type: 'margin_level',
      threshold: riskResult.threshold,
      severity: riskResult.severity,
      cooldownPeriod,
      isActive: true,
      accountId,
      comparison: 'less_than',
      includeBonus: this.config.includeBonus,
    };
  }

  /**
   * RiskAlertState生成
   */
  createRiskAlertState(
    riskResult: RiskLevelResult,
    accountId: string,
    conditionId: string
  ): RiskAlertState {
    return {
      id: this.generateAlertId(accountId, riskResult.level),
      conditionId,
      accountId,
      type: 'margin_level',
      severity: riskResult.severity,
      message: riskResult.message,
      value: riskResult.marginLevel,
      threshold: riskResult.threshold,
      timestamp: new Date(),
      isAcknowledged: false,
      isSuppressed: false,
      metadata: {
        timeToLossCut: riskResult.timeToLossCut,
        requiredRecoveryAmount: riskResult.requiredRecoveryAmount,
        affectedPositions: riskResult.affectedPositions,
      },
    };
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<RiskDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * アカウント別の閾値取得
   */
  private getThresholdsForAccount(accountId?: string): RiskThresholds {
    if (accountId && this.config.customThresholds?.[accountId]) {
      return this.config.customThresholds[accountId];
    }
    return this.config.thresholds;
  }

  /**
   * 証拠金維持率からリスクレベルを決定
   */
  private determineRiskLevel(marginLevel: number, thresholds: RiskThresholds): RiskLevel {
    if (marginLevel <= thresholds.critical) return 'critical';
    if (marginLevel <= thresholds.danger) return 'danger';
    if (marginLevel <= thresholds.warning) return 'warning';
    return 'safe';
  }

  /**
   * リスクレベルに対応する閾値取得
   */
  private getThresholdForLevel(level: RiskLevel, thresholds: RiskThresholds): number {
    switch (level) {
      case 'critical': return thresholds.critical;
      case 'danger': return thresholds.danger;
      case 'warning': return thresholds.warning;
      case 'safe': return thresholds.safe;
    }
  }

  /**
   * ロスカットまでの予想時間を計算（分）
   */
  private predictTimeToLossCut(
    calculation: MarginCalculation,
    brokerName?: string
  ): number | undefined {
    const lossCutLevel = this.config.brokerLossCutLevels[brokerName || 'default'] || 20;
    
    if (calculation.marginLevel <= lossCutLevel) {
      return 0; // 既にロスカットレベル
    }

    // 単純な線形予測（実際にはより複雑な予測モデルが必要）
    // 現在の損失レートから予想時間を計算
    const currentProfit = calculation.totalProfit;
    
    if (currentProfit >= 0) {
      return undefined; // 利益状態では予測困難
    }

    const lossCutEquity = (calculation.marginUsed * lossCutLevel) / 100;
    const remainingEquity = calculation.effectiveEquity - lossCutEquity;
    
    // 1分あたりの損失額を現在の1分間の平均損失と仮定
    const lossPerMinute = Math.abs(currentProfit) / 60; // 仮定：現在の損失が60分間で発生
    
    if (lossPerMinute <= 0) {
      return undefined;
    }

    return Math.max(0, remainingEquity / lossPerMinute);
  }

  /**
   * 回復に必要な金額を計算
   */
  private calculateRequiredRecoveryAmount(
    calculation: MarginCalculation,
    brokerName?: string
  ): number {
    const safeLevel = this.config.thresholds.safe;
    const targetEquity = (calculation.marginUsed * safeLevel) / 100;
    return Math.max(0, targetEquity - calculation.effectiveEquity);
  }

  /**
   * リスクメッセージ生成
   */
  private generateRiskMessage(
    level: RiskLevel,
    marginLevel: number,
    threshold: number,
    timeToLossCut?: number
  ): string {
    const messages = {
      critical: `緊急：証拠金維持率${marginLevel.toFixed(1)}%（閾値${threshold}%）`,
      danger: `危険：証拠金維持率${marginLevel.toFixed(1)}%（閾値${threshold}%）`,
      warning: `警告：証拠金維持率${marginLevel.toFixed(1)}%（閾値${threshold}%）`,
      safe: `安全：証拠金維持率${marginLevel.toFixed(1)}%`,
    };

    let message = messages[level];
    
    if (timeToLossCut !== undefined && timeToLossCut < 60) {
      message += ` - ロスカットまで約${Math.round(timeToLossCut)}分`;
    }

    return message;
  }

  /**
   * リスクレベルをアラート重要度にマッピング
   */
  private mapRiskLevelToSeverity(level: RiskLevel): AlertCondition['severity'] {
    const mapping: Record<RiskLevel, AlertCondition['severity']> = {
      safe: 'info',
      warning: 'warning',
      danger: 'danger',
      critical: 'critical',
    };
    return mapping[level];
  }

  /**
   * リスクが改善されているかを判定
   */
  private isRiskImproving(previous: RiskLevel, current: RiskLevel): boolean {
    const levels = ['critical', 'danger', 'warning', 'safe'];
    const prevIndex = levels.indexOf(previous);
    const currIndex = levels.indexOf(current);
    return currIndex > prevIndex;
  }

  /**
   * リスクが悪化しているかを判定
   */
  private isRiskDeteriorating(previous: RiskLevel, current: RiskLevel): boolean {
    const levels = ['critical', 'danger', 'warning', 'safe'];
    const prevIndex = levels.indexOf(previous);
    const currIndex = levels.indexOf(current);
    return currIndex < prevIndex;
  }

  /**
   * アラートID生成
   */
  private generateAlertId(accountId: string, level: RiskLevel): string {
    const timestamp = Date.now();
    return `margin_${level}_${accountId}_${timestamp}`;
  }

  /**
   * ブローカー別のロスカット水準設定更新
   */
  updateBrokerLossCutLevel(brokerName: string, lossCutLevel: number): void {
    this.config.brokerLossCutLevels[brokerName] = lossCutLevel;
  }

  /**
   * アカウント別の閾値設定更新
   */
  updateAccountThresholds(accountId: string, thresholds: RiskThresholds): void {
    if (!this.config.customThresholds) {
      this.config.customThresholds = {};
    }
    this.config.customThresholds[accountId] = thresholds;
  }

  /**
   * 設定の取得
   */
  getConfig(): RiskDetectionConfig {
    return { ...this.config };
  }

  /**
   * デフォルト設定にリセット
   */
  resetToDefaults(): void {
    this.config = {
      thresholds: { ...RiskLevelDetector.DEFAULT_THRESHOLDS },
      brokerLossCutLevels: { ...RiskLevelDetector.DEFAULT_BROKER_LOSSCUT_LEVELS },
      enablePrediction: true,
      includeBonus: true,
      customThresholds: {},
    };
  }
}
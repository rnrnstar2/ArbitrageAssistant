// リスク管理関連の共通型定義

export interface RiskMetrics {
  accountId: string;
  maxDrawdown: number;
  currentDrawdown: number;
  riskPercentage: number;
  marginLevel: number;
  exposureLevel: number;
  timestamp: Date;
}

export interface RiskAlert {
  id: string;
  type: 'margin' | 'drawdown' | 'exposure' | 'correlation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  accountId: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
}

export interface LossCutSettings {
  accountId: string;
  enabled: boolean;
  marginLevelThreshold: number;
  maxDrawdownThreshold: number;
  emergencyCloseEnabled: boolean;
}

export interface BalanceThreshold {
  warningLevel: number;
  dangerLevel: number;
  emergencyLevel: number;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskAction = 'monitor' | 'warn' | 'limit';
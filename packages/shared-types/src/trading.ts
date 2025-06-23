// 取引関連の共通型定義
// Note: Position interface moved to position.ts
import type { Position } from './position.js';

export interface TradeCommand {
  id: string;
  action: 'open' | 'close' | 'modify';
  symbol: string;
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  accountId: string;
}

export interface TrailSettings {
  enabled: boolean;
  trailType: 'percentage' | 'pip' | 'price';
  trailValue: number;
  activationThreshold?: number;
  maxLoss?: number;
  timeBasedSettings?: {
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
    timezone: string;
  };
  conditions?: {
    minProfit: number;
    maxDrawdown: number;
    volatilityThreshold: number;
  };
}

export interface HedgeSettings {
  strategy: 'cross_account' | 'single_account' | 'correlation_based';
  ratio: number;
  correlationPairs: Array<{
    primary: string;
    hedge: string;
    correlation: number;
  }>;
  rebalanceRules?: {
    threshold: number;
    frequency: 'real_time' | 'hourly' | 'daily';
    maxPositionSize: number;
  };
  riskLimits: {
    maxExposure: number;
    maxLoss: number;
    correlationThreshold: number;
  };
}

export interface HedgeGroup {
  id: string;
  positions: Position[];
  netVolume: number;
  netProfit: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export type TradeStatus = 'pending' | 'executed' | 'failed' | 'cancelled';
// Note: PositionStatus moved to position.ts as enum

// ===== NEW ARCHITECTURE TYPES =====

export type TradeStrategy = 'ARBITRAGE' | 'HEDGE' | 'MANUAL';
export type WithdrawalRisk = 'SAFE' | 'CAUTION' | 'DANGER';

export interface MT4TradeRecord {
  tradeId: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  swapCost: number;
  openTime: Date;
  closeTime: Date;
}

export interface SystemTradeRecord {
  id: string;
  accountId: string;
  mt4TradeId: string;
  isSystemInitiated: boolean;
  strategy: TradeStrategy;
  symbol: string;
  volume: number;
  executedAt: Date;
}

export interface TradeAnalysis {
  totalTrades: number;
  totalVolume: number;
  systemTrades: {
    count: number;
    volume: number;
    trades: MT4TradeRecord[];
  };
  manualTrades: {
    count: number;
    volume: number;
    trades: MT4TradeRecord[];
  };
  patternDiversity: number;
}

export interface WithdrawalScore {
  score: number; // 0-100
  totalVolume: number;
  systemRatio: number; // 0-1
  manualRatio: number; // 0-1
  riskLevel: WithdrawalRisk;
  recommendations: string[];
  lastCalculated: Date;
}

export interface WithdrawalDashboardData {
  accounts: {
    id: string;
    broker: string;
    accountNumber: string;
    withdrawalScore: number;
    riskLevel: WithdrawalRisk;
    recommendations: string[];
    metrics: {
      totalVolume: number;
      systemRatio: number;
      manualRatio: number;
      lastManualTrade: Date | null;
    };
  }[];
}

export interface RealtimePosition {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: Date;
  // メモリベースのキャッシュデータ
  lastUpdate: Date;
  isStale?: boolean; // MT4同期が遅れている場合
}

export interface RealtimeAccount {
  id: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  positions: RealtimePosition[];
  // メモリベースのキャッシュデータ
  lastUpdate: Date;
  connectionStatus: 'connected' | 'disconnected';
}

// ===== TRADING LOGIC TYPES =====

export interface PriceData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
  spread: number;
}

export interface MarketConditions {
  volatility: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  session: 'asian' | 'european' | 'american' | 'overlap';
}

export interface EntryParams {
  symbol: string;
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface RiskAssessment {
  shouldClose: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metrics: TradingRiskMetrics;
}

export interface TradingRiskMetrics {
  unrealizedPnL: number;
  riskPercent: number;
  marginLevel: number;
  exposureBySymbol: Record<string, number>;
  totalExposure: number;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxExposurePerSymbol: number;
  marginCallLevel: number;
  stopOutLevel: number;
}
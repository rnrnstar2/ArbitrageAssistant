// 取引関連の共通型定義

export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: Date;
  accountId: string;
}

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
export type PositionStatus = 'open' | 'closed' | 'partial';
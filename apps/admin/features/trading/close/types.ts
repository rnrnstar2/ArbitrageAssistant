import { TrailSettings } from "../../monitoring/types";

export interface CloseFormData {
  positionId: string;
  closePrice: number;
  closeType: 'market' | 'limit';
  trailSettings?: {
    enabled: boolean;
    startPips: number;
    trailPips: number;
  };
  linkedAction?: {
    relatedPositionId: string;
    action: 'close' | 'trail' | 'none';
    settings?: TrailSettings;
  };
}

export interface CloseResult {
  id: string;
  positionId: string;
  status: 'pending' | 'executed' | 'failed';
  executedPrice?: number;
  profit?: number;
  closedAt?: Date;
  error?: string;
}

export interface HedgeCloseSettings {
  closeType: 'market' | 'limit';
  position1Price?: number;
  position2Price?: number;
  synchronous: boolean;
  trailBoth: boolean;
  trailSettings?: TrailSettings;
}

export interface CloseRecommendation {
  positionId: string;
  reason: 'high_swap' | 'long_holding' | 'profit_target' | 'risk_management';
  priority: 'low' | 'medium' | 'high';
  estimatedSavings?: number;
  swapCost: number;
  holdingDays: number;
  currentProfit: number;
}

export interface RebuildSettings {
  immediate: boolean;
  sameSymbol: boolean;
  sameLots: boolean;
  delayMinutes?: number;
  targetAccounts?: string[];
}

export interface BatchCloseInput {
  positionIds: string[];
  closeType: 'market' | 'limit';
  trailSettings?: TrailSettings;
  priority: 'normal' | 'high';
}

export interface BatchCloseResult {
  totalRequested: number;
  successful: number;
  failed: number;
  results: CloseResult[];
}

export interface ClosingSummary {
  dailyCloseCount: number;
  totalProfit: number;
  swapSaved: number;
  averageHoldingPeriod: number;
  successRate: number;
}
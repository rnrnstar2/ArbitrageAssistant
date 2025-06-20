import { TrailSettings } from "../../../../lib/websocket/message-types";

export enum RelationType {
  HEDGE = 'hedge',
  SAME_PAIR = 'same_pair',
  CORRELATION = 'correlation'
}

export interface LinkedPosition {
  position: Position;
  relationType: RelationType;
  correlation?: number;
}

export interface LinkedPositionGroup {
  primaryPosition: Position;
  linkedPositions: LinkedPosition[];
  totalExposure: number;
  netProfit: number;
}

export interface LinkedCloseSettings {
  enabled: boolean;
  closeOrder: 'simultaneous' | 'sequential';
  sequentialDelay?: number;
  rollbackOnFailure: boolean;
  partialCloseHandling: 'proportional' | 'primary_only';
}

export interface LinkedCloseAction {
  positionId: string;
  action: 'close' | 'trail' | 'none';
  closeType: 'market' | 'limit';
  targetPrice?: number;
  trailSettings?: TrailSettings;
  priority: number;
}

export interface LinkedCloseRequest {
  primaryPositionId: string;
  actions: LinkedCloseAction[];
  settings: LinkedCloseSettings;
}

export interface LinkedCloseResult {
  requestId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'partially_completed';
  results: Map<string, CloseResult>;
  rollbackRequired: boolean;
  completedAt?: Date;
  error?: string;
}

export interface CloseResult {
  positionId: string;
  status: 'pending' | 'executed' | 'failed';
  executedPrice?: number;
  profit?: number;
  closedAt?: Date;
  error?: string;
}

export interface PositionConsistencyCheck {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  totalExposure: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ConsistencyIssue {
  type: 'lot_mismatch' | 'price_divergence' | 'account_mismatch' | 'timing_issue';
  severity: 'warning' | 'error';
  description: string;
  affectedPositions: string[];
  recommendation?: string;
}

// Re-export Position type for consistency
export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openedAt: Date;
  relatedPositionId?: string;
}
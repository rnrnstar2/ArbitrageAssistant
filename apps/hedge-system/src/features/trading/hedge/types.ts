import { Position } from '../close/types';

export interface HedgePosition {
  id: string;
  positionIds: string[];
  symbol: string;
  hedgeType: 'perfect' | 'partial' | 'cross_account';
  accounts: string[];
  totalLots: {
    buy: number;
    sell: number;
  };
  totalProfit: number;
  isBalanced: boolean;
  createdAt: Date;
  lastRebalanced?: Date;
  settings: {
    autoRebalance: boolean;
    maxImbalance: number;
    maintainOnClose: boolean;
  };
}

export interface HedgeDetectionCriteria {
  symbol: string;
  timeWindow: number; // 分
  maxSpread: number; // pips
  minLotSize: number;
  accountGroups?: string[][];
}

export interface HedgeRelationship {
  hedgeId: string;
  positionId: string;
  role: 'primary' | 'hedge';
  createdAt: Date;
}

export interface HedgeValidationResult {
  isValid: boolean;
  issues: HedgeValidationIssue[];
  recommendations: string[];
}

export interface HedgeValidationIssue {
  type: 'lot_imbalance' | 'account_mismatch' | 'timing_issue' | 'orphaned_position';
  severity: 'warning' | 'error';
  description: string;
  affectedPositions: string[];
}
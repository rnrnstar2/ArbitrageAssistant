// Common types for all strategies
export type StrategyType = 'ENTRY' | 'EXIT';
export type StrategyStatus = 'DRAFT' | 'ACTIVE' | 'EXECUTING' | 'COMPLETED' | 'PAUSED' | 'ERROR';

export interface BaseStrategy {
  strategyId: string;
  name: string;
  type: StrategyType;
  status: StrategyStatus;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
  executedAt?: Date;
}

// Position specification for entry strategies
export interface PositionSpec {
  symbol: string;
  volume: number;
  direction: 'BUY' | 'SELL';
  trailWidth?: number; // Individual trail width override
}

// Entry Strategy
export interface EntryStrategy extends BaseStrategy {
  type: 'ENTRY';
  targetAccounts: string[];        // Target accounts (multiple)
  positions: PositionSpec[];       // Positions to create
  defaultTrailWidth: number;       // Default trail width for all positions
}

// Exit Strategy  
export interface ExitStrategy extends BaseStrategy {
  type: 'EXIT';
  selectedPositions: string[];     // Existing position IDs to close
  primaryPositionId: string;       // Main position for strategy logic
  trailWidth: number;             // Strategy trail width
}

// Union type for all strategies
export type Strategy = EntryStrategy | ExitStrategy;

// Legacy strategy interface for backward compatibility
export interface LegacyStrategy {
  strategyId: string;
  name: string;
  trailWidth: number;
  symbol?: string;
  maxRisk?: number;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create inputs
export interface CreateEntryStrategyInput {
  name: string;
  targetAccounts: string[];
  positions: PositionSpec[];
  defaultTrailWidth: number;
}

export interface CreateExitStrategyInput {
  name: string;
  selectedPositions: string[];
  primaryPositionId: string;
  trailWidth: number;
}

export type CreateStrategyInput = CreateEntryStrategyInput | CreateExitStrategyInput;

// Legacy create input for backward compatibility
export interface CreateLegacyStrategyInput {
  name: string;
  trailWidth: number;
  symbol?: string;
  maxRisk?: number;
}

// Update inputs
export interface UpdateStrategyInput {
  strategyId: string;
  name?: string;
  trailWidth?: number;
  symbol?: string;
  maxRisk?: number;
}
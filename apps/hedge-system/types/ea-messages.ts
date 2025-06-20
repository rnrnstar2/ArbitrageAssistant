/**
 * EA専用メッセージ型定義
 * 
 * このファイルはEA（Expert Advisor）側の実装で使用される型定義を提供します。
 * システム側の詳細な型定義から必要な部分のみを抽出し、EA実装を簡素化します。
 */

import type {
  BaseMessage,
  EAMessage,
  SystemCommand,
  PositionUpdateData,
  AccountInfoData,
  MarketData,
  LosscutAlert,
  HeartbeatData,
  OpenPositionCommand,
  ClosePositionCommand,
  UpdateTrailCommand,
  TestConnectionCommand,
  SystemConfigCommand,
} from '../lib/websocket/message-types';

import {
  createMessageId,
  createEAMessage,
  createPositionUpdateMessage,
  createAccountInfoMessage,
  createMarketDataMessage,
  createLosscutAlertMessage,
  createHeartbeatMessage,
  validateEAMessage,
  validateSystemCommand,
  safeParseEAMessage,
  safeParseSystemCommand,
  isEAMessage,
  isSystemCommand,
  isMarketDataMessage,
  isLosscutAlertMessage,
  isOpenPositionCommand,
  isClosePositionCommand,
  isUpdateTrailCommand,
  isTestConnectionCommand,
  isSystemConfigCommand,
  MESSAGE_TYPES,
  COMMAND_ACTIONS,
} from '../lib/websocket/message-types';

// Re-export core types
export type {
  BaseMessage,
  EAMessage,
  SystemCommand,
  PositionUpdateData,
  AccountInfoData,
  MarketData,
  LosscutAlert,
  HeartbeatData,
  OpenPositionCommand,
  ClosePositionCommand,
  UpdateTrailCommand,
  TestConnectionCommand,
  SystemConfigCommand,
};

// Re-export functions
export {
  createMessageId,
  createEAMessage,
  createPositionUpdateMessage,
  createAccountInfoMessage,
  createMarketDataMessage,
  createLosscutAlertMessage,
  createHeartbeatMessage,
  validateEAMessage,
  validateSystemCommand,
  safeParseEAMessage,
  safeParseSystemCommand,
  isEAMessage,
  isSystemCommand,
  isMarketDataMessage,
  isLosscutAlertMessage,
  isOpenPositionCommand,
  isClosePositionCommand,
  isUpdateTrailCommand,
  isTestConnectionCommand,
  isSystemConfigCommand,
  MESSAGE_TYPES,
  COMMAND_ACTIONS,
};

// EA-specific simplified interfaces for common use cases

/**
 * Simplified position data for EA reporting
 */
export interface SimplePositionData {
  positionId: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  status: 'open' | 'closed' | 'pending';
}

/**
 * Simplified account summary for EA reporting
 */
export interface SimpleAccountData {
  balance: number;
  equity: number;
  marginLevel: number;
  bonusAmount: number;
  profit: number;
  currency: string;
}

/**
 * Simple market tick data
 */
export interface SimpleMarketTick {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
}

/**
 * Basic connection status for EA
 */
export interface EAConnectionStatus {
  connected: boolean;
  lastHeartbeat: number;
  quality: number; // 0-100
  reconnectAttempts: number;
}

/**
 * EA-specific message creation helpers
 */
export class EAMessageBuilder {
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  /**
   * Create position update from simple position data
   */
  createPositionUpdate(position: SimplePositionData): EAMessage {
    const positionData: PositionUpdateData = {
      ...position,
      swapPoints: 0,
      commission: 0,
      openTime: new Date(),
    };
    return createPositionUpdateMessage(this.accountId, positionData);
  }

  /**
   * Create account update from simple account data
   */
  createAccountUpdate(account: SimpleAccountData): EAMessage {
    const accountData: AccountInfoData = {
      ...account,
      freeMargin: account.equity - (account.equity * 0.1), // Approximate
      marginUsed: account.equity * 0.1, // Approximate
      credit: 0,
    };
    return createAccountInfoMessage(this.accountId, accountData);
  }

  /**
   * Create market data from simple tick
   */
  createMarketData(tick: SimpleMarketTick): EAMessage {
    const marketData: MarketData = {
      ...tick,
      marketStatus: 'open' as const,
      lastUpdated: new Date(),
    };
    return createMarketDataMessage(this.accountId, marketData);
  }

  /**
   * Create simple heartbeat
   */
  createHeartbeat(connectionQuality?: number): EAMessage {
    const heartbeatData: HeartbeatData = {
      status: 'ok' as const,
      connectionQuality,
      lastActivity: new Date(),
    };
    return createHeartbeatMessage(this.accountId, heartbeatData);
  }

  /**
   * Create losscut warning
   */
  createLosscutWarning(
    marginLevel: number,
    thresholdLevel: number,
    affectedPositions: string[],
    estimatedLoss: number
  ): EAMessage {
    const alertData: LosscutAlert = {
      alertType: 'warning' as const,
      marginLevel,
      thresholdLevel,
      affectedPositions,
      estimatedLoss,
      message: `Margin level ${marginLevel}% is approaching threshold ${thresholdLevel}%`,
    };
    return createLosscutAlertMessage(this.accountId, alertData);
  }
}

/**
 * EA-specific command handler utility
 */
export class EACommandHandler {
  /**
   * Extract open position parameters from system command
   */
  static extractOpenPositionParams(command: SystemCommand): OpenPositionCommand | null {
    if (command.type !== 'open_position') return null;
    return command.data as OpenPositionCommand;
  }

  /**
   * Extract close position parameters from system command
   */
  static extractClosePositionParams(command: SystemCommand): ClosePositionCommand | null {
    if (command.type !== 'close_position') return null;
    return command.data as ClosePositionCommand;
  }

  /**
   * Extract trail update parameters from system command
   */
  static extractTrailUpdateParams(command: SystemCommand): UpdateTrailCommand | null {
    if (command.type !== 'update_trail') return null;
    return command.data as UpdateTrailCommand;
  }

  /**
   * Extract test connection parameters from system command
   */
  static extractTestParams(command: SystemCommand): TestConnectionCommand | null {
    if (command.type !== 'test_connection') return null;
    return command.data as TestConnectionCommand;
  }

  /**
   * Extract system config parameters from system command
   */
  static extractConfigParams(command: SystemCommand): SystemConfigCommand | null {
    if (command.type !== 'system_config') return null;
    return command.data as SystemConfigCommand;
  }
}

/**
 * EA-specific error types
 */
export interface EAError {
  code: string;
  message: string;
  commandId?: string;
  positionId?: string;
  details?: any;
}

/**
 * Common EA error codes
 */
export const EA_ERROR_CODES = {
  INVALID_SYMBOL: 'EA_INVALID_SYMBOL',
  INSUFFICIENT_MARGIN: 'EA_INSUFFICIENT_MARGIN',
  MARKET_CLOSED: 'EA_MARKET_CLOSED',
  POSITION_NOT_FOUND: 'EA_POSITION_NOT_FOUND',
  CONNECTION_LOST: 'EA_CONNECTION_LOST',
  COMMAND_TIMEOUT: 'EA_COMMAND_TIMEOUT',
  INVALID_COMMAND: 'EA_INVALID_COMMAND',
  BROKER_ERROR: 'EA_BROKER_ERROR',
} as const;

/**
 * EA-specific utility functions
 */
export const EAUtils = {
  /**
   * Generate standard error message for EA
   */
  createError(code: string, message: string, commandId?: string, positionId?: string): EAError {
    return {
      code,
      message,
      commandId,
      positionId,
      details: { timestamp: Date.now() },
    };
  },

  /**
   * Check if margin level is safe
   */
  isMarginLevelSafe(marginLevel: number, warningThreshold: number = 200): boolean {
    return marginLevel > warningThreshold;
  },

  /**
   * Calculate spread in pips (assuming 4-digit quotes)
   */
  calculateSpreadPips(bid: number, ask: number, digits: number = 4): number {
    const multiplier = Math.pow(10, digits);
    return (ask - bid) * multiplier;
  },

  /**
   * Format message for EA logging
   */
  formatLogMessage(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level}: ${message}${dataStr}`;
  },
};
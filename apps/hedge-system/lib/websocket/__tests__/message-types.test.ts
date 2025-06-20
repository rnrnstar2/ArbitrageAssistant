/**
 * Message Types Test
 * 
 * Tests for the enhanced message types, validation, and factory functions
 */

import { describe, it, expect } from 'vitest';
import {
  createEAMessage,
  createSystemCommand,
  createPositionUpdateMessage,
  createAccountInfoMessage,
  createMarketDataMessage,
  createLosscutAlertMessage,
  createHeartbeatMessage,
  createOpenPositionCommand,
  createClosePositionCommand,
  createUpdateTrailCommand,
  createTestConnectionCommand,
  createSystemConfigCommand,
  validateEAMessage,
  validateSystemCommand,
  safeParseEAMessage,
  safeParseSystemCommand,
  isEAMessage,
  isSystemCommand,
  isMarketDataMessage,
  isLosscutAlertMessage,
  MESSAGE_TYPES,
  COMMAND_ACTIONS,
  type PositionUpdateData,
  type AccountInfoData,
  type MarketData,
  type LosscutAlert,
  type HeartbeatData,
  type OpenPositionCommand,
  type ClosePositionCommand,
  type UpdateTrailCommand,
  type TestConnectionCommand,
  type SystemConfigCommand,
} from '../message-types';

describe('Message Factory Functions', () => {
  const accountId = 'test-account-123';

  describe('EA Message Creation', () => {
    it('should create position update message', () => {
      const positionData: PositionUpdateData = {
        positionId: 'pos-123',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 0.1,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50,
        swapPoints: 0,
        commission: 0,
        status: 'open',
        openTime: new Date(),
      };

      const message = createPositionUpdateMessage(accountId, positionData);

      expect(message.version).toBe('1.0');
      expect(message.type).toBe('position_update');
      expect(message.accountId).toBe(accountId);
      expect(message.data).toEqual(positionData);
      expect(message.messageId).toMatch(/^msg_/);
      expect(typeof message.timestamp).toBe('number');
    });

    it('should create account info message', () => {
      const accountData: AccountInfoData = {
        balance: 10000,
        equity: 10050,
        freeMargin: 9000,
        marginLevel: 1000,
        bonusAmount: 500,
        profit: 50,
        credit: 0,
        marginUsed: 1000,
        currency: 'USD',
      };

      const message = createAccountInfoMessage(accountId, accountData);

      expect(message.type).toBe('account_update');
      expect(message.data).toEqual(accountData);
    });

    it('should create market data message', () => {
      const marketData: MarketData = {
        symbol: 'EURUSD',
        bid: 1.1000,
        ask: 1.1002,
        spread: 0.0002,
        marketStatus: 'open',
        lastUpdated: new Date(),
      };

      const message = createMarketDataMessage(accountId, marketData);

      expect(message.type).toBe('market_data');
      expect(message.data).toEqual(marketData);
    });

    it('should create losscut alert message', () => {
      const alertData: LosscutAlert = {
        alertType: 'warning',
        marginLevel: 150,
        thresholdLevel: 100,
        affectedPositions: ['pos-123', 'pos-456'],
        estimatedLoss: 1000,
        message: 'Margin level approaching threshold',
      };

      const message = createLosscutAlertMessage(accountId, alertData);

      expect(message.type).toBe('losscut_alert');
      expect(message.data).toEqual(alertData);
    });

    it('should create heartbeat message', () => {
      const heartbeatData: HeartbeatData = {
        status: 'ok',
        connectionQuality: 95,
        lastActivity: new Date(),
      };

      const message = createHeartbeatMessage(accountId, heartbeatData);

      expect(message.type).toBe('heartbeat');
      expect(message.data).toEqual(heartbeatData);
    });
  });

  describe('System Command Creation', () => {
    it('should create open position command', () => {
      const commandData: OpenPositionCommand = {
        symbol: 'EURUSD',
        type: 'buy',
        lots: 0.1,
        price: 1.1000,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        comment: 'Test trade',
      };

      const command = createOpenPositionCommand(accountId, commandData);

      expect(command.type).toBe('open_position');
      expect(command.data).toEqual(commandData);
      expect(command.commandId).toMatch(/^msg_/);
    });

    it('should create close position command', () => {
      const commandData: ClosePositionCommand = {
        positionId: 'pos-123',
        lots: 0.05,
        price: 1.1050,
        slippage: 3,
      };

      const command = createClosePositionCommand(accountId, commandData);

      expect(command.type).toBe('close_position');
      expect(command.data).toEqual(commandData);
    });

    it('should create update trail command', () => {
      const commandData: UpdateTrailCommand = {
        positionId: 'pos-123',
        trailAmount: 50,
        startPrice: 1.1050,
        step: 10,
      };

      const command = createUpdateTrailCommand(accountId, commandData);

      expect(command.type).toBe('update_trail');
      expect(command.data).toEqual(commandData);
    });

    it('should create test connection command', () => {
      const commandData: TestConnectionCommand = {
        testType: 'ping',
        payload: 'test-payload',
      };

      const command = createTestConnectionCommand(accountId, commandData);

      expect(command.type).toBe('test_connection');
      expect(command.data).toEqual(commandData);
    });

    it('should create system config command', () => {
      const commandData: SystemConfigCommand = {
        configType: 'heartbeat_interval',
        settings: { interval: 30000 },
      };

      const command = createSystemConfigCommand(accountId, commandData);

      expect(command.type).toBe('system_config');
      expect(command.data).toEqual(commandData);
    });
  });
});

describe('Message Validation', () => {
  const accountId = 'test-account-123';

  describe('EA Message Validation', () => {
    it('should validate valid EA message', () => {
      const message = createHeartbeatMessage(accountId);
      
      expect(validateEAMessage(message)).toBe(true);
      expect(isEAMessage(message)).toBe(true);
    });

    it('should reject invalid EA message', () => {
      const invalidMessage = {
        version: '1.0',
        type: 'invalid_type',
        timestamp: Date.now(),
        messageId: 'test-id',
        accountId: 'test-account',
        data: {},
      };

      expect(validateEAMessage(invalidMessage)).toBe(false);
    });

    it('should safe parse EA message', () => {
      const validMessage = createHeartbeatMessage(accountId);
      const result = safeParseEAMessage(validMessage);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('heartbeat');
      }
    });

    it('should handle safe parse errors', () => {
      const invalidMessage = { invalid: 'data' };
      const result = safeParseEAMessage(invalidMessage);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('System Command Validation', () => {
    it('should validate valid system command', () => {
      const command = createTestConnectionCommand(accountId, { testType: 'ping' });
      
      expect(validateSystemCommand(command)).toBe(true);
      expect(isSystemCommand(command)).toBe(true);
    });

    it('should reject invalid system command', () => {
      const invalidCommand = {
        version: '1.0',
        type: 'invalid_command',
        timestamp: Date.now(),
        messageId: 'test-id',
        accountId: 'test-account',
        commandId: 'cmd-123',
        data: {},
      };

      expect(validateSystemCommand(invalidCommand)).toBe(false);
    });
  });
});

describe('Type Guards', () => {
  const accountId = 'test-account-123';

  it('should identify market data messages', () => {
    const marketData: MarketData = {
      symbol: 'EURUSD',
      bid: 1.1000,
      ask: 1.1002,
      spread: 0.0002,
      marketStatus: 'open',
      lastUpdated: new Date(),
    };
    
    const message = createMarketDataMessage(accountId, marketData);
    
    expect(isMarketDataMessage(message)).toBe(true);
    expect(isLosscutAlertMessage(message)).toBe(false);
  });

  it('should identify losscut alert messages', () => {
    const alertData: LosscutAlert = {
      alertType: 'critical',
      marginLevel: 80,
      thresholdLevel: 100,
      affectedPositions: ['pos-123'],
      estimatedLoss: 2000,
      message: 'Critical margin level',
    };
    
    const message = createLosscutAlertMessage(accountId, alertData);
    
    expect(isLosscutAlertMessage(message)).toBe(true);
    expect(isMarketDataMessage(message)).toBe(false);
  });
});

describe('Constants', () => {
  it('should have correct message types', () => {
    expect(MESSAGE_TYPES.POSITION_UPDATE).toBe('position_update');
    expect(MESSAGE_TYPES.ACCOUNT_UPDATE).toBe('account_update');
    expect(MESSAGE_TYPES.MARKET_DATA).toBe('market_data');
    expect(MESSAGE_TYPES.LOSSCUT_ALERT).toBe('losscut_alert');
    expect(MESSAGE_TYPES.HEARTBEAT).toBe('heartbeat');
  });

  it('should have correct command actions', () => {
    expect(COMMAND_ACTIONS.OPEN_POSITION).toBe('open_position');
    expect(COMMAND_ACTIONS.CLOSE_POSITION).toBe('close_position');
    expect(COMMAND_ACTIONS.UPDATE_TRAIL).toBe('update_trail');
    expect(COMMAND_ACTIONS.TEST_CONNECTION).toBe('test_connection');
    expect(COMMAND_ACTIONS.SYSTEM_CONFIG).toBe('system_config');
  });
});
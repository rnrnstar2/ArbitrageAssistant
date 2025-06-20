import { describe, it, expect, beforeEach } from 'vitest';
import {
  EADataValidator,
  validateEAMessage,
  validatePosition,
  VALIDATION_ERROR_CODES,
} from '../validation';
import {
  ValidationContext,
  ValidationResult,
} from '../types';
import {
  Position,
  PositionUpdateData,
  AccountUpdateData,
  HeartbeatData,
  CommandResponse,
} from '../../types';

describe('EADataValidator', () => {
  let validator: EADataValidator;
  let context: ValidationContext;

  beforeEach(() => {
    validator = new EADataValidator();
    context = {
      accountId: 'test-account-123',
      timestamp: new Date(),
      messageType: 'position_update',
    };
  });

  describe('Position Validation', () => {
    it('should validate correct position data', () => {
      const validPosition: Position = {
        ticket: 12345,
        symbol: 'EURUSD',
        type: 'buy',
        volume: 0.1,
        openPrice: 1.2345,
        currentPrice: 1.2350,
        profit: 5.0,
        swap: 0.0,
        sl: 1.2300,
        tp: 1.2400,
        openTime: new Date(),
        comment: 'test position',
      };

      const result = validatePosition(validPosition);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject position with missing required fields', () => {
      const invalidPosition = {
        symbol: 'EURUSD',
        type: 'buy',
        // ticket missing
        volume: 0.1,
        openPrice: 1.2345,
        currentPrice: 1.2350,
      } as Position;

      const result = validatePosition(invalidPosition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('ticket'),
          code: VALIDATION_ERROR_CODES.REQUIRED_FIELD_MISSING,
          severity: 'critical',
        })
      );
    });

    it('should reject position with invalid volume', () => {
      const invalidPosition: Position = {
        ticket: 12345,
        symbol: 'EURUSD',
        type: 'buy',
        volume: 0, // invalid volume
        openPrice: 1.2345,
        currentPrice: 1.2350,
        profit: 0,
        swap: 0,
        sl: 0,
        tp: 0,
        openTime: new Date(),
        comment: '',
      };

      const result = validatePosition(invalidPosition);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('volume'))).toBe(true);
    });

    it('should reject position with invalid symbol format', () => {
      const invalidPosition: Position = {
        ticket: 12345,
        symbol: 'EUR', // invalid symbol format
        type: 'buy',
        volume: 0.1,
        openPrice: 1.2345,
        currentPrice: 1.2350,
        profit: 0,
        swap: 0,
        sl: 0,
        tp: 0,
        openTime: new Date(),
        comment: '',
      };

      const result = validatePosition(invalidPosition);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.field.includes('symbol') && 
        e.code === VALIDATION_ERROR_CODES.INVALID_FORMAT
      )).toBe(true);
    });

    it('should reject position with invalid type', () => {
      const invalidPosition: Position = {
        ticket: 12345,
        symbol: 'EURUSD',
        type: 'invalid' as any, // invalid type
        volume: 0.1,
        openPrice: 1.2345,
        currentPrice: 1.2350,
        profit: 0,
        swap: 0,
        sl: 0,
        tp: 0,
        openTime: new Date(),
        comment: '',
      };

      const result = validatePosition(invalidPosition);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('type'))).toBe(true);
    });
  });

  describe('PositionUpdateData Validation', () => {
    it('should validate correct position update data', async () => {
      const validData: PositionUpdateData = {
        type: 'position_update',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        positions: [
          {
            ticket: 12345,
            symbol: 'EURUSD',
            type: 'buy',
            volume: 0.1,
            openPrice: 1.2345,
            currentPrice: 1.2350,
            profit: 5.0,
            swap: 0.0,
            sl: 1.2300,
            tp: 1.2400,
            openTime: new Date(),
            comment: 'test position',
          },
        ],
      };

      const result = await validator.validateEAMessage(validData, context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject position update with missing accountId', async () => {
      const invalidData = {
        type: 'position_update',
        // accountId missing
        timestamp: Date.now(),
        positions: [],
      } as PositionUpdateData;

      const result = await validator.validateEAMessage(invalidData, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'accountId')).toBe(true);
    });

    it('should reject position update with invalid timestamp', async () => {
      const invalidData: PositionUpdateData = {
        type: 'position_update',
        accountId: 'test-account-123',
        timestamp: 'invalid' as any, // invalid timestamp
        positions: [],
      };

      const result = await validator.validateEAMessage(invalidData, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'timestamp' && 
        e.code === VALIDATION_ERROR_CODES.INVALID_TIMESTAMP
      )).toBe(true);
    });
  });

  describe('AccountUpdateData Validation', () => {
    it('should validate correct account update data', async () => {
      const validData: AccountUpdateData = {
        type: 'account_update',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        balance: 1000.0,
        equity: 1005.0,
        margin: 100.0,
        marginFree: 905.0,
        marginLevel: 1005.0,
        credit: 0.0,
        profit: 5.0,
        server: 'Demo Server',
        currency: 'USD',
      };

      const result = await validator.validateEAMessage(validData, context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject account update with invalid currency', async () => {
      const invalidData: AccountUpdateData = {
        type: 'account_update',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        balance: 1000.0,
        equity: 1005.0,
        margin: 100.0,
        marginFree: 905.0,
        marginLevel: 1005.0,
        credit: 0.0,
        profit: 5.0,
        server: 'Demo Server',
        currency: 'INVALID', // invalid currency format
      };

      const result = await validator.validateEAMessage(invalidData, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.field.includes('currency') && 
        e.code === VALIDATION_ERROR_CODES.INVALID_FORMAT
      )).toBe(true);
    });

    it('should warn about negative balance', async () => {
      const dataWithNegativeBalance: AccountUpdateData = {
        type: 'account_update',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        balance: -100.0, // negative balance
        equity: 1005.0,
        margin: 100.0,
        marginFree: 905.0,
        marginLevel: 1005.0,
        credit: 0.0,
        profit: 5.0,
        server: 'Demo Server',
        currency: 'USD',
      };

      const result = await validator.validateEAMessage(dataWithNegativeBalance, context);
      expect(result.warnings.some(w => w.field.includes('balance'))).toBe(true);
    });
  });

  describe('HeartbeatData Validation', () => {
    it('should validate correct heartbeat data', async () => {
      const validData: HeartbeatData = {
        type: 'heartbeat',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        status: 'online',
      };

      const result = await validator.validateEAMessage(validData, context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about stale heartbeat', async () => {
      const staleData: HeartbeatData = {
        type: 'heartbeat',
        accountId: 'test-account-123',
        timestamp: Date.now() - 60000, // 1 minute ago
        status: 'online',
      };

      const result = await validator.validateEAMessage(staleData, context);
      expect(result.warnings.some(w => w.code === 'STALE_TIMESTAMP')).toBe(true);
    });
  });

  describe('CommandResponse Validation', () => {
    it('should validate correct command response', async () => {
      const validData: CommandResponse = {
        type: 'command_response',
        commandId: 'cmd-123',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        status: 'success',
        result: { ticket: 12345 },
      };

      const result = await validator.validateEAMessage(validData, context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject command response with missing commandId', async () => {
      const invalidData = {
        type: 'command_response',
        // commandId missing
        accountId: 'test-account-123',
        timestamp: Date.now(),
        status: 'success',
      } as CommandResponse;

      const result = await validator.validateEAMessage(invalidData, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'commandId')).toBe(true);
    });

    it('should reject command response with invalid status', async () => {
      const invalidData: CommandResponse = {
        type: 'command_response',
        commandId: 'cmd-123',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        status: 'invalid' as any, // invalid status
      };

      const result = await validator.validateEAMessage(invalidData, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'status' && 
        e.code === VALIDATION_ERROR_CODES.INVALID_FORMAT
      )).toBe(true);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize string values', async () => {
      const dataWithSpaces: PositionUpdateData = {
        type: 'position_update',
        accountId: '  test-account-123  ', // spaces
        timestamp: Date.now(),
        positions: [
          {
            ticket: 12345,
            symbol: '  eurusd  ', // lowercase with spaces
            type: 'buy',
            volume: 0.1,
            openPrice: 1.2345,
            currentPrice: 1.2350,
            profit: 5.0,
            swap: 0.0,
            sl: 1.2300,
            tp: 1.2400,
            openTime: new Date(),
            comment: '  test position  ',
          },
        ],
      };

      const result = await validator.validateEAMessage(dataWithSpaces, context);
      // Should pass validation after sanitization
      expect(result.isValid).toBe(true);
    });

    it('should convert string numbers to numbers', async () => {
      const dataWithStringNumbers = {
        type: 'position_update',
        accountId: 'test-account-123',
        timestamp: '1234567890', // string timestamp
        positions: [
          {
            ticket: '12345', // string ticket
            symbol: 'EURUSD',
            type: 'buy',
            volume: '0.1', // string volume
            openPrice: '1.2345', // string price
            currentPrice: '1.2350',
            profit: '5.0',
            swap: '0.0',
            sl: '1.2300',
            tp: '1.2400',
            openTime: new Date(),
            comment: 'test position',
          },
        ],
      } as any;

      const result = await validator.validateEAMessage(dataWithStringNumbers, context);
      // Should pass validation after conversion
      expect(result.isValid).toBe(true);
    });
  });

  describe('Unknown Message Type', () => {
    it('should reject unknown message type', async () => {
      const unknownMessage = {
        type: 'unknown_type',
        accountId: 'test-account-123',
        timestamp: Date.now(),
      } as any;

      const result = await validator.validateEAMessage(unknownMessage, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.field === 'type' && 
        e.code === VALIDATION_ERROR_CODES.INVALID_TYPE
      )).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    it('validateEAMessage should work as standalone function', async () => {
      const validData: HeartbeatData = {
        type: 'heartbeat',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        status: 'online',
      };

      const result = await validateEAMessage(validData, 'test-account-123');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Custom Schema', () => {
    it('should allow custom validation schemas', () => {
      const customValidator = new EADataValidator({
        custom: {
          entity: 'position',
          strictMode: true,
          rules: [
            {
              field: 'customField',
              type: 'required',
              constraint: null,
              message: 'Custom field is required',
              severity: 'error',
            },
          ],
        },
      });

      expect(customValidator).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted data gracefully', async () => {
      const corruptedData = null;

      const result = await validator.validateEAMessage(corruptedData as any, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => 
        e.code === VALIDATION_ERROR_CODES.CORRUPTED_DATA
      )).toBe(true);
    });

    it('should handle circular references gracefully', async () => {
      const circularData: any = {
        type: 'position_update',
        accountId: 'test-account-123',
        timestamp: Date.now(),
        positions: [],
      };
      circularData.self = circularData; // create circular reference

      const result = await validator.validateEAMessage(circularData, context);
      // Should not throw error, but may fail validation
      expect(result).toBeDefined();
    });
  });
});
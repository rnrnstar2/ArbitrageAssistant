import { describe, test, expect, beforeEach } from 'vitest';
import { WebSocketClient } from '../websocket-client';
import { WebSocketLogger, createComponentLogger } from '../logger';
import { type WebSocketMessage } from '../message-types';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send functionality
    console.log('Mock WebSocket sending:', data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('WebSocket Message Logger', () => {
  let logger: WebSocketLogger;

  beforeEach(() => {
    logger = new WebSocketLogger({
      level: 'debug',
      enableConsole: false,
      enableFile: false,
      enableRemote: false,
      maxEntries: 100
    });
  });

  describe('Component Logger', () => {
    test('should create component logger', () => {
      const componentLogger = createComponentLogger('test-component');
      expect(componentLogger).toBeDefined();
      expect(typeof componentLogger.info).toBe('function');
      expect(typeof componentLogger.debug).toBe('function');
      expect(typeof componentLogger.warning).toBe('function');
      expect(typeof componentLogger.error).toBe('function');
    });

    test('should log messages with component logger', () => {
      const componentLogger = createComponentLogger('test-component');
      
      // These should not throw errors
      componentLogger.info('Test info message');
      componentLogger.debug('Test debug message');
      componentLogger.warning('Test warning message');
      componentLogger.error('Test error message');
    });
  });

  describe('WebSocketLogger', () => {
    test('should record log entries', () => {
      logger.info('test-component', 'Test message', { data: 'test' });
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].component).toBe('test-component');
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].data).toEqual({ data: 'test' });
    });

    test('should filter logs by level', () => {
      logger.debug('test', 'Debug message');
      logger.info('test', 'Info message');
      logger.warning('test', 'Warning message');
      logger.error('test', 'Error message');

      const errorLogs = logger.getLogs({ level: 'error' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('error');

      const warningAndAbove = logger.getLogs({ level: 'warning' });
      expect(warningAndAbove).toHaveLength(2);
    });

    test('should filter logs by component', () => {
      logger.info('component1', 'Message from component1');
      logger.info('component2', 'Message from component2');
      logger.warning('component1', 'Warning from component1');

      const component1Logs = logger.getLogs({ component: 'component1' });
      expect(component1Logs).toHaveLength(2);
      expect(component1Logs.every(log => log.component === 'component1')).toBe(true);
    });

    test('should provide statistics', () => {
      logger.info('component1', 'Message 1');
      logger.warning('component2', 'Message 2');
      logger.error('component1', 'Message 3');

      const stats = logger.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByLevel.info).toBe(1);
      expect(stats.entriesByLevel.warning).toBe(1);
      expect(stats.entriesByLevel.error).toBe(1);
      expect(stats.entriesByComponent.component1).toBe(2);
      expect(stats.entriesByComponent.component2).toBe(1);
    });

    test('should maintain max entries limit', () => {
      const smallLogger = new WebSocketLogger({
        level: 'debug',
        maxEntries: 3,
        enableConsole: false
      });

      for (let i = 0; i < 5; i++) {
        smallLogger.info('test', `Message ${i}`);
      }

      const logs = smallLogger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Message 2'); // Should have dropped first 2
      expect(logs[2].message).toBe('Message 4');
    });

    test('should handle time-based filtering', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      logger.info('test', 'Recent message');
      
      const recentLogs = logger.getLogs({ since: yesterday });
      expect(recentLogs).toHaveLength(1);
      
      const futureLogs = logger.getLogs({ until: yesterday });
      expect(futureLogs).toHaveLength(0);
    });

    test('should support log level changes', () => {
      logger.setLogLevel('warning');
      
      logger.debug('test', 'Debug message'); // Should be ignored
      logger.info('test', 'Info message');   // Should be ignored
      logger.warning('test', 'Warning message'); // Should be logged
      logger.error('test', 'Error message');  // Should be logged
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs.every(log => ['warning', 'error'].includes(log.level))).toBe(true);
    });

    test('should clear logs', () => {
      logger.info('test', 'Message 1');
      logger.info('test', 'Message 2');
      
      expect(logger.getLogs()).toHaveLength(2);
      
      logger.clearLogs();
      
      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('WebSocketClient Logger Integration', () => {
    test('should initialize with logger', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        clientId: 'test-client',
        userId: 'test-user',
        logLevel: 'debug',
        enableMessageLogging: true
      });

      const clientLogger = client.getLogger();
      expect(clientLogger).toBeDefined();
      
      client.disconnect();
    });

    test('should allow log level changes', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        clientId: 'test-client',
        userId: 'test-user',
        logLevel: 'info',
        enableMessageLogging: true
      });

      expect(() => client.setLogLevel('debug')).not.toThrow();
      expect(() => client.setMessageLogging(false)).not.toThrow();
      
      client.disconnect();
    });

    test('should handle message send failures without throwing', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        clientId: 'test-client',
        userId: 'test-user',
        logLevel: 'debug',
        enableMessageLogging: true
      });

      const testMessage: WebSocketMessage = {
        type: 'heartbeat',
        payload: {},
        timestamp: Date.now()
      };

      // Should not throw error when sending without connection
      expect(() => client.send(testMessage)).not.toThrow();
      
      client.disconnect();
    });

    test('should log connection events', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        clientId: 'test-client',
        userId: 'test-user',
        logLevel: 'debug',
        enableMessageLogging: true
      });

      // Should not throw when connecting
      expect(() => client.connect()).not.toThrow();
      
      // Wait a bit for connection
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should not throw when disconnecting
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle logger errors gracefully', () => {
      const componentLogger = createComponentLogger('error-test');
      
      // Should not throw for various error types
      expect(() => componentLogger.error('Test error with Error object', new Error('Test error'))).not.toThrow();
      expect(() => componentLogger.error('Test error with string')).not.toThrow();
      expect(() => componentLogger.error('Test error with data', undefined, { extra: 'data' })).not.toThrow();
    });

    test('should handle invalid log filters', () => {
      logger.info('test', 'Test message');
      
      // Should handle invalid filter gracefully
      expect(() => logger.getLogs({ level: 'invalid' as any })).not.toThrow();
    });
  });
});
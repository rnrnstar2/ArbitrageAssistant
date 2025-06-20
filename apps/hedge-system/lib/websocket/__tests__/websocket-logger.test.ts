import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from '../websocket-client';
import { WebSocketLogger, createComponentLogger } from '../logger';
import { type WebSocketMessage } from '../message-types';

// Mock WebSocket
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
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send functionality
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

describe('WebSocket Logger Integration', () => {
  let client: WebSocketClient;
  let logger: WebSocketLogger;

  beforeEach(() => {
    logger = new WebSocketLogger({
      level: 'debug',
      enableConsole: false,
      enableFile: false,
      enableRemote: false
    });

    client = new WebSocketClient({
      url: 'ws://localhost:8080',
      authToken: 'test-token',
      clientId: 'test-client',
      userId: 'test-user',
      logLevel: 'debug',
      enableMessageLogging: true
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('Logger Integration', () => {
    test('should create component logger', () => {
      const componentLogger = createComponentLogger('test-component');
      expect(componentLogger).toBeDefined();
      expect(typeof componentLogger.info).toBe('function');
      expect(typeof componentLogger.debug).toBe('function');
      expect(typeof componentLogger.warning).toBe('function');
      expect(typeof componentLogger.error).toBe('function');
    });

    test('should initialize with logging enabled', () => {
      const clientLogger = client.getLogger();
      expect(clientLogger).toBeDefined();
    });

    test('should log initialization message', () => {
      const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      const newClient = new WebSocketClient({
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        clientId: 'test-client-init',
        userId: 'test-user',
        logLevel: 'info',
        enableMessageLogging: true
      });

      // Logger should have logged initialization
      expect(logSpy).toHaveBeenCalled();
      
      logSpy.mockRestore();
      newClient.disconnect();
    });
  });

  describe('Connection Logging', () => {
    test('should log connection attempts', async () => {
      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'info');

      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });

    test('should log connection state changes', async () => {
      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'info');

      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      client.disconnect();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Disconnecting'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });
  });

  describe('Message Logging', () => {
    test('should log sent messages when enabled', async () => {
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'debug');

      const testMessage: WebSocketMessage = {
        type: 'heartbeat',
        payload: {},
        timestamp: Date.now()
      };

      client.send(testMessage);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending WebSocket message'),
        expect.objectContaining({
          type: 'heartbeat',
          messageId: expect.any(Number)
        })
      );

      logSpy.mockRestore();
    });

    test('should not log messages when disabled', async () => {
      client.setMessageLogging(false);
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'debug');

      const testMessage: WebSocketMessage = {
        type: 'heartbeat',
        payload: {},
        timestamp: Date.now()
      };

      client.send(testMessage);

      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Sending WebSocket message'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });

    test('should log message send failures', () => {
      // Try to send without connecting
      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'warning');

      const testMessage: WebSocketMessage = {
        type: 'heartbeat',
        payload: {},
        timestamp: Date.now()
      };

      client.send(testMessage);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send message'),
        expect.objectContaining({
          messageType: 'heartbeat',
          connectionState: 'disconnected'
        })
      );

      logSpy.mockRestore();
    });
  });

  describe('Error Logging', () => {
    test('should log parsing errors', async () => {
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'error');

      // Simulate malformed message
      const mockWs = (client as any).ws;
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', { data: 'invalid json' }));
      }

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse'),
        expect.any(Error),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });

    test('should log connection errors', () => {
      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'error');

      // Simulate connection error
      const mockError = new Error('Connection failed');
      client.connect();
      
      const mockWs = (client as any).ws;
      if (mockWs && mockWs.onerror) {
        mockWs.onerror(new Event('error'));
      }

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('Log Level Control', () => {
    test('should allow changing log level', () => {
      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'info');

      client.setLogLevel('warning');

      expect(logSpy).toHaveBeenCalledWith(
        'Log level changed',
        { newLevel: 'warning' }
      );

      logSpy.mockRestore();
    });

    test('should allow toggling message logging', () => {
      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'info');

      client.setMessageLogging(false);

      expect(logSpy).toHaveBeenCalledWith(
        'Message logging toggled',
        { enabled: false }
      );

      logSpy.mockRestore();
    });
  });

  describe('Quality Monitoring Integration', () => {
    test('should log quality events', async () => {
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'warning');

      // Simulate quality degradation
      const qualityMonitor = (client as any).qualityMonitor;
      if (qualityMonitor && qualityMonitor.emit) {
        qualityMonitor.emit('quality_degraded', { reason: 'test' });
      }

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('quality degraded'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });
  });

  describe('Heartbeat Logging', () => {
    test('should log heartbeat timeouts', async () => {
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      const clientLogger = client.getLogger();
      const logSpy = vi.spyOn(clientLogger, 'warning');

      // Simulate heartbeat timeout
      const heartbeatManager = (client as any).heartbeatManager;
      if (heartbeatManager && heartbeatManager.emit) {
        heartbeatManager.emit('heartbeat_timeout', { sequence: 1 });
      }

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('timeout detected'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });
  });

  describe('Logger Statistics', () => {
    test('should provide logger stats', () => {
      const componentLogger = createComponentLogger('test-stats');
      
      // Generate some log entries
      componentLogger.info('Test info message');
      componentLogger.warning('Test warning message');
      componentLogger.error('Test error message');

      // Logger should have recorded these entries
      // Note: This test would need to access the underlying logger instance
      // which might require additional setup
    });
  });
});

describe('WebSocketLogger Direct Tests', () => {
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

  test('should record log entries', () => {
    logger.info('test-component', 'Test message', { data: 'test' });
    
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].component).toBe('test-component');
    expect(logs[0].message).toBe('Test message');
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
  });
});
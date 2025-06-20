import { WebSocketClient } from '../websocket/websocket-client';
import { WebSocketMessage } from '../websocket/message-types';

export type ErrorType = 
  | 'connection_timeout'
  | 'message_corruption'
  | 'high_latency'
  | 'ea_crash'
  | 'network_partition'
  | 'memory_leak'
  | 'rate_limit'
  | 'auth_failure';

export interface MessageFilter {
  types?: string[];
  accountIds?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  minSize?: number;
  maxSize?: number;
}

export interface DebugMessage {
  id: string;
  timestamp: Date;
  direction: 'sent' | 'received';
  type: string;
  message: WebSocketMessage;
  size: number;
  latency?: number;
  error?: string;
}

export interface NetworkTrace {
  id: string;
  startTime: Date;
  endTime: Date;
  messages: DebugMessage[];
  stats: {
    totalMessages: number;
    sentMessages: number;
    receivedMessages: number;
    averageLatency: number;
    errors: number;
  };
}

export interface MessageMonitor {
  onMessage(callback: (message: DebugMessage) => void): void;
  onError(callback: (error: any) => void): void;
  filterMessages(filter: MessageFilter): void;
  startRecording(): void;
  stopRecording(): NetworkTrace;
  isRecording(): boolean;
  getMessageHistory(): DebugMessage[];
  clearHistory(): void;
}

export interface MessageSimulator {
  simulatePositionUpdate(positionData: any): Promise<void>;
  simulateAccountUpdate(accountData: any): Promise<void>;
  simulateMarketData(marketData: any): Promise<void>;
  simulateError(errorType: string, details?: any): Promise<void>;
  simulateLatency(delay: number): Promise<void>;
  simulateDisconnection(duration: number): Promise<void>;
  simulateBurstTraffic(messageCount: number, interval: number): Promise<void>;
}

export class DebugTools {
  private websocketClient: WebSocketClient;
  private messageMonitor: MessageMonitorImpl;
  private messageSimulator: MessageSimulatorImpl;
  private networkCapture: NetworkCapture;
  private isMonitoring = false;
  private debugEventCallbacks: Map<string, Function[]> = new Map();

  constructor(websocketClient: WebSocketClient) {
    this.websocketClient = websocketClient;
    this.messageMonitor = new MessageMonitorImpl();
    this.messageSimulator = new MessageSimulatorImpl(websocketClient);
    this.networkCapture = new NetworkCapture();
    
    this.initializeEventMap();
  }

  /**
   * メッセージ監視を開始
   */
  startMessageMonitor(): void {
    if (this.isMonitoring) {
      console.warn('Message monitor is already running');
      return;
    }

    this.isMonitoring = true;
    this.setupMessageInterceptors();
    this.messageMonitor.startRecording();
    
    console.log('🔍 Message monitor started');
    this.emitDebugEvent('monitor_started', { timestamp: new Date() });
  }

  /**
   * メッセージ監視を停止
   */
  stopMessageMonitor(): void {
    if (!this.isMonitoring) {
      console.warn('Message monitor is not running');
      return;
    }

    this.isMonitoring = false;
    this.removeMessageInterceptors();
    const trace = this.messageMonitor.stopRecording();
    
    console.log('🛑 Message monitor stopped');
    this.emitDebugEvent('monitor_stopped', { trace, timestamp: new Date() });
  }

  /**
   * メッセージをシミュレート
   */
  async simulateMessage(message: any): Promise<void> {
    console.log('🧪 Simulating message:', message);
    
    const validationResult = await this.validateMessage(message);
    if (!validationResult.valid) {
      throw new Error(`Invalid message: ${validationResult.errors.join(', ')}`);
    }
    
    await this.messageSimulator.injectMessage(message);
    this.logDebugEvent('Message simulated', message);
  }

  /**
   * 指定したメッセージを再送
   */
  async replayMessage(messageId: string): Promise<void> {
    const history = this.messageMonitor.getMessageHistory();
    const originalMessage = history.find(m => m.id === messageId);
    
    if (!originalMessage) {
      throw new Error(`Message with ID ${messageId} not found in history`);
    }

    console.log('🔄 Replaying message:', messageId);
    await this.simulateMessage(originalMessage.message);
    this.logDebugEvent('Message replayed', { messageId, originalMessage });
  }

  /**
   * エラーを注入
   */
  async injectError(errorType: ErrorType): Promise<void> {
    const errorScenarios = {
      'connection_timeout': () => this.simulateConnectionTimeout(),
      'message_corruption': () => this.simulateMessageCorruption(),
      'high_latency': () => this.simulateHighLatency(),
      'ea_crash': () => this.simulateEACrash(),
      'network_partition': () => this.simulateNetworkPartition(),
      'memory_leak': () => this.simulateMemoryLeak(),
      'rate_limit': () => this.simulateRateLimit(),
      'auth_failure': () => this.simulateAuthFailure()
    };
    
    const scenario = errorScenarios[errorType];
    if (scenario) {
      console.log(`💥 Injecting error: ${errorType}`);
      await scenario();
      this.logDebugEvent(`Error injected: ${errorType}`);
    } else {
      throw new Error(`Unknown error type: ${errorType}`);
    }
  }

  /**
   * ネットワークトレースをキャプチャ
   */
  async captureNetworkTrace(): Promise<NetworkTrace> {
    console.log('📡 Starting network trace capture');
    this.networkCapture.start();
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const trace = this.networkCapture.stop();
        console.log('📊 Network trace completed');
        this.logDebugEvent('Network trace captured', { trace });
        resolve(trace);
      }, 10000); // 10秒間キャプチャ
    });
  }

  /**
   * イベントリスナーを追加
   */
  onDebugEvent(event: string, callback: Function): void {
    if (!this.debugEventCallbacks.has(event)) {
      this.debugEventCallbacks.set(event, []);
    }
    this.debugEventCallbacks.get(event)!.push(callback);
  }

  /**
   * イベントリスナーを削除
   */
  offDebugEvent(event: string, callback: Function): void {
    const callbacks = this.debugEventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * メッセージ監視器を取得
   */
  getMessageMonitor(): MessageMonitor {
    return this.messageMonitor;
  }

  /**
   * メッセージシミュレーターを取得
   */
  getMessageSimulator(): MessageSimulator {
    return this.messageSimulator;
  }

  /**
   * 現在の監視状態を取得
   */
  getMonitoringState(): {
    isMonitoring: boolean;
    messageCount: number;
    startTime?: Date;
  } {
    return {
      isMonitoring: this.isMonitoring,
      messageCount: this.messageMonitor.getMessageHistory().length,
      startTime: this.messageMonitor.isRecording() ? new Date() : undefined
    };
  }

  // Private methods

  private initializeEventMap(): void {
    this.debugEventCallbacks.set('monitor_started', []);
    this.debugEventCallbacks.set('monitor_stopped', []);
    this.debugEventCallbacks.set('message_intercepted', []);
    this.debugEventCallbacks.set('error_injected', []);
    this.debugEventCallbacks.set('simulation_completed', []);
  }

  private setupMessageInterceptors(): void {
    this.websocketClient.on('message_received', this.handleReceivedMessage.bind(this));
    
    // WebSocket送信メッセージの監視
    const originalSend = this.websocketClient.send.bind(this.websocketClient);
    
    this.websocketClient.send = (message: WebSocketMessage) => {
      this.handleSentMessage(message);
      return originalSend(message);
    };
  }

  private removeMessageInterceptors(): void {
    this.websocketClient.off('message_received', this.handleReceivedMessage.bind(this));
    // 元のsendメソッドを復元する場合の処理
  }

  private handleReceivedMessage(event: string, data: WebSocketMessage): void {
    const debugMessage: DebugMessage = {
      id: this.generateMessageId(),
      timestamp: new Date(),
      direction: 'received',
      type: data.type,
      message: data,
      size: JSON.stringify(data).length
    };
    
    this.messageMonitor.onMessage(debugMessage);
    this.logMessageToConsole(debugMessage);
    this.emitDebugEvent('message_intercepted', debugMessage);
  }

  private handleSentMessage(message: WebSocketMessage): void {
    const debugMessage: DebugMessage = {
      id: this.generateMessageId(),
      timestamp: new Date(),
      direction: 'sent',
      type: message.type,
      message,
      size: JSON.stringify(message).length
    };
    
    this.messageMonitor.onMessage(debugMessage);
    this.logMessageToConsole(debugMessage);
    this.emitDebugEvent('message_intercepted', debugMessage);
  }

  private logMessageToConsole(debugMessage: DebugMessage): void {
    const direction = debugMessage.direction === 'sent' ? '📤' : '📥';
    console.log(`${direction} ${debugMessage.type}`, {
      id: debugMessage.id,
      timestamp: debugMessage.timestamp,
      size: debugMessage.size,
      message: debugMessage.message
    });
  }

  private async validateMessage(message: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!message.type) {
      errors.push('Message type is required');
    }
    
    if (!message.timestamp) {
      errors.push('Message timestamp is required');
    }
    
    if (typeof message.payload !== 'object') {
      errors.push('Message payload must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Error simulation methods

  private async simulateConnectionTimeout(): Promise<void> {
    console.log('⏱️ Simulating connection timeout');
    // WebSocket接続のタイムアウトをシミュレート
    setTimeout(() => {
      this.emitDebugEvent('connection_timeout_simulated', { timestamp: new Date() });
    }, 1000);
  }

  private async simulateMessageCorruption(): Promise<void> {
    console.log('🔧 Simulating message corruption');
    const corruptedMessage = {
      type: 'corrupted_data',
      payload: { 
        invalid: 'corrupted_payload_' + Math.random(),
        malformed: '{{invalid_json'
      },
      timestamp: Date.now()
    };
    
    try {
      await this.simulateMessage(corruptedMessage);
    } catch (error) {
      console.log('Message corruption simulation successful:', error.message);
    }
  }

  private async simulateHighLatency(): Promise<void> {
    console.log('🐌 Simulating high latency');
    const originalSend = this.websocketClient.send.bind(this.websocketClient);
    
    this.websocketClient.send = (message: WebSocketMessage) => {
      setTimeout(() => {
        originalSend(message);
      }, 2000); // 2秒遅延
    };
    
    // 10秒後に元に戻す
    setTimeout(() => {
      this.websocketClient.send = originalSend;
      console.log('High latency simulation ended');
    }, 10000);
  }

  private async simulateEACrash(): Promise<void> {
    console.log('💥 Simulating EA crash');
    // 接続断をシミュレート
    this.websocketClient.disconnect();
    setTimeout(() => {
      this.websocketClient.connect();
    }, 5000);
  }

  private async simulateNetworkPartition(): Promise<void> {
    console.log('🌐 Simulating network partition');
    const originalSend = this.websocketClient.send.bind(this.websocketClient);
    
    // 送信を一時的に無効化
    this.websocketClient.send = (message: WebSocketMessage) => {
      console.log('Message dropped due to network partition:', message.type);
    };
    
    // 30秒後に復旧
    setTimeout(() => {
      this.websocketClient.send = originalSend;
      console.log('Network partition simulation ended');
    }, 30000);
  }

  private async simulateMemoryLeak(): Promise<void> {
    console.log('🧠 Simulating memory leak');
    const leakyData: any[] = [];
    
    const interval = setInterval(() => {
      for (let i = 0; i < 1000; i++) {
        leakyData.push(new Array(1000).fill(Math.random()));
      }
      console.log(`Memory leak simulation: ${leakyData.length} objects in memory`);
    }, 1000);
    
    // 30秒後に停止
    setTimeout(() => {
      clearInterval(interval);
      leakyData.length = 0; // メモリを解放
      console.log('Memory leak simulation ended');
    }, 30000);
  }

  private async simulateRateLimit(): Promise<void> {
    console.log('🚦 Simulating rate limit');
    let messageCount = 0;
    const originalSend = this.websocketClient.send.bind(this.websocketClient);
    
    this.websocketClient.send = (message: WebSocketMessage) => {
      messageCount++;
      if (messageCount > 10) {
        console.log('Message rejected due to rate limit:', message.type);
        return;
      }
      originalSend(message);
    };
    
    // 60秒後にリセット
    setTimeout(() => {
      this.websocketClient.send = originalSend;
      console.log('Rate limit simulation ended');
    }, 60000);
  }

  private async simulateAuthFailure(): Promise<void> {
    console.log('🔐 Simulating authentication failure');
    const authFailureMessage = {
      type: 'auth_error',
      payload: {
        error: 'Authentication failed',
        code: 401,
        message: 'Invalid token or credentials'
      },
      timestamp: Date.now()
    };
    
    this.handleReceivedMessage('message_received', authFailureMessage as WebSocketMessage);
  }

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  private emitDebugEvent(event: string, data?: any): void {
    const callbacks = this.debugEventCallbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error(`Error in debug event handler for ${event}:`, error);
      }
    });
  }

  private logDebugEvent(message: string, data?: any): void {
    console.log(`[DEBUG] ${message}`, data || '');
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.stopMessageMonitor();
    this.debugEventCallbacks.clear();
    this.messageMonitor.clearHistory();
  }
}

class MessageMonitorImpl implements MessageMonitor {
  private callbacks: {
    onMessage: ((message: DebugMessage) => void)[];
    onError: ((error: any) => void)[];
  } = {
    onMessage: [],
    onError: []
  };
  
  private filter?: MessageFilter;
  private recording = false;
  private messageHistory: DebugMessage[] = [];
  private recordingStartTime?: Date;

  onMessage(callback: (message: DebugMessage) => void): void {
    this.callbacks.onMessage.push(callback);
  }

  onError(callback: (error: any) => void): void {
    this.callbacks.onError.push(callback);
  }

  filterMessages(filter: MessageFilter): void {
    this.filter = filter;
  }

  startRecording(): void {
    this.recording = true;
    this.recordingStartTime = new Date();
    this.messageHistory = [];
  }

  stopRecording(): NetworkTrace {
    this.recording = false;
    const endTime = new Date();
    
    const sentMessages = this.messageHistory.filter(m => m.direction === 'sent').length;
    const receivedMessages = this.messageHistory.filter(m => m.direction === 'received').length;
    const validLatencies = this.messageHistory.filter(m => m.latency !== undefined).map(m => m.latency!);
    const averageLatency = validLatencies.length > 0 ? 
      validLatencies.reduce((sum, lat) => sum + lat, 0) / validLatencies.length : 0;
    const errors = this.messageHistory.filter(m => m.error !== undefined).length;
    
    return {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      startTime: this.recordingStartTime!,
      endTime,
      messages: [...this.messageHistory],
      stats: {
        totalMessages: this.messageHistory.length,
        sentMessages,
        receivedMessages,
        averageLatency,
        errors
      }
    };
  }

  isRecording(): boolean {
    return this.recording;
  }

  getMessageHistory(): DebugMessage[] {
    return [...this.messageHistory];
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  // Internal method called by DebugTools
  onMessage(message: DebugMessage): void {
    if (this.shouldIncludeMessage(message)) {
      this.messageHistory.push(message);
      this.callbacks.onMessage.forEach(callback => callback(message));
    }
  }

  private shouldIncludeMessage(message: DebugMessage): boolean {
    if (!this.filter) return true;
    
    if (this.filter.types && !this.filter.types.includes(message.type)) {
      return false;
    }
    
    if (this.filter.timeRange) {
      if (message.timestamp < this.filter.timeRange.start || 
          message.timestamp > this.filter.timeRange.end) {
        return false;
      }
    }
    
    if (this.filter.minSize && message.size < this.filter.minSize) {
      return false;
    }
    
    if (this.filter.maxSize && message.size > this.filter.maxSize) {
      return false;
    }
    
    return true;
  }
}

class MessageSimulatorImpl implements MessageSimulator {
  private websocketClient: WebSocketClient;

  constructor(websocketClient: WebSocketClient) {
    this.websocketClient = websocketClient;
  }

  async simulatePositionUpdate(positionData: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'position_update',
      payload: {
        accountId: positionData.accountId || 'sim_account_1',
        positions: [{
          ticket: positionData.ticket || Math.floor(Math.random() * 1000000),
          symbol: positionData.symbol || 'EURUSD',
          type: positionData.type || 'buy',
          lots: positionData.lots || 0.1,
          openPrice: positionData.openPrice || 1.0950,
          currentPrice: positionData.currentPrice || 1.0955,
          profit: positionData.profit || 5.0,
          ...positionData
        }]
      },
      timestamp: Date.now()
    };
    
    await this.injectMessage(message);
  }

  async simulateAccountUpdate(accountData: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'account_update',
      payload: {
        accountId: accountData.accountId || 'sim_account_1',
        balance: accountData.balance || 10000,
        equity: accountData.equity || 10005,
        margin: accountData.margin || 100,
        marginLevel: accountData.marginLevel || 10005,
        profit: accountData.profit || 5,
        ...accountData
      },
      timestamp: Date.now()
    };
    
    await this.injectMessage(message);
  }

  async simulateMarketData(marketData: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'market_data',
      payload: {
        symbol: marketData.symbol || 'EURUSD',
        bid: marketData.bid || 1.0950,
        ask: marketData.ask || 1.0952,
        timestamp: marketData.timestamp || Date.now(),
        ...marketData
      },
      timestamp: Date.now()
    };
    
    await this.injectMessage(message);
  }

  async simulateError(errorType: string, details?: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'error',
      payload: {
        errorType,
        message: details?.message || `Simulated error: ${errorType}`,
        timestamp: Date.now(),
        ...details
      },
      timestamp: Date.now()
    };
    
    await this.injectMessage(message);
  }

  async simulateLatency(delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async simulateDisconnection(duration: number): Promise<void> {
    console.log(`Simulating disconnection for ${duration}ms`);
    this.websocketClient.disconnect();
    
    setTimeout(() => {
      this.websocketClient.connect();
      console.log('Reconnecting after simulated disconnection');
    }, duration);
  }

  async simulateBurstTraffic(messageCount: number, interval: number): Promise<void> {
    console.log(`Simulating burst traffic: ${messageCount} messages every ${interval}ms`);
    
    for (let i = 0; i < messageCount; i++) {
      const message: WebSocketMessage = {
        type: 'burst_test',
        payload: {
          sequenceNumber: i,
          burstId: Date.now(),
          data: `Burst message ${i}`
        },
        timestamp: Date.now()
      };
      
      this.websocketClient.send(message);
      
      if (i < messageCount - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  async injectMessage(message: WebSocketMessage): Promise<void> {
    // 直接WebSocketクライアントを通してメッセージを送信
    this.websocketClient.send(message);
  }
}

class NetworkCapture {
  private capturing = false;
  private capturedMessages: DebugMessage[] = [];
  private startTime?: Date;

  start(): void {
    this.capturing = true;
    this.startTime = new Date();
    this.capturedMessages = [];
  }

  stop(): NetworkTrace {
    this.capturing = false;
    const endTime = new Date();
    
    const sentMessages = this.capturedMessages.filter(m => m.direction === 'sent').length;
    const receivedMessages = this.capturedMessages.filter(m => m.direction === 'received').length;
    const errors = this.capturedMessages.filter(m => m.error).length;
    const validLatencies = this.capturedMessages.filter(m => m.latency !== undefined).map(m => m.latency!);
    const averageLatency = validLatencies.length > 0 ? 
      validLatencies.reduce((sum, lat) => sum + lat, 0) / validLatencies.length : 0;
    
    return {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      startTime: this.startTime!,
      endTime,
      messages: [...this.capturedMessages],
      stats: {
        totalMessages: this.capturedMessages.length,
        sentMessages,
        receivedMessages,
        averageLatency,
        errors
      }
    };
  }

  captureMessage(message: DebugMessage): void {
    if (this.capturing) {
      this.capturedMessages.push(message);
    }
  }

  isCapturing(): boolean {
    return this.capturing;
  }
}
import { WebSocketMessage } from "./message-types";
import { HeartbeatManager, type HeartbeatConfig, type HeartbeatStats } from "./heartbeat-manager";
import { QualityMonitor, type QualityConfig, type QualityMetrics, type QualityReport } from "./quality-monitor";
import { createComponentLogger, type LogLevel } from "./logger";
import { DataNormalizer } from "./data-normalizer";
import { WebSocketErrorHandler, type WebSocketError } from "./error-handler";

export interface WebSocketConnectionOptions {
  url: string;
  authToken: string;
  clientId: string;
  userId: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  maxReconnectDelay?: number;
  connectionTimeout?: number;
  heartbeatConfig?: Partial<HeartbeatConfig>;
  qualityConfig?: Partial<QualityConfig>;
  logLevel?: LogLevel;
  enableMessageLogging?: boolean;
}

export type WebSocketConnectionState = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "reconnecting" 
  | "error";

export type WebSocketEventType = 
  | "connection_state_changed"
  | "message_received"
  | "error"
  | "heartbeat_sent"
  | "heartbeat_received"
  | "position_update"
  | "account_update"
  | "market_data"
  | "losscut_alert"
  | "entry_result"
  | "close_result"
  | "error_message"
  | "ack_message";

export interface WebSocketEventHandler {
  (event: WebSocketEventType, data?: any): void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketConnectionOptions>;
  private eventHandlers: Map<WebSocketEventType, WebSocketEventHandler[]> = new Map();
  private connectionState: WebSocketConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private isIntentionalDisconnect = false;
  private heartbeatManager: HeartbeatManager;
  private qualityMonitor: QualityMonitor;
  private errorHandler: WebSocketErrorHandler;
  private logger = createComponentLogger('websocket-client');

  constructor(options: WebSocketConnectionOptions) {
    this.options = {
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10,
      baseReconnectDelay: 1000,
      maxReconnectDelay: 30000,
      connectionTimeout: 10000,
      heartbeatConfig: {},
      qualityConfig: {},
      logLevel: 'info',
      enableMessageLogging: true,
      ...options,
    };

    // Initialize HeartbeatManager
    this.heartbeatManager = new HeartbeatManager({
      interval: this.options.heartbeatInterval,
      timeout: this.options.connectionTimeout,
      ...this.options.heartbeatConfig,
    });

    // Initialize QualityMonitor
    this.qualityMonitor = new QualityMonitor(this.options.qualityConfig);

    // Initialize ErrorHandler
    this.errorHandler = new WebSocketErrorHandler();

    // Initialize event handler maps
    [
      "connection_state_changed",
      "message_received", 
      "error",
      "heartbeat_sent",
      "heartbeat_received",
      "position_update",
      "account_update",
      "market_data",
      "losscut_alert",
      "entry_result",
      "close_result",
      "error_message",
      "ack_message"
    ].forEach(event => {
      this.eventHandlers.set(event as WebSocketEventType, []);
    });

    // Setup heartbeat and quality monitoring event handlers
    this.setupMonitoringEvents();
    
    // Log initialization
    this.logger.info('WebSocket client initialized', {
      url: this.options.url,
      clientId: this.options.clientId,
      logLevel: this.options.logLevel,
      enableMessageLogging: this.options.enableMessageLogging
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.connectionState === "connected" || this.connectionState === "connecting") {
      this.logger.warning('Connection attempt ignored - already connected/connecting', {
        currentState: this.connectionState
      });
      return;
    }

    this.logger.info('Initiating WebSocket connection', {
      url: this.options.url,
      reconnectAttempts: this.reconnectAttempts
    });

    this.isIntentionalDisconnect = false;
    this.setConnectionState("connecting");

    try {
      this.ws = new WebSocket(this.options.url);
      this.setupWebSocketEvents();
      this.logger.debug('WebSocket instance created successfully');
    } catch (error) {
      this.logger.error("Failed to create WebSocket connection", error, {
        url: this.options.url,
        reconnectAttempts: this.reconnectAttempts
      });
      this.handleConnectionError(error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.logger.info('Disconnecting WebSocket connection', {
      currentState: this.connectionState,
      intentional: true
    });
    
    this.isIntentionalDisconnect = true;
    this.cleanup();
    this.setConnectionState("disconnected");
    
    this.logger.info('WebSocket disconnected successfully');
  }

  /**
   * Send message to WebSocket server
   */
  send(message: WebSocketMessage): void {
    if (this.connectionState !== "connected" || !this.ws) {
      this.logger.warning("Cannot send message: WebSocket not connected", {
        messageType: message.type,
        connectionState: this.connectionState
      });
      this.qualityMonitor.recordMessageFailure();
      return;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now(),
        clientId: this.options.clientId,
      };

      // Log message details if logging is enabled
      if (this.options.enableMessageLogging) {
        this.logger.debug('Sending WebSocket message', {
          type: message.type,
          messageId: messageWithTimestamp.timestamp,
          payloadSize: JSON.stringify(message.payload).length,
          clientId: this.options.clientId
        });
      }

      this.ws.send(JSON.stringify(messageWithTimestamp));
      this.qualityMonitor.recordMessageSuccess();
      
      this.logger.debug('Message sent successfully', {
        type: message.type,
        messageId: messageWithTimestamp.timestamp
      });
    } catch (error) {
      this.logger.error("Failed to send message", error, {
        messageType: message.type,
        connectionState: this.connectionState
      });
      this.qualityMonitor.recordMessageFailure();
      this.emit("error", error);
    }
  }

  /**
   * Send raw message without quality monitoring (used internally)
   */
  private sendRawMessage(message: WebSocketMessage): void {
    if (this.connectionState !== "connected" || !this.ws) {
      this.logger.debug('Cannot send raw message: not connected', {
        messageType: message.type,
        connectionState: this.connectionState
      });
      return;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now(),
        clientId: this.options.clientId,
      };

      this.ws.send(JSON.stringify(messageWithTimestamp));
      
      this.logger.debug('Raw message sent', {
        type: message.type,
        messageId: messageWithTimestamp.timestamp,
        internal: true
      });
    } catch (error) {
      this.logger.error("Failed to send raw message", error, {
        messageType: message.type,
        connectionState: this.connectionState
      });
      this.emit("error", error);
    }
  }

  /**
   * Add event listener
   */
  on(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Remove event listener
   */
  off(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      isConnected: this.connectionState === "connected",
      heartbeat: this.heartbeatManager.getStats(),
      quality: this.qualityMonitor.getQualityMetrics(),
    };
  }

  /**
   * Get heartbeat statistics
   */
  getHeartbeatStats(): HeartbeatStats {
    return this.heartbeatManager.getStats();
  }

  /**
   * Get quality metrics
   */
  getQualityMetrics(): QualityMetrics {
    return this.qualityMonitor.getQualityMetrics();
  }

  /**
   * Get quality report
   */
  getQualityReport(): QualityReport {
    return this.qualityMonitor.getQualityReport();
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.errorHandler.getErrorStats();
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHandler.clearErrorHistory();
  }

  private setupMonitoringEvents(): void {
    // HeartbeatManager events
    this.heartbeatManager.on("heartbeat_sent", (event, data) => {
      if (this.connectionState === "connected") {
        const heartbeatMessage: WebSocketMessage = {
          type: "heartbeat",
          payload: data,
          timestamp: Date.now(),
        };
        this.sendRawMessage(heartbeatMessage);
        this.emit("heartbeat_sent", data);
      }
    });

    this.heartbeatManager.on("heartbeat_timeout", (event, data) => {
      this.qualityMonitor.recordMessageTimeout();
      this.logger.warning("Heartbeat timeout detected", {
        event,
        data,
        connectionState: this.connectionState
      });
    });

    this.heartbeatManager.on("connection_unhealthy", (event, data) => {
      this.logger.error("Connection unhealthy detected", undefined, {
        event,
        data,
        connectionState: this.connectionState,
        reconnectAttempts: this.reconnectAttempts
      });
      if (!this.isIntentionalDisconnect) {
        this.handleReconnect();
      }
    });

    // QualityMonitor events
    this.qualityMonitor.on("quality_degraded", (event, data) => {
      this.logger.warning("Connection quality degraded", {
        event,
        data,
        qualityMetrics: this.qualityMonitor.getQualityMetrics()
      });
    });

    this.qualityMonitor.on("threshold_crossed", (event, data) => {
      this.logger.info("Quality threshold crossed", {
        event,
        data,
        qualityReport: this.qualityMonitor.getQualityReport()
      });
    });
  }

  private setupWebSocketEvents(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.logger.info("WebSocket connected successfully", {
        url: this.options.url,
        clientId: this.options.clientId,
        reconnectAttempts: this.reconnectAttempts
      });
      
      this.reconnectAttempts = 0;
      this.setConnectionState("connected");
      this.qualityMonitor.onConnectionStarted();
      this.sendAuthMessage();
      this.heartbeatManager.startHeartbeat();
    };

    this.ws.onclose = (event) => {
      this.logger.info("WebSocket connection closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        intentional: this.isIntentionalDisconnect
      });
      
      this.qualityMonitor.onConnectionEnded();
      this.cleanup();
      
      if (!this.isIntentionalDisconnect) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      this.logger.error("WebSocket error occurred", error, {
        connectionState: this.connectionState,
        reconnectAttempts: this.reconnectAttempts
      });
      this.handleConnectionError(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const rawMessage = JSON.parse(event.data);
        
        // Normalize the message first
        const message = DataNormalizer.normalizeMessage(rawMessage);
        
        if (!message) {
          this.logger.warning("Message normalization failed", {
            rawDataLength: event.data?.length || 0,
            rawDataPreview: event.data?.substring(0, 100)
          });
          this.qualityMonitor.recordMessageFailure();
          return;
        }

        // Calculate data quality score
        const qualityScore = DataNormalizer.getDataQuality(message);
        
        // Log received message if logging is enabled
        if (this.options.enableMessageLogging) {
          this.logger.debug('Received WebSocket message', {
            type: message.type,
            messageId: message.timestamp,
            payloadSize: event.data.length,
            clientId: message.clientId,
            qualityScore
          });
        }

        // Log quality warnings for low scores
        if (qualityScore < 70) {
          this.logger.warning('Low quality message received', {
            type: message.type,
            qualityScore,
            messageId: message.timestamp
          });
        }
        
        this.handleMessage(message);
      } catch (error) {
        this.logger.error("Failed to parse WebSocket message", error, {
          rawDataLength: event.data?.length || 0,
          rawDataPreview: event.data?.substring(0, 100)
        });
        this.qualityMonitor.recordMessageFailure();
        this.emit("error", error);
      }
    };
  }

  private sendAuthMessage(): void {
    const authMessage: WebSocketMessage = {
      type: "auth",
      payload: {
        clientId: this.options.clientId,
        userId: this.options.userId,
        authToken: this.options.authToken,
      },
      timestamp: Date.now(),
    };

    this.send(authMessage);
  }


  private handleMessage(message: WebSocketMessage): void {
    // Log all received messages for debugging in development
    if (this.options.logLevel === 'debug') {
      this.logger.debug('Processing message', {
        type: message.type,
        messageId: message.timestamp,
        hasPayload: !!message.payload
      });
    }

    // Handle different message types
    switch (message.type) {
      case "heartbeat":
        this.handleHeartbeatMessage(message);
        break;
      
      case "position_update":
        this.handlePositionUpdate(message);
        break;
      
      case "account_update":
        this.handleAccountUpdate(message);
        break;
      
      case "market_data":
        this.handleMarketData(message);
        break;
      
      case "losscut_alert":
        this.handleLosscutAlert(message);
        break;
      
      case "entry_result":
        this.handleEntryResult(message);
        break;
      
      case "close_result":
        this.handleCloseResult(message);
        break;
      
      case "error":
        this.handleErrorMessage(message);
        break;
      
      case "ack":
        this.handleAckMessage(message);
        break;
      
      default:
        // For any unhandled message types, just emit as is
        this.emit("message_received", message);
        this.logger.debug('Unhandled message type', { type: message.type });
    }
  }

  private handleHeartbeatMessage(message: WebSocketMessage): void {
    const heartbeatData = {
      timestamp: message.timestamp,
      sequence: (message.payload as any)?.sequence || 0,
    };
    this.heartbeatManager.onHeartbeatReceived(heartbeatData);
    this.emit("heartbeat_received", message);
  }

  private handlePositionUpdate(message: WebSocketMessage): void {
    // Normalize position data
    const normalizedPositions = DataNormalizer.normalizePositionUpdate(message);
    
    if (!normalizedPositions) {
      this.logger.warning('Failed to normalize position update');
      this.qualityMonitor.recordMessageFailure();
      return;
    }

    this.logger.info('Position update received', {
      accountId: (message.payload as any)?.accountId,
      positionCount: normalizedPositions.length
    });
    
    this.qualityMonitor.recordMessageSuccess();
    
    // Create normalized message
    const normalizedMessage = {
      ...message,
      payload: {
        ...(message.payload as any),
        positions: normalizedPositions
      }
    };
    
    // Emit both specific and general event
    this.emit("position_update", normalizedMessage);
    this.emit("message_received", normalizedMessage);
  }

  private handleAccountUpdate(message: WebSocketMessage): void {
    // Normalize account data
    const normalizedAccount = DataNormalizer.normalizeAccountUpdate(message);
    
    if (!normalizedAccount) {
      this.logger.warning('Failed to normalize account update');
      this.qualityMonitor.recordMessageFailure();
      return;
    }

    this.logger.info('Account update received', {
      accountId: normalizedAccount.accountId,
      balance: normalizedAccount.balance,
      equity: normalizedAccount.equity,
      marginLevel: normalizedAccount.marginLevel
    });
    
    this.qualityMonitor.recordMessageSuccess();
    
    // Check for critical margin levels
    if (normalizedAccount.marginLevel < 100) {
      this.logger.warning('Low margin level detected', {
        accountId: normalizedAccount.accountId,
        marginLevel: normalizedAccount.marginLevel
      });
    }
    
    // Create normalized message
    const normalizedMessage = {
      ...message,
      payload: normalizedAccount
    };
    
    // Emit both specific and general event
    this.emit("account_update", normalizedMessage);
    this.emit("message_received", normalizedMessage);
  }

  private handleMarketData(message: WebSocketMessage): void {
    // Normalize market data
    const normalizedMarketData = DataNormalizer.normalizeMarketData(message);
    
    if (!normalizedMarketData) {
      this.logger.warning('Failed to normalize market data');
      this.qualityMonitor.recordMessageFailure();
      return;
    }

    this.logger.debug('Market data received', {
      symbols: Object.keys(normalizedMarketData)
    });
    
    this.qualityMonitor.recordMessageSuccess();
    
    // Create normalized message
    const normalizedMessage = {
      ...message,
      payload: normalizedMarketData
    };
    
    // Emit both specific and general event
    this.emit("market_data", normalizedMessage);
    this.emit("message_received", normalizedMessage);
  }

  private handleLosscutAlert(message: WebSocketMessage): void {
    const payload = message.payload as any;
    this.logger.error('Losscut alert received', undefined, {
      accountId: payload?.accountId,
      alertType: payload?.alertType,
      marginLevel: payload?.marginLevel,
      affectedPositions: payload?.affectedPositions
    });
    
    this.qualityMonitor.recordMessageSuccess();
    
    // Emit both specific and general event
    this.emit("losscut_alert", message);
    this.emit("message_received", message);
  }

  private handleEntryResult(message: WebSocketMessage): void {
    const payload = message.payload as any;
    this.logger.info('Entry result received', {
      commandId: payload?.commandId,
      success: payload?.success,
      positionId: payload?.positionId,
      error: payload?.error
    });
    
    this.qualityMonitor.recordMessageSuccess();
    
    // Emit both specific and general event
    this.emit("entry_result", message);
    this.emit("message_received", message);
  }

  private handleCloseResult(message: WebSocketMessage): void {
    const payload = message.payload as any;
    this.logger.info('Close result received', {
      commandId: payload?.commandId,
      success: payload?.success,
      positionId: payload?.positionId,
      profit: payload?.profit,
      error: payload?.error
    });
    
    this.qualityMonitor.recordMessageSuccess();
    
    // Emit both specific and general event
    this.emit("close_result", message);
    this.emit("message_received", message);
  }

  private handleErrorMessage(message: WebSocketMessage): void {
    const payload = message.payload as any;
    this.logger.error('Error message received', undefined, {
      code: payload?.code,
      message: payload?.message,
      details: payload?.details
    });
    
    this.qualityMonitor.recordMessageFailure();
    
    // Emit both specific and general event
    this.emit("error_message", message);
    this.emit("message_received", message);
  }

  private handleAckMessage(message: WebSocketMessage): void {
    const payload = message.payload as any;
    this.logger.debug('Ack message received', {
      messageId: payload?.messageId,
      success: payload?.success,
      error: payload?.error
    });
    
    // Emit both specific and general event
    this.emit("ack_message", message);
    this.emit("message_received", message);
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.logger.error(`Max reconnect attempts reached`, undefined, {
        maxAttempts: this.options.maxReconnectAttempts,
        totalAttempts: this.reconnectAttempts
      });
      this.setConnectionState("error");
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionState("reconnecting");

    // Exponential backoff with jitter
    const baseDelay = this.options.baseReconnectDelay || 1000;
    const maxDelay = this.options.maxReconnectDelay || 30000;
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts - 1),
      maxDelay
    );
    
    // Add jitter (0-10% of the delay)
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const finalDelay = exponentialDelay + jitter;

    this.logger.info(`Scheduling reconnection attempt`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts,
      delayMs: Math.round(finalDelay),
      exponentialDelay,
      jitter: Math.round(jitter)
    });

    this.reconnectTimeoutId = setTimeout(() => {
      this.logger.info('Executing scheduled reconnection');
      this.connect();
    }, finalDelay);
  }

  private async handleConnectionError(error: any): Promise<void> {
    // Record the error
    const wsError = this.errorHandler.recordError(error, {
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      url: this.options.url
    });

    this.emit("error", error);
    
    if (!this.isIntentionalDisconnect) {
      // Attempt recovery before reconnecting
      const recovered = await this.errorHandler.attemptRecovery(wsError);
      
      if (recovered) {
        this.logger.info('Error recovery successful, attempting reconnection');
      } else {
        this.logger.warning('Error recovery failed, proceeding with standard reconnection');
      }
      
      this.handleReconnect();
    }
  }

  private setConnectionState(state: WebSocketConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit("connection_state_changed", state);
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Stop HeartbeatManager
    this.heartbeatManager.stopHeartbeat();
  }

  private emit(event: WebSocketEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        this.logger.error(`Error in event handler for ${event}`, error, {
          eventType: event,
          handlerCount: handlers.length,
          dataType: typeof data
        });
      }
    });
  }

  /**
   * Get logger instance for direct access
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Set log level for this client
   */
  setLogLevel(level: LogLevel): void {
    this.options.logLevel = level;
    this.logger.info('Log level changed', { newLevel: level });
  }

  /**
   * Toggle message logging
   */
  setMessageLogging(enabled: boolean): void {
    this.options.enableMessageLogging = enabled;
    this.logger.info('Message logging toggled', { enabled });
  }
}
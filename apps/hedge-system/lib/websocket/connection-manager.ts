import { WebSocketClient, WebSocketConnectionOptions, WebSocketConnectionState } from "./websocket-client";
import { WebSocketMessage } from "./message-types";

export interface ConnectionConfig extends WebSocketConnectionOptions {
  maxReconnectAttempts: number;
  baseReconnectDelay: number;
  maxReconnectDelay: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  qualityThreshold: number;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'error';
  lastConnected?: Date;
  reconnectAttempts: number;
  latency?: number;
  qualityScore: number;
  connectionDuration: number;
  messagesSent: number;
  messagesReceived: number;
  lastHeartbeat?: Date;
}

export interface ConnectionQualityMetrics {
  latency: number;
  uptime: number;
  messageSuccessRate: number;
  reconnectCount: number;
  lastReconnect?: Date;
  qualityScore: number;
}

export interface ConnectionPoolEntry {
  id: string;
  client: WebSocketClient;
  config: ConnectionConfig;
  state: ConnectionState;
  metrics: ConnectionQualityMetrics;
  createdAt: Date;
  lastActivity: Date;
}

export class WebSocketConnectionManager {
  private connections: Map<string, ConnectionPoolEntry> = new Map();
  private qualityMonitorInterval?: NodeJS.Timeout;
  private readonly defaultConfig: Partial<ConnectionConfig> = {
    maxReconnectAttempts: 10,
    baseReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    heartbeatInterval: 30000,
    connectionTimeout: 10000,
    qualityThreshold: 0.7,
  };

  constructor() {
    this.startQualityMonitoring();
  }

  /**
   * Create and manage a new WebSocket connection
   */
  async createConnection(
    connectionId: string, 
    config: ConnectionConfig
  ): Promise<string> {
    if (this.connections.has(connectionId)) {
      throw new Error(`Connection ${connectionId} already exists`);
    }

    const mergedConfig: ConnectionConfig = {
      ...this.defaultConfig,
      ...config,
    } as ConnectionConfig;

    const client = new WebSocketClient(mergedConfig);
    const now = new Date();

    const connectionEntry: ConnectionPoolEntry = {
      id: connectionId,
      client,
      config: mergedConfig,
      state: {
        status: 'disconnected',
        reconnectAttempts: 0,
        qualityScore: 1.0,
        connectionDuration: 0,
        messagesSent: 0,
        messagesReceived: 0,
      },
      metrics: {
        latency: 0,
        uptime: 0,
        messageSuccessRate: 1.0,
        reconnectCount: 0,
        qualityScore: 1.0,
      },
      createdAt: now,
      lastActivity: now,
    };

    this.setupConnectionEventHandlers(connectionEntry);
    this.connections.set(connectionId, connectionEntry);

    return connectionId;
  }

  /**
   * Connect to WebSocket server with enhanced reconnection logic
   */
  async connect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    connection.state.status = 'connecting';
    
    try {
      await this.connectWithTimeout(connection);
    } catch (error) {
      await this.handleConnectionError(connection, error);
    }
  }

  /**
   * Disconnect a specific connection
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.client.disconnect();
    connection.state.status = 'disconnected';
    this.updateConnectionActivity(connection);
  }

  /**
   * Remove connection from pool
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.client.disconnect();
      this.connections.delete(connectionId);
    }
  }

  /**
   * Send message to specific connection
   */
  sendMessage(connectionId: string, message: WebSocketMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state.status !== 'connected') {
      return false;
    }

    connection.client.send(message);
    connection.state.messagesSent++;
    this.updateConnectionActivity(connection);
    return true;
  }

  /**
   * Get connection state
   */
  getConnectionState(connectionId: string): ConnectionState | null {
    const connection = this.connections.get(connectionId);
    return connection ? { ...connection.state } : null;
  }

  /**
   * Get all connection states
   */
  getAllConnectionStates(): Map<string, ConnectionState> {
    const states = new Map<string, ConnectionState>();
    this.connections.forEach((connection, id) => {
      states.set(id, { ...connection.state });
    });
    return states;
  }

  /**
   * Get connection quality metrics
   */
  getConnectionMetrics(connectionId: string): ConnectionQualityMetrics | null {
    const connection = this.connections.get(connectionId);
    return connection ? { ...connection.metrics } : null;
  }

  /**
   * Get all connections quality overview
   */
  getQualityOverview(): {
    totalConnections: number;
    connectedCount: number;
    averageQuality: number;
    lowQualityCount: number;
  } {
    const total = this.connections.size;
    let connected = 0;
    let totalQuality = 0;
    let lowQuality = 0;

    this.connections.forEach(connection => {
      if (connection.state.status === 'connected') {
        connected++;
      }
      totalQuality += connection.metrics.qualityScore;
      if (connection.metrics.qualityScore < connection.config.qualityThreshold) {
        lowQuality++;
      }
    });

    return {
      totalConnections: total,
      connectedCount: connected,
      averageQuality: total > 0 ? totalQuality / total : 0,
      lowQualityCount: lowQuality,
    };
  }

  /**
   * Cleanup all connections
   */
  destroy(): void {
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval);
    }

    this.connections.forEach(connection => {
      connection.client.disconnect();
    });
    this.connections.clear();
  }

  private async connectWithTimeout(connection: ConnectionPoolEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${connection.config.connectionTimeout}ms`));
      }, connection.config.connectionTimeout);

      const onConnected = () => {
        clearTimeout(timeout);
        connection.client.off('connection_state_changed', onStateChange);
        resolve();
      };

      const onStateChange = (_: any, state: WebSocketConnectionState) => {
        if (state === 'connected') {
          onConnected();
        } else if (state === 'error') {
          clearTimeout(timeout);
          connection.client.off('connection_state_changed', onStateChange);
          reject(new Error('Connection failed'));
        }
      };

      connection.client.on('connection_state_changed', onStateChange);
      connection.client.connect();
    });
  }

  private async handleConnectionError(connection: ConnectionPoolEntry, error: any): Promise<void> {
    connection.state.reconnectAttempts++;
    connection.metrics.reconnectCount++;

    if (connection.state.reconnectAttempts >= connection.config.maxReconnectAttempts) {
      connection.state.status = 'failed';
      console.error(`Connection ${connection.id} failed after ${connection.config.maxReconnectAttempts} attempts`);
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      connection.config.baseReconnectDelay * Math.pow(2, connection.state.reconnectAttempts - 1),
      connection.config.maxReconnectDelay
    );
    const jitter = Math.random() * 0.1 * delay;
    const finalDelay = delay + jitter;

    connection.state.status = 'reconnecting';
    console.log(`Reconnecting ${connection.id} in ${Math.round(finalDelay)}ms (attempt ${connection.state.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connectWithTimeout(connection);
      } catch (retryError) {
        await this.handleConnectionError(connection, retryError);
      }
    }, finalDelay);
  }

  private setupConnectionEventHandlers(connection: ConnectionPoolEntry): void {
    const { client, state } = connection;

    client.on('connection_state_changed', (_, newState: WebSocketConnectionState) => {
      state.status = newState;
      
      if (newState === 'connected') {
        state.lastConnected = new Date();
        state.reconnectAttempts = 0;
        this.startLatencyMeasurement(connection);
      }
      
      this.updateConnectionActivity(connection);
    });

    client.on('message_received', (_, message) => {
      state.messagesReceived++;
      this.updateConnectionActivity(connection);
      
      // Handle heartbeat response for latency calculation
      if (message.type === 'heartbeat' && message.payload?.timestamp) {
        const latency = Date.now() - message.payload.timestamp;
        this.updateLatency(connection, latency);
      }
    });

    client.on('error', (_, error) => {
      console.error(`Connection ${connection.id} error:`, error);
      this.updateQualityScore(connection);
    });

    client.on('heartbeat_sent', (_, message) => {
      state.lastHeartbeat = new Date();
    });
  }

  private startLatencyMeasurement(connection: ConnectionPoolEntry): void {
    const measureLatency = () => {
      if (connection.state.status !== 'connected') return;

      const start = Date.now();
      const pingMessage: WebSocketMessage = {
        type: 'heartbeat',
        payload: { timestamp: start, ping: true },
        timestamp: start,
      };

      connection.client.send(pingMessage);
    };

    // Measure latency every 10 seconds
    const latencyInterval = setInterval(() => {
      if (connection.state.status === 'connected') {
        measureLatency();
      } else {
        clearInterval(latencyInterval);
      }
    }, 10000);
  }

  private updateLatency(connection: ConnectionPoolEntry, newLatency: number): void {
    const { metrics } = connection;
    
    // Exponential moving average for latency
    const alpha = 0.3;
    metrics.latency = metrics.latency === 0 
      ? newLatency 
      : alpha * newLatency + (1 - alpha) * metrics.latency;
    
    connection.state.latency = metrics.latency;
    this.updateQualityScore(connection);
  }

  private updateConnectionActivity(connection: ConnectionPoolEntry): void {
    connection.lastActivity = new Date();
    
    if (connection.state.lastConnected) {
      connection.state.connectionDuration = 
        Date.now() - connection.state.lastConnected.getTime();
    }
  }

  private updateQualityScore(connection: ConnectionPoolEntry): void {
    const { state, metrics, config } = connection;
    
    let score = 1.0;
    
    // Latency score (lower is better)
    if (metrics.latency > 0) {
      score *= Math.max(0.1, 1 - (metrics.latency / 1000)); // 1 second = 0 score
    }
    
    // Uptime score
    const totalTime = Date.now() - connection.createdAt.getTime();
    const connectedTime = state.connectionDuration;
    if (totalTime > 0) {
      metrics.uptime = connectedTime / totalTime;
      score *= metrics.uptime;
    }
    
    // Message success rate
    const totalMessages = state.messagesSent + state.messagesReceived;
    if (totalMessages > 0) {
      metrics.messageSuccessRate = state.messagesReceived / Math.max(state.messagesSent, 1);
      score *= Math.min(1.0, metrics.messageSuccessRate);
    }
    
    // Reconnection penalty
    if (metrics.reconnectCount > 0) {
      score *= Math.max(0.1, 1 - (metrics.reconnectCount * 0.1));
    }
    
    metrics.qualityScore = Math.max(0, Math.min(1, score));
    state.qualityScore = metrics.qualityScore;
    
    // Auto-reconnect on low quality
    if (metrics.qualityScore < config.qualityThreshold && state.status === 'connected') {
      console.warn(`Connection ${connection.id} quality degraded (${metrics.qualityScore.toFixed(2)}), triggering reconnect`);
      this.handleQualityDegradation(connection);
    }
  }

  private handleQualityDegradation(connection: ConnectionPoolEntry): void {
    // Disconnect and trigger reconnection
    connection.client.disconnect();
    
    // Reset some metrics for fresh start
    connection.state.reconnectAttempts = 0;
    
    setTimeout(() => {
      this.connect(connection.id).catch(error => {
        console.error(`Failed to reconnect ${connection.id} after quality degradation:`, error);
      });
    }, 1000);
  }

  private startQualityMonitoring(): void {
    this.qualityMonitorInterval = setInterval(() => {
      this.connections.forEach(connection => {
        this.updateQualityScore(connection);
      });
    }, 5000); // Update quality scores every 5 seconds
  }
}

// Singleton instance for global access
export const connectionManager = new WebSocketConnectionManager();
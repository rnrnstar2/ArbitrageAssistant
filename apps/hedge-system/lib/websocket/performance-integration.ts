import { 
  PerformanceOptimizer, 
  PerformanceConfig,
  PerformanceMetrics 
} from '../performance/performance-optimizer';
import { WebSocketClient } from './websocket-client';
import { QualityMonitor } from './quality-monitor';
import { BaseMessage } from './message-types';

export interface WebSocketPerformanceConfig {
  performance: Partial<PerformanceConfig>;
  integration: {
    enableMessageOptimization: boolean;
    enableBatchProcessing: boolean;
    enableCaching: boolean;
    enableResourceMonitoring: boolean;
    performanceReportInterval: number; // milliseconds
  };
}

export interface WebSocketPerformanceMetrics extends PerformanceMetrics {
  websocket: {
    connectionQuality: number;
    messageLatency: number;
    throughput: number;
    errorRate: number;
  };
}

export class WebSocketPerformanceIntegration {
  private performanceOptimizer: PerformanceOptimizer;
  private config: WebSocketPerformanceConfig;
  private isEnabled = false;
  private reportInterval?: NodeJS.Timeout;
  private connectedClients: Map<string, WebSocketClient> = new Map();
  private qualityMonitors: Map<string, QualityMonitor> = new Map();

  constructor(config: Partial<WebSocketPerformanceConfig> = {}) {
    this.config = {
      performance: {},
      integration: {
        enableMessageOptimization: true,
        enableBatchProcessing: true,
        enableCaching: true,
        enableResourceMonitoring: true,
        performanceReportInterval: 60000, // 1 minute
        ...config.integration,
      },
      ...config,
    };

    this.performanceOptimizer = new PerformanceOptimizer(this.config.performance);
  }

  /**
   * Enable performance optimization for WebSocket
   */
  enable(): void {
    if (this.isEnabled) return;

    this.isEnabled = true;

    if (this.config.integration.performanceReportInterval > 0) {
      this.startPerformanceReporting();
    }

    console.log('WebSocket performance optimization enabled');
  }

  /**
   * Disable performance optimization
   */
  disable(): void {
    if (!this.isEnabled) return;

    this.isEnabled = false;

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = undefined;
    }

    console.log('WebSocket performance optimization disabled');
  }

  /**
   * Register WebSocket client for performance monitoring
   */
  registerClient(clientId: string, client: WebSocketClient, qualityMonitor?: QualityMonitor): void {
    this.connectedClients.set(clientId, client);
    
    if (qualityMonitor) {
      this.qualityMonitors.set(clientId, qualityMonitor);
    }

    // Setup message interception for optimization
    this.setupMessageOptimization(clientId, client);

    console.log(`WebSocket client ${clientId} registered for performance optimization`);
  }

  /**
   * Unregister WebSocket client
   */
  unregisterClient(clientId: string): void {
    this.connectedClients.delete(clientId);
    this.qualityMonitors.delete(clientId);

    console.log(`WebSocket client ${clientId} unregistered from performance optimization`);
  }

  /**
   * Process message with performance optimization
   */
  async processOptimizedMessage(message: BaseMessage): Promise<BaseMessage> {
    if (!this.isEnabled || !this.config.integration.enableMessageOptimization) {
      return message;
    }

    try {
      return await this.performanceOptimizer.processMessage(message);
    } catch (error) {
      console.error('Message optimization failed:', error);
      return message; // Fallback to original message
    }
  }

  /**
   * Process multiple messages with batch optimization
   */
  async processOptimizedMessageBatch(messages: BaseMessage[]): Promise<BaseMessage[]> {
    if (!this.isEnabled || 
        !this.config.integration.enableBatchProcessing || 
        messages.length === 0) {
      return messages;
    }

    try {
      return await this.performanceOptimizer.processMessageBatch(messages);
    } catch (error) {
      console.error('Batch message optimization failed:', error);
      return messages; // Fallback to original messages
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): WebSocketPerformanceMetrics {
    const baseMetrics = this.performanceOptimizer.monitorPerformance();
    const websocketMetrics = this.calculateWebSocketMetrics();

    return {
      ...baseMetrics,
      websocket: websocketMetrics,
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    baseReport: any;
    websocketMetrics: WebSocketPerformanceMetrics['websocket'];
    clientOverview: {
      totalClients: number;
      activeClients: number;
      averageQuality: number;
      lowQualityClients: number;
    };
    recommendations: string[];
  } {
    const baseReport = this.performanceOptimizer.generatePerformanceReport();
    const websocketMetrics = this.calculateWebSocketMetrics();
    const clientOverview = this.generateClientOverview();
    const recommendations = this.generateWebSocketRecommendations();

    return {
      baseReport,
      websocketMetrics,
      clientOverview,
      recommendations,
    };
  }

  /**
   * Optimize WebSocket performance settings
   */
  async optimizeWebSocketPerformance(): Promise<void> {
    if (!this.isEnabled) return;

    // Run base performance optimization
    await this.performanceOptimizer.autoTunePerformance();

    // WebSocket-specific optimizations
    await this.optimizeClientConnections();
    await this.optimizeMessageFlow();
  }

  /**
   * Update performance configuration
   */
  updateConfig(newConfig: Partial<WebSocketPerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.performance) {
      this.performanceOptimizer.updateConfig(newConfig.performance);
    }
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    this.disable();
    await this.performanceOptimizer.destroy();
    this.connectedClients.clear();
    this.qualityMonitors.clear();
  }

  private setupMessageOptimization(clientId: string, client: WebSocketClient): void {
    // Intercept outgoing messages for optimization
    const originalSend = client.send.bind(client);
    
    client.send = async (message: any) => {
      if (this.isEnabled && this.config.integration.enableMessageOptimization) {
        try {
          const optimizedMessage = await this.processOptimizedMessage(message);
          return originalSend(optimizedMessage);
        } catch (error) {
          console.error(`Message optimization failed for client ${clientId}:`, error);
          return originalSend(message);
        }
      } else {
        return originalSend(message);
      }
    };

    // Setup message event handlers for monitoring
    client.on('message_sent', (_, message) => {
      // Track message sending metrics
      this.trackMessageMetrics('sent', message);
    });

    client.on('message_received', (_, message) => {
      // Track message receiving metrics
      this.trackMessageMetrics('received', message);
    });

    client.on('error', (_, error) => {
      // Track error metrics
      this.trackErrorMetrics(clientId, error);
    });
  }

  private calculateWebSocketMetrics(): WebSocketPerformanceMetrics['websocket'] {
    let totalQuality = 0;
    let totalLatency = 0;
    let totalThroughput = 0;
    let totalErrors = 0;
    let clientCount = 0;

    this.qualityMonitors.forEach((monitor) => {
      const metrics = monitor.getQualityMetrics();
      totalQuality += metrics.qualityScore;
      totalLatency += metrics.averageRTT;
      clientCount++;
    });

    // Calculate averages
    const averageQuality = clientCount > 0 ? (totalQuality / clientCount) * 100 : 0;
    const averageLatency = clientCount > 0 ? totalLatency / clientCount : 0;

    return {
      connectionQuality: averageQuality,
      messageLatency: averageLatency,
      throughput: totalThroughput, // Would need more sophisticated calculation
      errorRate: totalErrors / Math.max(clientCount, 1),
    };
  }

  private generateClientOverview(): {
    totalClients: number;
    activeClients: number;
    averageQuality: number;
    lowQualityClients: number;
  } {
    const totalClients = this.connectedClients.size;
    let activeClients = 0;
    let totalQuality = 0;
    let lowQualityClients = 0;

    this.qualityMonitors.forEach((monitor) => {
      const metrics = monitor.getQualityMetrics();
      const qualityScore = metrics.qualityScore * 100;
      
      totalQuality += qualityScore;
      
      if (qualityScore >= 70) {
        activeClients++;
      }
      
      if (qualityScore < 50) {
        lowQualityClients++;
      }
    });

    return {
      totalClients,
      activeClients,
      averageQuality: totalClients > 0 ? totalQuality / totalClients : 0,
      lowQualityClients,
    };
  }

  private generateWebSocketRecommendations(): string[] {
    const recommendations: string[] = [];
    const clientOverview = this.generateClientOverview();
    const websocketMetrics = this.calculateWebSocketMetrics();

    if (websocketMetrics.connectionQuality < 70) {
      recommendations.push('WebSocket接続品質が低下しています。ネットワーク設定を確認してください。');
    }

    if (websocketMetrics.messageLatency > 200) {
      recommendations.push('メッセージ遅延が高いです。圧縮やバッチ処理の最適化を検討してください。');
    }

    if (clientOverview.lowQualityClients > clientOverview.totalClients * 0.2) {
      recommendations.push('20%以上のクライアントで品質が低下しています。接続設定を見直してください。');
    }

    if (websocketMetrics.errorRate > 0.05) {
      recommendations.push('エラー率が高いです。エラーハンドリングの改善を検討してください。');
    }

    if (recommendations.length === 0) {
      recommendations.push('WebSocket パフォーマンスは良好です。');
    }

    return recommendations;
  }

  private async optimizeClientConnections(): Promise<void> {
    // Optimize client connections based on quality metrics
    for (const [clientId, monitor] of this.qualityMonitors) {
      const metrics = monitor.getQualityMetrics();
      
      if (metrics.qualityScore < 0.5) { // Poor quality
        console.warn(`Client ${clientId} has poor connection quality, considering optimization`);
        // Could trigger reconnection or configuration adjustments
      }
    }
  }

  private async optimizeMessageFlow(): Promise<void> {
    // Optimize message flow patterns
    const metrics = this.performanceOptimizer.monitorPerformance();
    
    if (metrics.networkEfficiency.throughputImprovement < 10) {
      // Enable more aggressive batching
      this.performanceOptimizer.configureBatching({
        maxBatchSize: 100,
        maxWaitTime: 500,
      });
    }

    if (metrics.networkEfficiency.compressionRatio < 1.2) {
      // Adjust compression settings
      this.performanceOptimizer.enableCompression({
        level: 9, // Maximum compression
        threshold: 512, // Lower threshold
      });
    }
  }

  private trackMessageMetrics(direction: 'sent' | 'received', message: any): void {
    // Track message-specific metrics
    // This would integrate with a metrics collection system
  }

  private trackErrorMetrics(clientId: string, error: any): void {
    // Track error-specific metrics
    console.error(`WebSocket error for client ${clientId}:`, error);
  }

  private startPerformanceReporting(): void {
    this.reportInterval = setInterval(() => {
      if (this.isEnabled) {
        const report = this.generatePerformanceReport();
        
        // Log summary report
        console.log('WebSocket Performance Report:', {
          timestamp: new Date().toISOString(),
          systemHealth: report.baseReport.systemHealth,
          clientCount: report.clientOverview.totalClients,
          averageQuality: report.clientOverview.averageQuality.toFixed(1),
          messageLatency: report.websocketMetrics.messageLatency.toFixed(1),
        });
        
        // Could emit event or send to monitoring system
      }
    }, this.config.integration.performanceReportInterval);
  }
}

// Export singleton instance
export const wsPerformanceIntegration = new WebSocketPerformanceIntegration();
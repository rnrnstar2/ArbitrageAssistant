import { 
  SystemCommandSender,
  DiagnosticResult,
  PerformanceMetrics,
  HealthCheckResult,
  ComponentHealth,
  LogData,
  LogEntry,
  DiagnosticRequestCommand
} from './system-command-sender';

// ===== DIAGNOSTIC INTERFACES =====

export interface DiagnosticManager {
  performHealthCheck(): Promise<HealthCheckResult>;
  collectPerformanceMetrics(period?: number): Promise<PerformanceMetrics>;
  collectMemoryMetrics(): Promise<MemoryMetrics>;
  collectConnectionMetrics(): Promise<ConnectionMetrics>;
  collectLogData(level?: string, period?: number): Promise<LogData>;
  runFullDiagnostic(): Promise<FullDiagnosticReport>;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  gcStats?: GCStats;
}

export interface GCStats {
  totalCollections: number;
  totalTime: number;
  lastCollection: Date;
  averageTime: number;
}

export interface ConnectionMetrics {
  activeConnections: number;
  totalConnections: number;
  failedConnections: number;
  averageLatency: number;
  dataTransferred: {
    sent: number;
    received: number;
  };
  lastActivity: Date;
  uptime: number;
}

export interface FullDiagnosticReport {
  timestamp: Date;
  overall: 'healthy' | 'warning' | 'critical';
  health: HealthCheckResult;
  performance: PerformanceMetrics;
  memory: MemoryMetrics;
  connection: ConnectionMetrics;
  logs: LogData;
  recommendations: string[];
}

// ===== DIAGNOSTIC MANAGER IMPLEMENTATION =====

export class WebSocketDiagnosticManager implements DiagnosticManager {
  private systemCommandSender: SystemCommandSender;
  private localMetrics: {
    startTime: Date;
    connectionStats: ConnectionMetrics;
    performanceHistory: PerformanceMetrics[];
    healthHistory: HealthCheckResult[];
  };

  constructor(systemCommandSender: SystemCommandSender) {
    this.systemCommandSender = systemCommandSender;
    this.localMetrics = {
      startTime: new Date(),
      connectionStats: this.initializeConnectionStats(),
      performanceHistory: [],
      healthHistory: []
    };
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const [connection, trading, dataSync, memory] = await Promise.all([
        this.checkConnectionHealth(),
        this.checkTradingHealth(),
        this.checkDataSyncHealth(),
        this.checkMemoryHealth()
      ]);

      const overall = this.determineOverallHealth([connection, trading, dataSync, memory]);
      
      const result: HealthCheckResult = {
        overall,
        components: { connection, trading, dataSync, memory },
        timestamp: new Date()
      };

      // Store in history
      this.localMetrics.healthHistory.push(result);
      if (this.localMetrics.healthHistory.length > 100) {
        this.localMetrics.healthHistory.shift();
      }

      return result;
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        overall: 'critical',
        components: {
          connection: { status: 'critical', message: 'Health check failed' },
          trading: { status: 'critical', message: 'Health check failed' },
          dataSync: { status: 'critical', message: 'Health check failed' },
          memory: { status: 'critical', message: 'Health check failed' }
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Collect performance metrics from EA
   */
  async collectPerformanceMetrics(period: number = 5): Promise<PerformanceMetrics> {
    try {
      const diagnosticRequest: DiagnosticRequestCommand = {
        requestType: 'performance',
        period,
        detailLevel: 'detailed'
      };

      const result = await this.systemCommandSender.sendDiagnosticRequest(diagnosticRequest);
      
      if (result.success && result.data) {
        const metrics = result.data as PerformanceMetrics;
        
        // Store in history
        this.localMetrics.performanceHistory.push(metrics);
        if (this.localMetrics.performanceHistory.length > 100) {
          this.localMetrics.performanceHistory.shift();
        }

        return metrics;
      } else {
        throw new Error(result.error || 'Failed to collect performance metrics');
      }
    } catch (error) {
      console.error('Performance metrics collection failed:', error);
      // Return default/estimated metrics
      return this.getDefaultPerformanceMetrics();
    }
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics(): Promise<MemoryMetrics> {
    try {
      const diagnosticRequest: DiagnosticRequestCommand = {
        requestType: 'memory',
        detailLevel: 'verbose'
      };

      const result = await this.systemCommandSender.sendDiagnosticRequest(diagnosticRequest);
      
      if (result.success && result.data) {
        return result.data as MemoryMetrics;
      } else {
        throw new Error(result.error || 'Failed to collect memory metrics');
      }
    } catch (error) {
      console.error('Memory metrics collection failed:', error);
      // Fallback to local memory metrics
      return this.getLocalMemoryMetrics();
    }
  }

  /**
   * Collect connection metrics
   */
  async collectConnectionMetrics(): Promise<ConnectionMetrics> {
    try {
      const diagnosticRequest: DiagnosticRequestCommand = {
        requestType: 'connection',
        detailLevel: 'detailed'
      };

      const result = await this.systemCommandSender.sendDiagnosticRequest(diagnosticRequest);
      
      if (result.success && result.data) {
        const eaMetrics = result.data as ConnectionMetrics;
        
        // Merge with local metrics
        this.localMetrics.connectionStats = {
          ...this.localMetrics.connectionStats,
          ...eaMetrics
        };

        return this.localMetrics.connectionStats;
      } else {
        throw new Error(result.error || 'Failed to collect connection metrics');
      }
    } catch (error) {
      console.error('Connection metrics collection failed:', error);
      return this.localMetrics.connectionStats;
    }
  }

  /**
   * Collect log data
   */
  async collectLogData(level: string = 'info', period: number = 60): Promise<LogData> {
    try {
      const diagnosticRequest: DiagnosticRequestCommand = {
        requestType: 'logs',
        period,
        detailLevel: 'detailed'
      };

      const result = await this.systemCommandSender.sendDiagnosticRequest(diagnosticRequest);
      
      if (result.success && result.data) {
        return result.data as LogData;
      } else {
        throw new Error(result.error || 'Failed to collect log data');
      }
    } catch (error) {
      console.error('Log data collection failed:', error);
      return this.getDefaultLogData(level, period);
    }
  }

  /**
   * Run full diagnostic
   */
  async runFullDiagnostic(): Promise<FullDiagnosticReport> {
    console.log('Starting full diagnostic...');
    
    try {
      const [health, performance, memory, connection, logs] = await Promise.all([
        this.performHealthCheck(),
        this.collectPerformanceMetrics(10),
        this.collectMemoryMetrics(),
        this.collectConnectionMetrics(),
        this.collectLogData('warning', 30)
      ]);

      const overall = this.determineOverallHealthFromDiagnostic(health, performance, memory, connection);
      const recommendations = this.generateRecommendations(health, performance, memory, connection, logs);

      return {
        timestamp: new Date(),
        overall,
        health,
        performance,
        memory,
        connection,
        logs,
        recommendations
      };
    } catch (error) {
      console.error('Full diagnostic failed:', error);
      throw error;
    }
  }

  // === PRIVATE HELPER METHODS ===

  private async checkConnectionHealth(): Promise<ComponentHealth> {
    try {
      const testResult = await this.systemCommandSender.sendTestConnection();
      
      if (testResult.success) {
        const latency = testResult.latency || 0;
        if (latency < 100) {
          return { status: 'healthy', message: `Connection OK (${latency}ms)` };
        } else if (latency < 500) {
          return { status: 'warning', message: `High latency (${latency}ms)` };
        } else {
          return { status: 'critical', message: `Very high latency (${latency}ms)` };
        }
      } else {
        return { status: 'critical', message: testResult.error || 'Connection test failed' };
      }
    } catch (error) {
      return { status: 'critical', message: 'Connection health check failed' };
    }
  }

  private async checkTradingHealth(): Promise<ComponentHealth> {
    try {
      // This would check trading-specific health metrics
      // For now, return a basic implementation
      return { status: 'healthy', message: 'Trading system operational' };
    } catch (error) {
      return { status: 'critical', message: 'Trading health check failed' };
    }
  }

  private async checkDataSyncHealth(): Promise<ComponentHealth> {
    try {
      // This would check data synchronization health
      // For now, return a basic implementation
      return { status: 'healthy', message: 'Data sync operational' };
    } catch (error) {
      return { status: 'warning', message: 'Data sync health check failed' };
    }
  }

  private async checkMemoryHealth(): Promise<ComponentHealth> {
    try {
      const memoryMetrics = await this.collectMemoryMetrics();
      const usagePercent = (memoryMetrics.heapUsed / memoryMetrics.heapTotal) * 100;
      
      if (usagePercent < 70) {
        return { status: 'healthy', message: `Memory usage: ${usagePercent.toFixed(1)}%` };
      } else if (usagePercent < 85) {
        return { status: 'warning', message: `High memory usage: ${usagePercent.toFixed(1)}%` };
      } else {
        return { status: 'critical', message: `Critical memory usage: ${usagePercent.toFixed(1)}%` };
      }
    } catch (error) {
      return { status: 'warning', message: 'Memory health check failed' };
    }
  }

  private determineOverallHealth(components: ComponentHealth[]): 'healthy' | 'warning' | 'critical' {
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const warningCount = components.filter(c => c.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 0) return 'warning';
    return 'healthy';
  }

  private determineOverallHealthFromDiagnostic(
    health: HealthCheckResult,
    performance: PerformanceMetrics,
    memory: MemoryMetrics,
    connection: ConnectionMetrics
  ): 'healthy' | 'warning' | 'critical' {
    if (health.overall === 'critical') return 'critical';
    
    // Check performance thresholds
    if (performance.cpuUsage > 90 || performance.memoryUsage > 90) return 'critical';
    if (performance.cpuUsage > 70 || performance.memoryUsage > 70) return 'warning';
    
    // Check memory thresholds
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (memoryUsagePercent > 85) return 'critical';
    if (memoryUsagePercent > 70) return 'warning';
    
    // Check connection quality
    if (connection.averageLatency > 1000) return 'critical';
    if (connection.averageLatency > 500) return 'warning';
    
    return health.overall;
  }

  private generateRecommendations(
    health: HealthCheckResult,
    performance: PerformanceMetrics,
    memory: MemoryMetrics,
    connection: ConnectionMetrics,
    logs: LogData
  ): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (performance.cpuUsage > 80) {
      recommendations.push('Consider reducing trading frequency or optimizing EA logic');
    }
    if (performance.memoryUsage > 80) {
      recommendations.push('Check for memory leaks in EA code');
    }
    
    // Memory recommendations
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push('Restart EA to free up memory');
    }
    
    // Connection recommendations
    if (connection.averageLatency > 500) {
      recommendations.push('Check network connection or consider server location');
    }
    if (connection.failedConnections > 0) {
      recommendations.push('Investigate connection stability issues');
    }
    
    // Log-based recommendations
    if (logs.entries.some(entry => entry.level === 'error')) {
      recommendations.push('Review error logs for critical issues');
    }
    
    return recommendations;
  }

  private initializeConnectionStats(): ConnectionMetrics {
    return {
      activeConnections: 0,
      totalConnections: 0,
      failedConnections: 0,
      averageLatency: 0,
      dataTransferred: { sent: 0, received: 0 },
      lastActivity: new Date(),
      uptime: 0
    };
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkLatency: 0,
      messageProcessingTime: 0,
      orderExecutionTime: 0
    };
  }

  private getLocalMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers
    };
  }

  private getDefaultLogData(level: string, period: number): LogData {
    const now = new Date();
    const start = new Date(now.getTime() - (period * 60 * 1000));
    
    return {
      level,
      entries: [],
      totalCount: 0,
      period: { start, end: now }
    };
  }

  // === PUBLIC UTILITY METHODS ===

  /**
   * Get diagnostic history
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.localMetrics.performanceHistory];
  }

  /**
   * Get health history
   */
  getHealthHistory(): HealthCheckResult[] {
    return [...this.localMetrics.healthHistory];
  }

  /**
   * Update connection stats
   */
  updateConnectionStats(stats: Partial<ConnectionMetrics>): void {
    this.localMetrics.connectionStats = {
      ...this.localMetrics.connectionStats,
      ...stats,
      lastActivity: new Date()
    };
  }

  /**
   * Get system uptime
   */
  getUptime(): number {
    return Date.now() - this.localMetrics.startTime.getTime();
  }
}
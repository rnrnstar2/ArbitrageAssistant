import { CommunicationDiagnostics, DiagnosisResult } from './communication-diagnostics';
import { WebSocketDiagnosticManager, FullDiagnosticReport } from '../websocket/diagnostic-manager';
import { WebSocketClient } from '../websocket/websocket-client';

export interface SystemDiagnosticReport {
  timestamp: Date;
  overallHealth: 'healthy' | 'warning' | 'critical';
  components: {
    connection: ComponentDiagnostic;
    ea: ComponentDiagnostic;
    data: ComponentDiagnostic;
    performance: ComponentDiagnostic;
    communication: ComponentDiagnostic;
    system: ComponentDiagnostic;
  };
  issues: DiagnosticIssue[];
  recommendations: string[];
  nextCheckTime: Date;
  summary: SystemHealthSummary;
}

export interface ComponentDiagnostic {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number; // 0-100
  lastCheck: Date;
  metrics: Record<string, number>;
  issues: string[];
  recommendations: string[];
  details?: any;
}

export interface DiagnosticIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  title: string;
  description: string;
  resolution?: string;
  timestamp: Date;
}

export interface SystemHealthSummary {
  overallScore: number;
  componentScores: Record<string, number>;
  criticalIssues: number;
  warningIssues: number;
  healthyComponents: number;
  uptime: number;
  lastIncident?: Date;
}

export interface EAHealthReport {
  status: 'healthy' | 'warning' | 'critical' | 'disconnected';
  lastCheck: Date;
  metrics: {
    connectionTime?: number;
    responseTime?: number;
    errorRate?: number;
    uptime?: number;
    messagesSent?: number;
    messagesReceived?: number;
  };
  issues: string[];
  recommendations: string[];
  eaInfo?: {
    version?: string;
    build?: string;
    account?: string;
    server?: string;
  };
}

export interface DataIntegrityReport {
  status: 'healthy' | 'warning' | 'critical';
  lastCheck: Date;
  metrics: {
    dataConsistency: number; // percentage
    messageIntegrity: number; // percentage
    syncQuality: number; // percentage
    validationErrors: number;
  };
  issues: string[];
  recommendations: string[];
  details: {
    positionSyncStatus: 'synced' | 'partial' | 'failed';
    accountSyncStatus: 'synced' | 'partial' | 'failed';
    marketDataStatus: 'live' | 'delayed' | 'stale';
  };
}

export interface PerformanceReport {
  status: 'healthy' | 'warning' | 'critical';
  lastCheck: Date;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage?: number;
    networkLatency: number;
    messageProcessingTime: number;
    orderExecutionTime?: number;
    throughput: number; // messages per second
  };
  issues: string[];
  recommendations: string[];
  trends: {
    cpuTrend: 'improving' | 'stable' | 'degrading';
    memoryTrend: 'improving' | 'stable' | 'degrading';
    latencyTrend: 'improving' | 'stable' | 'degrading';
  };
}

export class SystemDiagnostics {
  private websocketClient: WebSocketClient;
  private websocketDiagnosticManager: WebSocketDiagnosticManager;
  private communicationDiagnostics: CommunicationDiagnostics;
  private healthCheckers: Map<string, HealthChecker> = new Map();
  private diagnosticHistory: SystemDiagnosticReport[] = [];
  private performanceBaseline?: PerformanceReport;
  private systemStartTime = new Date();

  constructor(
    websocketClient: WebSocketClient,
    websocketDiagnosticManager: WebSocketDiagnosticManager
  ) {
    this.websocketClient = websocketClient;
    this.websocketDiagnosticManager = websocketDiagnosticManager;
    this.communicationDiagnostics = new CommunicationDiagnostics(websocketClient);
    
    this.initializeHealthCheckers();
  }

  /**
   * システム全体の包括的診断を実行
   */
  async performFullDiagnostic(): Promise<SystemDiagnosticReport> {
    const startTime = Date.now();
    console.log('🔍 Starting full system diagnostic...');
    
    try {
      // 並列で各コンポーネントの診断を実行
      const [
        connectionHealth,
        eaHealth, 
        dataHealth,
        performanceHealth,
        communicationHealth,
        systemHealth
      ] = await Promise.all([
        this.checkConnectionHealth(),
        this.checkEAHealth(),
        this.checkDataIntegrity(),
        this.checkPerformance(),
        this.checkCommunicationHealth(),
        this.checkSystemHealth()
      ]);

      // 全体的な健康状態を判定
      const allComponents = [
        connectionHealth,
        eaHealth,
        dataHealth,
        performanceHealth,
        communicationHealth,
        systemHealth
      ];
      
      const overallHealth = this.determineOverallHealth(allComponents);
      
      // 問題とイシューの収集
      const allIssues = this.collectIssues(allComponents);
      
      // 推奨事項の生成
      const recommendations = this.generateSystemRecommendations(allComponents, allIssues);
      
      // サマリー情報の生成
      const summary = this.generateHealthSummary(overallHealth, allComponents);

      const report: SystemDiagnosticReport = {
        timestamp: new Date(),
        overallHealth,
        components: {
          connection: connectionHealth,
          ea: eaHealth,
          data: dataHealth,
          performance: performanceHealth,
          communication: communicationHealth,
          system: systemHealth
        },
        issues: allIssues,
        recommendations,
        nextCheckTime: new Date(Date.now() + 5 * 60 * 1000), // 5分後
        summary
      };

      // 履歴に追加
      this.addToHistory(report);
      
      const duration = Date.now() - startTime;
      console.log(`✅ System diagnostic completed in ${duration}ms. Overall health: ${overallHealth}`);
      
      return report;
    } catch (error) {
      console.error('❌ System diagnostic failed:', error);
      throw error;
    }
  }

  /**
   * EA健康状態チェック
   */
  async checkEAHealth(): Promise<EAHealthReport> {
    try {
      const connectionState = this.websocketClient.getConnectionState();
      const connectionStats = this.websocketClient.getConnectionStats();
      
      // EA診断情報を取得
      const diagnosticReport = await this.websocketDiagnosticManager.runFullDiagnostic();
      
      // EA応答テストを実行
      const responseTest = await this.testEAResponsiveness();
      
      let status: EAHealthReport['status'] = 'disconnected';
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      if (connectionState === 'connected') {
        if (responseTest.success && responseTest.responseTime < 1000) {
          status = 'healthy';
        } else if (responseTest.success) {
          status = 'warning';
          issues.push('Slow EA response detected');
          recommendations.push('Check EA performance');
        } else {
          status = 'critical';
          issues.push('EA not responding');
          recommendations.push('Check EA connectivity and restart if necessary');
        }
      } else {
        issues.push(`WebSocket not connected: ${connectionState}`);
        recommendations.push('Check network connection and EA status');
      }

      // パフォーマンスメトリクスに基づく追加診断
      if (diagnosticReport.performance.cpuUsage > 80) {
        status = this.degradeStatus(status);
        issues.push('High CPU usage detected');
        recommendations.push('Optimize EA logic or reduce trading frequency');
      }

      if (diagnosticReport.performance.memoryUsage > 80) {
        status = this.degradeStatus(status);
        issues.push('High memory usage detected');
        recommendations.push('Check for memory leaks');
      }

      return {
        status,
        lastCheck: new Date(),
        metrics: {
          connectionTime: responseTest.responseTime,
          responseTime: responseTest.responseTime,
          errorRate: this.calculateErrorRate(),
          uptime: this.websocketDiagnosticManager.getUptime(),
          messagesSent: connectionStats.quality?.successCount || 0,
          messagesReceived: connectionStats.quality?.failureCount || 0
        },
        issues,
        recommendations,
        eaInfo: responseTest.eaInfo
      };
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: new Date(),
        metrics: {},
        issues: [`EA health check failed: ${error.message}`],
        recommendations: ['Check EA connectivity', 'Verify EA is running', 'Review error logs']
      };
    }
  }

  /**
   * データ整合性チェック
   */
  async checkDataIntegrity(): Promise<DataIntegrityReport> {
    try {
      // WebSocket診断から同期品質情報を取得
      const diagnosticReport = await this.websocketDiagnosticManager.runFullDiagnostic();
      
      // データ同期状態をチェック
      const syncStatus = await this.checkDataSyncStatus();
      
      // メッセージ整合性をチェック
      const messageIntegrity = await this.checkMessageIntegrity();
      
      let status: DataIntegrityReport['status'] = 'healthy';
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // データ一貫性の評価
      const dataConsistency = this.calculateDataConsistency(syncStatus);
      if (dataConsistency < 95) {
        status = 'warning';
        issues.push('Data consistency below threshold');
        recommendations.push('Check data synchronization processes');
      }
      
      // メッセージ整合性の評価
      if (messageIntegrity < 98) {
        status = this.degradeStatus(status);
        issues.push('Message integrity issues detected');
        recommendations.push('Check message validation and error handling');
      }
      
      // 同期品質の評価
      const syncQuality = this.calculateSyncQuality(syncStatus);
      if (syncQuality < 90) {
        status = this.degradeStatus(status);
        issues.push('Poor synchronization quality');
        recommendations.push('Restart synchronization processes');
      }

      return {
        status,
        lastCheck: new Date(),
        metrics: {
          dataConsistency,
          messageIntegrity,
          syncQuality,
          validationErrors: syncStatus.validationErrors
        },
        issues,
        recommendations,
        details: {
          positionSyncStatus: syncStatus.positionSync,
          accountSyncStatus: syncStatus.accountSync,
          marketDataStatus: syncStatus.marketDataStatus
        }
      };
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: new Date(),
        metrics: {
          dataConsistency: 0,
          messageIntegrity: 0,
          syncQuality: 0,
          validationErrors: 1
        },
        issues: [`Data integrity check failed: ${error.message}`],
        recommendations: ['Investigate data sync systems', 'Check validation processes'],
        details: {
          positionSyncStatus: 'failed',
          accountSyncStatus: 'failed',
          marketDataStatus: 'stale'
        }
      };
    }
  }

  /**
   * パフォーマンスチェック
   */
  async checkPerformance(): Promise<PerformanceReport> {
    try {
      const diagnosticReport = await this.websocketDiagnosticManager.runFullDiagnostic();
      const communicationDiagnosis = await this.communicationDiagnostics.diagnoseProblem();
      
      const currentMetrics = {
        cpuUsage: diagnosticReport.performance.cpuUsage,
        memoryUsage: diagnosticReport.performance.memoryUsage,
        diskUsage: diagnosticReport.performance.diskUsage,
        networkLatency: communicationDiagnosis.components.latency.metrics.averageLatency,
        messageProcessingTime: diagnosticReport.performance.messageProcessingTime,
        orderExecutionTime: diagnosticReport.performance.orderExecutionTime,
        throughput: communicationDiagnosis.components.throughput.metrics.messagesPerSecond
      };
      
      let status: PerformanceReport['status'] = 'healthy';
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // CPU使用率チェック
      if (currentMetrics.cpuUsage > 90) {
        status = 'critical';
        issues.push('Critical CPU usage detected');
        recommendations.push('Reduce processing load or scale resources');
      } else if (currentMetrics.cpuUsage > 70) {
        status = 'warning';
        issues.push('High CPU usage detected');
        recommendations.push('Monitor CPU usage and consider optimization');
      }
      
      // メモリ使用率チェック
      if (currentMetrics.memoryUsage > 90) {
        status = this.degradeStatus(status);
        issues.push('Critical memory usage detected');
        recommendations.push('Check for memory leaks and restart if necessary');
      } else if (currentMetrics.memoryUsage > 80) {
        status = this.degradeStatus(status);
        issues.push('High memory usage detected');
        recommendations.push('Monitor memory usage patterns');
      }
      
      // ネットワークレイテンシチェック
      if (currentMetrics.networkLatency > 1000) {
        status = this.degradeStatus(status);
        issues.push('High network latency detected');
        recommendations.push('Check network connection and server location');
      }
      
      // スループットチェック
      if (currentMetrics.throughput < 10) {
        status = this.degradeStatus(status);
        issues.push('Low message throughput detected');
        recommendations.push('Check processing efficiency and network capacity');
      }
      
      // トレンド分析
      const trends = this.calculatePerformanceTrends(currentMetrics);

      return {
        status,
        lastCheck: new Date(),
        metrics: currentMetrics,
        issues,
        recommendations,
        trends
      };
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: new Date(),
        metrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          networkLatency: 0,
          messageProcessingTime: 0,
          throughput: 0
        },
        issues: [`Performance check failed: ${error.message}`],
        recommendations: ['Check system resources', 'Investigate performance monitoring'],
        trends: {
          cpuTrend: 'stable',
          memoryTrend: 'stable',
          latencyTrend: 'stable'
        }
      };
    }
  }

  /**
   * 通信健康状態チェック
   */
  async checkCommunicationHealth(): Promise<ComponentDiagnostic> {
    try {
      const diagnosis = await this.communicationDiagnostics.diagnoseProblem();
      
      let overallScore = 0;
      let totalComponents = 0;
      
      Object.values(diagnosis.components).forEach(comp => {
        overallScore += comp.score;
        totalComponents++;
      });
      
      const averageScore = totalComponents > 0 ? overallScore / totalComponents : 0;
      
      return {
        status: diagnosis.overall === 'healthy' ? 'healthy' : 
               diagnosis.overall === 'degraded' ? 'warning' : 'critical',
        score: averageScore,
        lastCheck: new Date(),
        metrics: {
          connectionScore: diagnosis.components.connection.score,
          latencyScore: diagnosis.components.latency.score,
          throughputScore: diagnosis.components.throughput.score,
          stabilityScore: diagnosis.components.stability.score
        },
        issues: diagnosis.summary,
        recommendations: diagnosis.actionPlan,
        details: diagnosis
      };
    } catch (error) {
      return {
        status: 'critical',
        score: 0,
        lastCheck: new Date(),
        metrics: {},
        issues: [`Communication health check failed: ${error.message}`],
        recommendations: ['Check WebSocket connectivity', 'Verify network status']
      };
    }
  }

  /**
   * システム健康状態チェック
   */
  async checkSystemHealth(): Promise<ComponentDiagnostic> {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      
      let status: ComponentDiagnostic['status'] = 'healthy';
      let score = 100;
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // システム稼働時間チェック
      const uptime = Date.now() - this.systemStartTime.getTime();
      if (uptime < 60000) { // 1分未満
        score -= 10;
        issues.push('System recently started');
      }
      
      // プロセス健康状態チェック
      if (systemMetrics.processHealth < 90) {
        status = 'warning';
        score -= 20;
        issues.push('Process health degraded');
        recommendations.push('Check system processes');
      }
      
      // リソース可用性チェック
      if (systemMetrics.resourceAvailability < 80) {
        status = this.degradeStatus(status);
        score -= 30;
        issues.push('Limited system resources');
        recommendations.push('Free up system resources');
      }

      return {
        status,
        score: Math.max(0, score),
        lastCheck: new Date(),
        metrics: {
          uptime: uptime / 1000, // seconds
          processHealth: systemMetrics.processHealth,
          resourceAvailability: systemMetrics.resourceAvailability,
          errorRate: systemMetrics.errorRate
        },
        issues,
        recommendations
      };
    } catch (error) {
      return {
        status: 'critical',
        score: 0,
        lastCheck: new Date(),
        metrics: {},
        issues: [`System health check failed: ${error.message}`],
        recommendations: ['Investigate system status', 'Check error logs']
      };
    }
  }

  /**
   * 推奨事項を生成
   */
  generateRecommendations(): Promise<string[]> {
    return this.performFullDiagnostic().then(report => report.recommendations);
  }

  /**
   * 診断履歴を取得
   */
  getDiagnosticHistory(): SystemDiagnosticReport[] {
    return [...this.diagnosticHistory];
  }

  /**
   * 最新の診断レポートを取得
   */
  getLatestReport(): SystemDiagnosticReport | null {
    return this.diagnosticHistory.length > 0 ? 
      this.diagnosticHistory[this.diagnosticHistory.length - 1] : null;
  }

  // Private helper methods

  private initializeHealthCheckers(): void {
    this.healthCheckers.set('connection', new ConnectionHealthChecker());
    this.healthCheckers.set('ea', new EAHealthChecker());
    this.healthCheckers.set('data', new DataHealthChecker());
    this.healthCheckers.set('performance', new PerformanceHealthChecker());
  }

  private async checkConnectionHealth(): Promise<ComponentDiagnostic> {
    const connectionTest = await this.communicationDiagnostics.testConnection();
    
    const status = connectionTest.success ? 'healthy' : 'critical';
    const score = connectionTest.success ? 
      (connectionTest.responseTime < 1000 ? 95 : 75) : 20;
    
    return {
      status,
      score,
      lastCheck: new Date(),
      metrics: {
        responseTime: connectionTest.responseTime,
        success: connectionTest.success ? 1 : 0
      },
      issues: connectionTest.success ? [] : ['Connection failed'],
      recommendations: connectionTest.recommendations
    };
  }

  private async testEAResponsiveness(): Promise<any> {
    try {
      const latencyTest = await this.communicationDiagnostics.measureLatency(10);
      
      return {
        success: latencyTest.averageLatency < 2000,
        responseTime: latencyTest.averageLatency,
        eaInfo: {
          version: 'Unknown',
          build: 'Unknown'
        }
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Infinity,
        error: error.message
      };
    }
  }

  private calculateErrorRate(): number {
    const stats = this.websocketClient.getConnectionStats();
    const total = (stats.quality?.successCount || 0) + (stats.quality?.failureCount || 0);
    return total > 0 ? ((stats.quality?.failureCount || 0) / total) * 100 : 0;
  }

  private async checkDataSyncStatus(): Promise<any> {
    return {
      positionSync: 'synced' as const,
      accountSync: 'synced' as const,
      marketDataStatus: 'live' as const,
      validationErrors: 0
    };
  }

  private async checkMessageIntegrity(): Promise<number> {
    const qualityMetrics = this.websocketClient.getQualityMetrics();
    return qualityMetrics.successRate * 100;
  }

  private calculateDataConsistency(syncStatus: any): number {
    let score = 100;
    if (syncStatus.positionSync !== 'synced') score -= 30;
    if (syncStatus.accountSync !== 'synced') score -= 30;
    if (syncStatus.marketDataStatus !== 'live') score -= 20;
    return Math.max(0, score);
  }

  private calculateSyncQuality(syncStatus: any): number {
    return syncStatus.validationErrors === 0 ? 100 : Math.max(0, 100 - syncStatus.validationErrors * 10);
  }

  private async collectSystemMetrics(): Promise<any> {
    return {
      processHealth: 95,
      resourceAvailability: 85,
      errorRate: this.calculateErrorRate()
    };
  }

  private calculatePerformanceTrends(currentMetrics: any): PerformanceReport['trends'] {
    // 簡単なトレンド分析（実際の実装では履歴データを使用）
    return {
      cpuTrend: 'stable' as const,
      memoryTrend: 'stable' as const,
      latencyTrend: 'stable' as const
    };
  }

  private degradeStatus(currentStatus: string): any {
    if (currentStatus === 'healthy') return 'warning';
    if (currentStatus === 'warning') return 'critical';
    return currentStatus;
  }

  private determineOverallHealth(components: ComponentDiagnostic[]): 'healthy' | 'warning' | 'critical' {
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const warningCount = components.filter(c => c.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 1) return 'warning';
    return 'healthy';
  }

  private collectIssues(components: ComponentDiagnostic[]): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];
    const componentNames = ['connection', 'ea', 'data', 'performance', 'communication', 'system'];
    
    components.forEach((comp, index) => {
      comp.issues.forEach(issue => {
        issues.push({
          severity: comp.status === 'critical' ? 'critical' : 
                   comp.status === 'warning' ? 'medium' : 'low',
          component: componentNames[index],
          title: issue,
          description: issue,
          timestamp: new Date()
        });
      });
    });
    
    return issues;
  }

  private generateSystemRecommendations(components: ComponentDiagnostic[], issues: DiagnosticIssue[]): string[] {
    const recommendations = new Set<string>();
    
    components.forEach(comp => {
      comp.recommendations.forEach(rec => recommendations.add(rec));
    });
    
    // 緊急度の高い問題に対する追加推奨事項
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.add('Address critical issues immediately');
    }
    
    return Array.from(recommendations);
  }

  private generateHealthSummary(
    overallHealth: string, 
    components: ComponentDiagnostic[]
  ): SystemHealthSummary {
    const componentScores: Record<string, number> = {};
    const componentNames = ['connection', 'ea', 'data', 'performance', 'communication', 'system'];
    
    let totalScore = 0;
    let criticalIssues = 0;
    let warningIssues = 0;
    let healthyComponents = 0;
    
    components.forEach((comp, index) => {
      componentScores[componentNames[index]] = comp.score;
      totalScore += comp.score;
      
      if (comp.status === 'critical') criticalIssues++;
      else if (comp.status === 'warning') warningIssues++;
      else if (comp.status === 'healthy') healthyComponents++;
    });
    
    return {
      overallScore: totalScore / components.length,
      componentScores,
      criticalIssues,
      warningIssues,
      healthyComponents,
      uptime: Date.now() - this.systemStartTime.getTime(),
      lastIncident: criticalIssues > 0 ? new Date() : undefined
    };
  }

  private addToHistory(report: SystemDiagnosticReport): void {
    this.diagnosticHistory.push(report);
    
    // 最大100件まで保持
    if (this.diagnosticHistory.length > 100) {
      this.diagnosticHistory.shift();
    }
  }
}

// Health checker interfaces and implementations
interface HealthChecker {
  check(): Promise<ComponentDiagnostic>;
}

class ConnectionHealthChecker implements HealthChecker {
  async check(): Promise<ComponentDiagnostic> {
    return {
      status: 'healthy',
      score: 95,
      lastCheck: new Date(),
      metrics: {},
      issues: [],
      recommendations: []
    };
  }
}

class EAHealthChecker implements HealthChecker {
  async check(): Promise<ComponentDiagnostic> {
    return {
      status: 'healthy',
      score: 90,
      lastCheck: new Date(),
      metrics: {},
      issues: [],
      recommendations: []
    };
  }
}

class DataHealthChecker implements HealthChecker {
  async check(): Promise<ComponentDiagnostic> {
    return {
      status: 'healthy',
      score: 98,
      lastCheck: new Date(),
      metrics: {},
      issues: [],
      recommendations: []
    };
  }
}

class PerformanceHealthChecker implements HealthChecker {
  async check(): Promise<ComponentDiagnostic> {
    return {
      status: 'healthy',
      score: 85,
      lastCheck: new Date(),
      metrics: {},
      issues: [],
      recommendations: []
    };
  }
}
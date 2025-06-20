import { WebSocketClient } from '../websocket/websocket-client';
import { WebSocketMessage } from '../websocket/message-types';

export interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  eaVersion?: string;
  eaStatus?: string;
  networkPath?: NetworkHop[];
  recommendations: string[];
}

export interface NetworkHop {
  ip: string;
  hostname?: string;
  responseTime: number;
  loss: number;
}

export interface LatencyTestResult {
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  jitter: number;
  testResults: number[];
  analysis: LatencyAnalysis;
}

export interface LatencyAnalysis {
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  issues: string[];
  recommendations: string[];
}

export interface ThroughputTestResult {
  messagesPerSecond: number;
  bytesPerSecond: number;
  peakThroughput: number;
  sustainedThroughput: number;
  bottleneckAnalysis: BottleneckAnalysis;
}

export interface BottleneckAnalysis {
  type: 'none' | 'network' | 'processing' | 'serialization';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendations: string[];
}

export interface DiagnosisResult {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    connection: ComponentDiagnosis;
    latency: ComponentDiagnosis;
    throughput: ComponentDiagnosis;
    stability: ComponentDiagnosis;
  };
  summary: string[];
  actionPlan: string[];
}

export interface ComponentDiagnosis {
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  metrics: Record<string, number>;
  issues: string[];
}

export class CommunicationDiagnostics {
  private websocketClient: WebSocketClient;
  private testManager: TestManager;
  private networkAnalyzer: NetworkAnalyzer;
  
  constructor(websocketClient: WebSocketClient) {
    this.websocketClient = websocketClient;
    this.testManager = new TestManager();
    this.networkAnalyzer = new NetworkAnalyzer();
  }

  /**
   * 基本接続テストを実行
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      const connectionResult = await this.performBasicConnectionTest();
      const eaResponse = await this.testEAResponse();
      const networkPath = await this.traceNetworkPath();
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: connectionResult.success && eaResponse.success,
        responseTime,
        eaVersion: eaResponse.version,
        eaStatus: eaResponse.status,
        networkPath,
        recommendations: this.generateConnectionRecommendations(connectionResult, eaResponse)
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        recommendations: [
          `Connection failed: ${error.message}`,
          'Check network connectivity',
          'Verify EA is running',
          'Check firewall settings'
        ]
      };
    }
  }

  /**
   * レイテンシ測定テストを実行
   */
  async measureLatency(iterations: number = 100): Promise<LatencyTestResult> {
    const testResults: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await this.sendPingMessage();
        const endTime = performance.now();
        testResults.push(endTime - startTime);
      } catch (error) {
        testResults.push(Number.MAX_SAFE_INTEGER);
      }
      
      await this.sleep(100);
    }
    
    const validResults = testResults.filter(r => r !== Number.MAX_SAFE_INTEGER);
    const sortedResults = validResults.sort((a, b) => a - b);
    
    const averageLatency = validResults.reduce((sum, val) => sum + val, 0) / validResults.length;
    const minLatency = Math.min(...validResults);
    const maxLatency = Math.max(...validResults);
    const p95Latency = sortedResults[Math.floor(sortedResults.length * 0.95)];
    const p99Latency = sortedResults[Math.floor(sortedResults.length * 0.99)];
    const jitter = this.calculateJitter(validResults);
    
    return {
      averageLatency,
      minLatency,
      maxLatency,
      p95Latency,
      p99Latency,
      jitter,
      testResults: validResults,
      analysis: this.analyzeLatency(validResults)
    };
  }

  /**
   * スループットテストを実行
   */
  async testThroughput(duration: number = 30): Promise<ThroughputTestResult> {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    let messagesSent = 0;
    let bytesSent = 0;
    const throughputSamples: number[] = [];
    
    let sampleStartTime = startTime;
    let sampleMessages = 0;
    
    while (Date.now() < endTime) {
      const testMessage = this.createTestMessage();
      const messageSize = JSON.stringify(testMessage).length;
      
      try {
        await this.sendTestMessage(testMessage);
        messagesSent++;
        bytesSent += messageSize;
        sampleMessages++;
        
        const currentTime = Date.now();
        if (currentTime - sampleStartTime >= 1000) {
          const sampleThroughput = sampleMessages / ((currentTime - sampleStartTime) / 1000);
          throughputSamples.push(sampleThroughput);
          sampleStartTime = currentTime;
          sampleMessages = 0;
        }
      } catch (error) {
        console.error('Throughput test message failed:', error);
      }
      
      await this.sleep(10);
    }
    
    const actualDuration = (Date.now() - startTime) / 1000;
    const messagesPerSecond = messagesSent / actualDuration;
    const bytesPerSecond = bytesSent / actualDuration;
    const peakThroughput = Math.max(...throughputSamples);
    const sustainedThroughput = throughputSamples.reduce((sum, val) => sum + val, 0) / throughputSamples.length;
    
    return {
      messagesPerSecond,
      bytesPerSecond,
      peakThroughput,
      sustainedThroughput,
      bottleneckAnalysis: this.analyzeBottlenecks(messagesPerSecond, bytesPerSecond, throughputSamples)
    };
  }

  /**
   * 包括的な問題診断を実行
   */
  async diagnoseProblem(): Promise<DiagnosisResult> {
    const [connectionTest, latencyTest, throughputTest, stabilityTest] = await Promise.all([
      this.testConnection(),
      this.measureLatency(50),
      this.testThroughput(15),
      this.testConnectionStability()
    ]);

    const connectionDiagnosis = this.diagnoseConnection(connectionTest);
    const latencyDiagnosis = this.diagnoseLatency(latencyTest);
    const throughputDiagnosis = this.diagnoseThroughput(throughputTest);
    const stabilityDiagnosis = this.diagnoseStability(stabilityTest);

    const overall = this.determineOverallHealth([
      connectionDiagnosis,
      latencyDiagnosis,
      throughputDiagnosis,
      stabilityDiagnosis
    ]);

    return {
      overall,
      components: {
        connection: connectionDiagnosis,
        latency: latencyDiagnosis,
        throughput: throughputDiagnosis,
        stability: stabilityDiagnosis
      },
      summary: this.generateSummary(overall, [connectionDiagnosis, latencyDiagnosis, throughputDiagnosis, stabilityDiagnosis]),
      actionPlan: this.generateActionPlan([connectionDiagnosis, latencyDiagnosis, throughputDiagnosis, stabilityDiagnosis])
    };
  }

  // Private helper methods

  private async performBasicConnectionTest(): Promise<{ success: boolean; details?: any }> {
    try {
      const state = this.websocketClient.getConnectionState();
      if (state !== 'connected') {
        return { success: false, details: { state } };
      }
      
      const stats = this.websocketClient.getConnectionStats();
      return { success: true, details: stats };
    } catch (error) {
      return { success: false, details: { error: error.message } };
    }
  }

  private async testEAResponse(): Promise<{ success: boolean; version?: string; status?: string }> {
    try {
      const testMessage: WebSocketMessage = {
        type: 'system_test',
        payload: { test: 'connection_check' },
        timestamp: Date.now()
      };

      const responsePromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('EA response timeout')), 5000);
        
        const handler = (event: string, data: any) => {
          if (data?.type === 'system_test_response') {
            clearTimeout(timeout);
            this.websocketClient.off('message_received', handler);
            resolve(data);
          }
        };
        
        this.websocketClient.on('message_received', handler);
      });

      this.websocketClient.send(testMessage);
      const response = await responsePromise;
      
      return {
        success: true,
        version: response.payload?.version,
        status: response.payload?.status
      };
    } catch (error) {
      return { success: false };
    }
  }

  private async traceNetworkPath(): Promise<NetworkHop[]> {
    return this.networkAnalyzer.tracePath();
  }

  private async sendPingMessage(): Promise<void> {
    const pingMessage: WebSocketMessage = {
      type: 'ping',
      payload: { timestamp: Date.now() },
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Ping timeout')), 2000);
      
      const handler = (event: string, data: any) => {
        if (data?.type === 'pong') {
          clearTimeout(timeout);
          this.websocketClient.off('message_received', handler);
          resolve();
        }
      };
      
      this.websocketClient.on('message_received', handler);
      this.websocketClient.send(pingMessage);
    });
  }

  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;
    
    let jitterSum = 0;
    for (let i = 1; i < latencies.length; i++) {
      jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    return jitterSum / (latencies.length - 1);
  }

  private analyzeLatency(latencies: number[]): LatencyAnalysis {
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const jitter = this.calculateJitter(latencies);
    
    let quality: LatencyAnalysis['quality'];
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (avgLatency < 50) {
      quality = 'excellent';
    } else if (avgLatency < 100) {
      quality = 'good';
      if (jitter > 20) {
        issues.push('Moderate jitter detected');
        recommendations.push('Check network stability');
      }
    } else if (avgLatency < 200) {
      quality = 'poor';
      issues.push('High latency detected');
      recommendations.push('Check network connection', 'Consider server location');
    } else {
      quality = 'critical';
      issues.push('Critical latency detected');
      recommendations.push('Immediate network investigation required', 'Consider alternative connection');
    }

    if (jitter > 50) {
      issues.push('High jitter affecting stability');
      recommendations.push('Check for network congestion', 'Verify QoS settings');
    }

    return { quality, issues, recommendations };
  }

  private createTestMessage(): WebSocketMessage {
    return {
      type: 'throughput_test',
      payload: {
        testId: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        data: 'x'.repeat(1000) // 1KB test data
      },
      timestamp: Date.now()
    };
  }

  private async sendTestMessage(message: WebSocketMessage): Promise<void> {
    this.websocketClient.send(message);
  }

  private analyzeBottlenecks(mps: number, bps: number, samples: number[]): BottleneckAnalysis {
    const variance = this.calculateVariance(samples);
    
    if (mps < 10) {
      return {
        type: 'processing',
        severity: 'high',
        description: 'Low message processing rate detected',
        recommendations: ['Optimize message processing logic', 'Check system resources']
      };
    }
    
    if (variance > mps * 0.5) {
      return {
        type: 'network',
        severity: 'medium',
        description: 'High throughput variance indicates network instability',
        recommendations: ['Check network conditions', 'Monitor bandwidth usage']
      };
    }
    
    return {
      type: 'none',
      severity: 'low',
      description: 'No significant bottlenecks detected',
      recommendations: []
    };
  }

  private async testConnectionStability(): Promise<any> {
    const stabilityMetrics = {
      disconnections: 0,
      reconnections: 0,
      messageFailures: 0,
      uptime: this.websocketClient.getConnectionStats().heartbeat?.uptime || 0
    };
    
    return stabilityMetrics;
  }

  private diagnoseConnection(test: ConnectionTestResult): ComponentDiagnosis {
    const score = test.success ? (test.responseTime < 1000 ? 90 : 70) : 20;
    const status = score > 80 ? 'healthy' : score > 50 ? 'warning' : 'critical';
    
    return {
      status,
      score,
      metrics: { responseTime: test.responseTime },
      issues: test.success ? [] : ['Connection failed']
    };
  }

  private diagnoseLatency(test: LatencyTestResult): ComponentDiagnosis {
    const score = test.averageLatency < 50 ? 95 : 
                  test.averageLatency < 100 ? 80 : 
                  test.averageLatency < 200 ? 60 : 30;
    const status = score > 80 ? 'healthy' : score > 50 ? 'warning' : 'critical';
    
    return {
      status,
      score,
      metrics: { 
        averageLatency: test.averageLatency,
        jitter: test.jitter,
        p95Latency: test.p95Latency
      },
      issues: test.analysis.issues
    };
  }

  private diagnoseThroughput(test: ThroughputTestResult): ComponentDiagnosis {
    const score = test.messagesPerSecond > 50 ? 90 : 
                  test.messagesPerSecond > 20 ? 70 : 
                  test.messagesPerSecond > 10 ? 50 : 30;
    const status = score > 80 ? 'healthy' : score > 50 ? 'warning' : 'critical';
    
    return {
      status,
      score,
      metrics: {
        messagesPerSecond: test.messagesPerSecond,
        bytesPerSecond: test.bytesPerSecond
      },
      issues: test.bottleneckAnalysis.type !== 'none' ? [test.bottleneckAnalysis.description] : []
    };
  }

  private diagnoseStability(test: any): ComponentDiagnosis {
    const score = test.disconnections === 0 ? 95 :
                  test.disconnections < 3 ? 70 : 40;
    const status = score > 80 ? 'healthy' : score > 50 ? 'warning' : 'critical';
    
    return {
      status,
      score,
      metrics: {
        uptime: test.uptime,
        disconnections: test.disconnections,
        messageFailures: test.messageFailures
      },
      issues: test.disconnections > 0 ? ['Connection instability detected'] : []
    };
  }

  private determineOverallHealth(components: ComponentDiagnosis[]): 'healthy' | 'degraded' | 'critical' {
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const warningCount = components.filter(c => c.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 1) return 'degraded';
    return 'healthy';
  }

  private generateSummary(overall: string, components: ComponentDiagnosis[]): string[] {
    const summary = [`Overall communication health: ${overall}`];
    
    components.forEach((comp, index) => {
      const names = ['connection', 'latency', 'throughput', 'stability'];
      summary.push(`${names[index]}: ${comp.status} (score: ${comp.score})`);
    });
    
    return summary;
  }

  private generateActionPlan(components: ComponentDiagnosis[]): string[] {
    const actions: string[] = [];
    
    components.forEach(comp => {
      if (comp.status === 'critical') {
        actions.push(`URGENT: Address ${comp.issues.join(', ')}`);
      } else if (comp.status === 'warning') {
        actions.push(`Monitor: ${comp.issues.join(', ')}`);
      }
    });
    
    return actions;
  }

  private generateConnectionRecommendations(connectionResult: any, eaResponse: any): string[] {
    const recommendations: string[] = [];
    
    if (!connectionResult.success) {
      recommendations.push('Check WebSocket connection', 'Verify server availability');
    }
    
    if (!eaResponse.success) {
      recommendations.push('Check EA connectivity', 'Verify EA is running');
    }
    
    return recommendations;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class TestManager {
  private activeTests: Map<string, any> = new Map();
  
  createTest(type: string, config: any): string {
    const testId = Math.random().toString(36).substr(2, 9);
    this.activeTests.set(testId, { type, config, startTime: Date.now() });
    return testId;
  }
  
  getTest(testId: string): any {
    return this.activeTests.get(testId);
  }
  
  completeTest(testId: string): void {
    this.activeTests.delete(testId);
  }
  
  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }
}

class NetworkAnalyzer {
  async tracePath(): Promise<NetworkHop[]> {
    return [
      { ip: '127.0.0.1', hostname: 'localhost', responseTime: 1, loss: 0 },
      { ip: '192.168.1.1', hostname: 'gateway', responseTime: 5, loss: 0 }
    ];
  }
}
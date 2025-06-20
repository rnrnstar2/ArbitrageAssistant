export interface QualityConfig {
  rttThresholds: {
    good: number;     // < good は良好
    normal: number;   // good - normal は普通
    // > normal は悪い
  };
  successRateThresholds: {
    good: number;     // > good は良好
    normal: number;   // normal - good は普通
    // < normal は悪い
  };
  qualityWeights: {
    rtt: number;        // RTTの重み（0-1）
    successRate: number; // 成功率の重み（0-1）
    uptime: number;     // 稼働率の重み（0-1）
  };
  historySize: number; // 統計履歴の保持数
}

export interface QualityMetrics {
  averageRTT: number;
  connectionUptime: number;
  messageSuccessRate: number;
  qualityScore: number;      // 0-100
  qualityLevel: 'good' | 'normal' | 'poor';
  lastUpdate: Date;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  uptimePercentage: number;
}

export interface MessageStats {
  sent: number;
  received: number;
  failed: number;
  timedOut: number;
  lastSuccess: number;
  lastFailure: number;
}

export interface QualityReport extends QualityMetrics {
  rttDetails: {
    min: number;
    max: number;
    average: number;
    recent: number[];
  };
  connectionDetails: {
    startTime: number;
    totalUptime: number;
    disconnectionCount: number;
    lastDisconnection?: number;
  };
  recommendations: string[];
}

export type QualityEventType = 
  | "quality_updated"
  | "quality_degraded"
  | "quality_improved"
  | "threshold_crossed";

export interface QualityEventHandler {
  (event: QualityEventType, data?: any): void;
}

export class QualityMonitor {
  private config: QualityConfig;
  private eventHandlers: Map<QualityEventType, QualityEventHandler[]> = new Map();
  
  private metrics: QualityMetrics;
  private messageStats: MessageStats;
  private rttHistory: number[] = [];
  private connectionStartTime = 0;
  private totalDowntime = 0;
  private disconnectionCount = 0;
  private lastDisconnection: number | null = null;
  private isConnected = false;
  private lastQualityScore = 0;

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = {
      rttThresholds: {
        good: 100,    // 100ms未満は良好
        normal: 300,  // 300ms未満は普通
      },
      successRateThresholds: {
        good: 99,     // 99%以上は良好
        normal: 95,   // 95%以上は普通
      },
      qualityWeights: {
        rtt: 0.4,
        successRate: 0.4,
        uptime: 0.2,
      },
      historySize: 100,
      ...config,
    };

    this.metrics = {
      averageRTT: 0,
      connectionUptime: 0,
      messageSuccessRate: 100,
      qualityScore: 100,
      qualityLevel: 'good',
      lastUpdate: new Date(),
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      uptimePercentage: 100,
    };

    this.messageStats = {
      sent: 0,
      received: 0,
      failed: 0,
      timedOut: 0,
      lastSuccess: 0,
      lastFailure: 0,
    };

    // Initialize event handler maps
    [
      "quality_updated",
      "quality_degraded",
      "quality_improved",
      "threshold_crossed"
    ].forEach(event => {
      this.eventHandlers.set(event as QualityEventType, []);
    });
  }

  /**
   * 接続開始時に呼び出す
   */
  onConnectionStarted(): void {
    this.connectionStartTime = Date.now();
    this.isConnected = true;
    this.updateMetrics();
  }

  /**
   * 接続終了時に呼び出す
   */
  onConnectionEnded(): void {
    if (this.isConnected && this.connectionStartTime > 0) {
      this.totalDowntime += Date.now() - this.connectionStartTime;
      this.disconnectionCount++;
      this.lastDisconnection = Date.now();
    }
    this.isConnected = false;
    this.updateMetrics();
  }

  /**
   * RTT更新
   */
  updateRTT(rtt: number): void {
    this.rttHistory.push(rtt);
    
    // 履歴サイズを制限
    if (this.rttHistory.length > this.config.historySize) {
      this.rttHistory.shift();
    }

    this.updateMetrics();
  }

  /**
   * メッセージ送信成功を記録
   */
  recordMessageSuccess(): void {
    this.messageStats.sent++;
    this.messageStats.received++;
    this.messageStats.lastSuccess = Date.now();
    this.updateMetrics();
  }

  /**
   * メッセージ送信失敗を記録
   */
  recordMessageFailure(): void {
    this.messageStats.sent++;
    this.messageStats.failed++;
    this.messageStats.lastFailure = Date.now();
    this.updateMetrics();
  }

  /**
   * メッセージタイムアウトを記録
   */
  recordMessageTimeout(): void {
    this.messageStats.sent++;
    this.messageStats.timedOut++;
    this.messageStats.lastFailure = Date.now();
    this.updateMetrics();
  }

  /**
   * 品質スコアを計算
   */
  calculateQualityScore(): number {
    const rttScore = this.calculateRTTScore();
    const successRateScore = this.calculateSuccessRateScore();
    const uptimeScore = this.calculateUptimeScore();

    const weightedScore = 
      (rttScore * this.config.qualityWeights.rtt) +
      (successRateScore * this.config.qualityWeights.successRate) +
      (uptimeScore * this.config.qualityWeights.uptime);

    return Math.round(Math.max(0, Math.min(100, weightedScore)));
  }

  /**
   * 品質レポートを取得
   */
  getQualityReport(): QualityReport {
    const baseMetrics = this.getQualityMetrics();
    
    return {
      ...baseMetrics,
      rttDetails: {
        min: Math.min(...this.rttHistory) || 0,
        max: Math.max(...this.rttHistory) || 0,
        average: this.calculateAverageRTT(),
        recent: [...this.rttHistory].slice(-10), // 最新10件
      },
      connectionDetails: {
        startTime: this.connectionStartTime,
        totalUptime: this.calculateTotalUptime(),
        disconnectionCount: this.disconnectionCount,
        lastDisconnection: this.lastDisconnection || undefined,
      },
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * 品質メトリクスを取得
   */
  getQualityMetrics(): QualityMetrics {
    return { ...this.metrics };
  }

  /**
   * メッセージ統計を取得
   */
  getMessageStats(): MessageStats {
    return { ...this.messageStats };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<QualityConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateMetrics();
  }

  /**
   * 統計をリセット
   */
  resetStats(): void {
    this.rttHistory = [];
    this.messageStats = {
      sent: 0,
      received: 0,
      failed: 0,
      timedOut: 0,
      lastSuccess: 0,
      lastFailure: 0,
    };
    this.connectionStartTime = Date.now();
    this.totalDowntime = 0;
    this.disconnectionCount = 0;
    this.lastDisconnection = null;
    this.updateMetrics();
  }

  /**
   * イベントハンドラーを追加
   */
  on(event: QualityEventType, handler: QualityEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * イベントハンドラーを削除
   */
  off(event: QualityEventType, handler: QualityEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  private updateMetrics(): void {
    const previousScore = this.metrics.qualityScore;
    const previousLevel = this.metrics.qualityLevel;

    this.metrics.averageRTT = this.calculateAverageRTT();
    this.metrics.connectionUptime = this.calculateTotalUptime();
    this.metrics.messageSuccessRate = this.calculateSuccessRate();
    this.metrics.qualityScore = this.calculateQualityScore();
    this.metrics.qualityLevel = this.determineQualityLevel();
    this.metrics.lastUpdate = new Date();
    this.metrics.totalMessages = this.messageStats.sent;
    this.metrics.successfulMessages = this.messageStats.received;
    this.metrics.failedMessages = this.messageStats.failed + this.messageStats.timedOut;
    this.metrics.uptimePercentage = this.calculateUptimePercentage();

    // イベント発行
    this.emit("quality_updated", this.metrics);

    // 品質変化の検出
    if (this.metrics.qualityScore > previousScore) {
      this.emit("quality_improved", {
        from: previousScore,
        to: this.metrics.qualityScore,
        level: this.metrics.qualityLevel,
      });
    } else if (this.metrics.qualityScore < previousScore) {
      this.emit("quality_degraded", {
        from: previousScore,
        to: this.metrics.qualityScore,
        level: this.metrics.qualityLevel,
      });
    }

    // レベル変化の検出
    if (this.metrics.qualityLevel !== previousLevel) {
      this.emit("threshold_crossed", {
        fromLevel: previousLevel,
        toLevel: this.metrics.qualityLevel,
        score: this.metrics.qualityScore,
      });
    }
  }

  private calculateAverageRTT(): number {
    if (this.rttHistory.length === 0) return 0;
    const sum = this.rttHistory.reduce((acc, rtt) => acc + rtt, 0);
    return Math.round(sum / this.rttHistory.length);
  }

  private calculateSuccessRate(): number {
    if (this.messageStats.sent === 0) return 100;
    return Math.round((this.messageStats.received / this.messageStats.sent) * 100);
  }

  private calculateTotalUptime(): number {
    if (this.connectionStartTime === 0) return 0;
    
    const currentUptime = this.isConnected 
      ? Date.now() - this.connectionStartTime
      : 0;
    
    return currentUptime;
  }

  private calculateUptimePercentage(): number {
    const totalTime = this.calculateTotalUptime() + this.totalDowntime;
    if (totalTime === 0) return 100;
    
    return Math.round((this.calculateTotalUptime() / totalTime) * 100);
  }

  private calculateRTTScore(): number {
    const avgRTT = this.calculateAverageRTT();
    if (avgRTT === 0) return 100;
    
    if (avgRTT <= this.config.rttThresholds.good) {
      return 100;
    } else if (avgRTT <= this.config.rttThresholds.normal) {
      // 線形スケール: good threshold で 100点、normal threshold で 60点
      const range = this.config.rttThresholds.normal - this.config.rttThresholds.good;
      const position = avgRTT - this.config.rttThresholds.good;
      return Math.round(100 - (position / range) * 40);
    } else {
      // normal threshold を超えた場合は更に減点
      const excess = avgRTT - this.config.rttThresholds.normal;
      return Math.max(0, Math.round(60 - (excess / 100) * 20));
    }
  }

  private calculateSuccessRateScore(): number {
    const successRate = this.calculateSuccessRate();
    
    if (successRate >= this.config.successRateThresholds.good) {
      return 100;
    } else if (successRate >= this.config.successRateThresholds.normal) {
      // 線形スケール
      const range = this.config.successRateThresholds.good - this.config.successRateThresholds.normal;
      const position = successRate - this.config.successRateThresholds.normal;
      return Math.round(60 + (position / range) * 40);
    } else {
      // normal threshold を下回った場合
      return Math.max(0, Math.round(successRate * 0.6));
    }
  }

  private calculateUptimeScore(): number {
    const uptimePercentage = this.calculateUptimePercentage();
    return Math.round(uptimePercentage);
  }

  private determineQualityLevel(): 'good' | 'normal' | 'poor' {
    const score = this.metrics.qualityScore;
    
    if (score >= 80) return 'good';
    if (score >= 60) return 'normal';
    return 'poor';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgRTT = this.calculateAverageRTT();
    const successRate = this.calculateSuccessRate();
    const uptimePercentage = this.calculateUptimePercentage();

    if (avgRTT > this.config.rttThresholds.normal) {
      recommendations.push('ネットワーク遅延が高いです。インターネット接続を確認してください。');
    }

    if (successRate < this.config.successRateThresholds.normal) {
      recommendations.push('メッセージ成功率が低いです。接続の安定性を確認してください。');
    }

    if (uptimePercentage < 95) {
      recommendations.push('接続の稼働率が低いです。自動再接続設定を確認してください。');
    }

    if (this.disconnectionCount > 5) {
      recommendations.push('頻繁な切断が発生しています。ネットワーク設定を見直してください。');
    }

    if (recommendations.length === 0) {
      recommendations.push('接続品質は良好です。');
    }

    return recommendations;
  }

  private emit(event: QualityEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        console.error(`Error in quality event handler for ${event}:`, error);
      }
    });
  }
}
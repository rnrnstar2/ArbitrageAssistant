export interface HeartbeatConfig {
  interval: number;          // ハートビート間隔（ms）
  timeout: number;          // 応答タイムアウト（ms）
  maxMissedHeartbeats: number; // 最大欠落回数
  rttHistorySize: number;   // RTT履歴保持数
}

export interface HeartbeatData {
  timestamp: number;
  sequence: number;
  rtt?: number;
}

export interface HeartbeatStats {
  lastSent: number;
  lastReceived: number;
  missedCount: number;
  averageRTT: number;
  minRTT: number;
  maxRTT: number;
  isHealthy: boolean;
  connectionUptime: number;
}

export type HeartbeatEventType = 
  | "heartbeat_sent"
  | "heartbeat_received"
  | "heartbeat_timeout"
  | "connection_unhealthy"
  | "rtt_updated";

export interface HeartbeatEventHandler {
  (event: HeartbeatEventType, data?: any): void;
}

export class HeartbeatManager {
  private config: HeartbeatConfig;
  private eventHandlers: Map<HeartbeatEventType, HeartbeatEventHandler[]> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  
  private sequence = 0;
  private pendingHeartbeats = new Map<number, number>(); // sequence -> timestamp
  private rttHistory: number[] = [];
  private missedCount = 0;
  private lastSent = 0;
  private lastReceived = 0;
  private connectionStartTime = 0;
  private isRunning = false;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = {
      interval: 30000,      // 30秒
      timeout: 10000,       // 10秒
      maxMissedHeartbeats: 3,
      rttHistorySize: 50,
      ...config,
    };

    // Initialize event handler maps
    [
      "heartbeat_sent",
      "heartbeat_received", 
      "heartbeat_timeout",
      "connection_unhealthy",
      "rtt_updated"
    ].forEach(event => {
      this.eventHandlers.set(event as HeartbeatEventType, []);
    });
  }

  /**
   * ハートビート開始
   */
  startHeartbeat(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.connectionStartTime = Date.now();
    this.resetStats();
    
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.interval);

    console.log(`HeartbeatManager started with interval: ${this.config.interval}ms`);
  }

  /**
   * ハートビート停止
   */
  stopHeartbeat(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.pendingHeartbeats.clear();
    console.log("HeartbeatManager stopped");
  }

  /**
   * ハートビート受信処理
   */
  onHeartbeatReceived(data: HeartbeatData): void {
    const now = Date.now();
    this.lastReceived = now;

    if (data.sequence && this.pendingHeartbeats.has(data.sequence)) {
      const sentTime = this.pendingHeartbeats.get(data.sequence)!;
      const rtt = now - sentTime;
      
      this.updateRTT(rtt);
      this.pendingHeartbeats.delete(data.sequence);
      
      // タイムアウトをクリア
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // 欠落カウントをリセット
      this.missedCount = 0;

      this.emit("heartbeat_received", { ...data, rtt });
      this.emit("rtt_updated", { rtt, average: this.calculateAverageRTT() });
    }
  }

  /**
   * RTT測定値を取得
   */
  calculateRTT(): number {
    return this.calculateAverageRTT();
  }

  /**
   * 接続が健全かどうかを判定
   */
  isConnectionHealthy(): boolean {
    const healthyConditions = [
      this.missedCount <= this.config.maxMissedHeartbeats,
      this.lastReceived > 0, // 少なくとも一度は受信している
      Date.now() - this.lastReceived < this.config.interval * 2, // 最後の受信から適切な時間内
    ];

    return healthyConditions.every(condition => condition);
  }

  /**
   * ハートビート統計情報を取得
   */
  getStats(): HeartbeatStats {
    return {
      lastSent: this.lastSent,
      lastReceived: this.lastReceived,
      missedCount: this.missedCount,
      averageRTT: this.calculateAverageRTT(),
      minRTT: Math.min(...this.rttHistory) || 0,
      maxRTT: Math.max(...this.rttHistory) || 0,
      isHealthy: this.isConnectionHealthy(),
      connectionUptime: this.connectionStartTime > 0 ? Date.now() - this.connectionStartTime : 0,
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 実行中の場合は再起動
    if (this.isRunning) {
      this.stopHeartbeat();
      this.startHeartbeat();
    }
  }

  /**
   * イベントハンドラーを追加
   */
  on(event: HeartbeatEventType, handler: HeartbeatEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * イベントハンドラーを削除
   */
  off(event: HeartbeatEventType, handler: HeartbeatEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  /**
   * ハートビート送信（外部から呼び出し可能）
   */
  sendHeartbeat(): HeartbeatData {
    const now = Date.now();
    this.sequence++;
    this.lastSent = now;

    // 前回のハートビートがまだ応答待ちの場合、欠落としてカウント
    if (this.timeoutId) {
      this.handleHeartbeatTimeout();
    }

    // 新しいハートビートを送信待ちに登録
    this.pendingHeartbeats.set(this.sequence, now);

    // タイムアウト設定
    this.timeoutId = setTimeout(() => {
      this.handleHeartbeatTimeout();
    }, this.config.timeout);

    const heartbeatData: HeartbeatData = {
      timestamp: now,
      sequence: this.sequence,
    };

    this.emit("heartbeat_sent", heartbeatData);
    return heartbeatData;
  }

  private updateRTT(rtt: number): void {
    this.rttHistory.push(rtt);
    
    // 履歴サイズを制限
    if (this.rttHistory.length > this.config.rttHistorySize) {
      this.rttHistory.shift();
    }
  }

  private calculateAverageRTT(): number {
    if (this.rttHistory.length === 0) {
      return 0;
    }

    const sum = this.rttHistory.reduce((acc, rtt) => acc + rtt, 0);
    return Math.round(sum / this.rttHistory.length);
  }

  private handleHeartbeatTimeout(): void {
    this.missedCount++;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // 古い応答待ちハートビートをクリーンアップ
    const cutoffTime = Date.now() - this.config.timeout;
    for (const [seq, timestamp] of this.pendingHeartbeats.entries()) {
      if (timestamp < cutoffTime) {
        this.pendingHeartbeats.delete(seq);
      }
    }

    this.emit("heartbeat_timeout", { 
      missedCount: this.missedCount,
      maxMissed: this.config.maxMissedHeartbeats 
    });

    // 最大欠落回数に達した場合
    if (this.missedCount >= this.config.maxMissedHeartbeats) {
      this.emit("connection_unhealthy", {
        missedCount: this.missedCount,
        lastReceived: this.lastReceived,
        lastSent: this.lastSent,
      });
    }
  }

  private resetStats(): void {
    this.sequence = 0;
    this.pendingHeartbeats.clear();
    this.rttHistory = [];
    this.missedCount = 0;
    this.lastSent = 0;
    this.lastReceived = 0;
  }

  private emit(event: HeartbeatEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        console.error(`Error in heartbeat event handler for ${event}:`, error);
      }
    });
  }
}
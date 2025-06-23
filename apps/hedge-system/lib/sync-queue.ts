import { SyncEvent } from './sync-manager.js';

export interface QueuedEvent extends SyncEvent {
  retryCount: number;
  lastAttempt?: Date;
  error?: Error;
  priority: number;
  maxRetries?: number;
  backoffMultiplier?: number;
}

export interface QueueStats {
  pending: number;
  completed: number;
  failed: number;
  retrying: number;
  totalProcessed: number;
}

export class SyncQueue {
  private queue: QueuedEvent[] = [];
  private completed: Set<string> = new Set();
  private failed: Map<string, Error> = new Map();
  private processing: Set<string> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  private stats: QueueStats = {
    pending: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    totalProcessed: 0
  };
  
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_BACKOFF_MULTIPLIER = 2;
  private readonly MAX_QUEUE_SIZE = 10000;
  
  enqueue(event: SyncEvent, priority: number = 0, options?: {
    maxRetries?: number;
    backoffMultiplier?: number;
  }): void {
    // キューサイズの制限チェック
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn('Sync queue is full, removing oldest events');
      this.queue = this.queue.slice(-Math.floor(this.MAX_QUEUE_SIZE * 0.8));
    }
    
    // 重複チェック
    const existingIndex = this.queue.findIndex(qEvent => qEvent.syncId === event.syncId);
    if (existingIndex !== -1) {
      // 既存のイベントの優先度を更新
      this.queue[existingIndex].priority = Math.max(this.queue[existingIndex].priority, priority);
      this.sortQueue();
      return;
    }
    
    const queuedEvent: QueuedEvent = {
      ...event,
      retryCount: 0,
      priority,
      maxRetries: options?.maxRetries || this.DEFAULT_MAX_RETRIES,
      backoffMultiplier: options?.backoffMultiplier || this.DEFAULT_BACKOFF_MULTIPLIER
    };
    
    this.queue.push(queuedEvent);
    this.sortQueue();
    this.updateStats();
  }
  
  dequeue(count: number = 1): QueuedEvent[] {
    if (this.queue.length === 0) {
      return [];
    }
    
    // 処理可能なイベントのみを取得（再試行中でないもの）
    const availableEvents = this.queue.filter(event => 
      !this.processing.has(event.syncId) && 
      !this.retryTimeouts.has(event.syncId)
    );
    
    const dequeueCount = Math.min(count, availableEvents.length);
    const dequeuedEvents = availableEvents.slice(0, dequeueCount);
    
    // 処理中として マーク
    dequeuedEvents.forEach(event => {
      this.processing.add(event.syncId);
    });
    
    return dequeuedEvents;
  }
  
  markAsCompleted(syncId: string): void {
    this.completed.add(syncId);
    this.failed.delete(syncId);
    this.processing.delete(syncId);
    
    // キューから削除
    this.queue = this.queue.filter(event => event.syncId !== syncId);
    
    // 再試行タイマーをクリア
    const timeout = this.retryTimeouts.get(syncId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(syncId);
    }
    
    this.stats.completed++;
    this.stats.totalProcessed++;
    this.updateStats();
  }
  
  markAsError(syncId: string, error: Error): void {
    this.processing.delete(syncId);
    
    const eventIndex = this.queue.findIndex(event => event.syncId === syncId);
    if (eventIndex === -1) {
      return;
    }
    
    const event = this.queue[eventIndex];
    event.retryCount++;
    event.lastAttempt = new Date();
    event.error = error;
    
    const maxRetries = event.maxRetries || this.DEFAULT_MAX_RETRIES;
    
    if (event.retryCount >= maxRetries) {
      // 最大リトライ回数に達した場合
      this.failed.set(syncId, error);
      this.queue.splice(eventIndex, 1);
      this.stats.failed++;
      this.stats.totalProcessed++;
    } else {
      // 再試行をスケジュール
      this.scheduleRetry(event);
    }
    
    this.updateStats();
  }
  
  private scheduleRetry(event: QueuedEvent): void {
    const backoffMultiplier = event.backoffMultiplier || this.DEFAULT_BACKOFF_MULTIPLIER;
    const baseDelay = 1000; // 1秒
    const delay = baseDelay * Math.pow(backoffMultiplier, event.retryCount);
    const maxDelay = 30000; // 最大30秒
    const actualDelay = Math.min(delay, maxDelay);
    
    // ジッターを追加（25%の随機性）
    const jitter = actualDelay * 0.25 * Math.random();
    const finalDelay = actualDelay + jitter;
    
    console.log(`Scheduling retry for ${event.syncId} in ${Math.round(finalDelay)}ms (attempt ${event.retryCount})`);
    
    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(event.syncId);
      // 再試行時は低優先度で再キューイング
      event.priority = Math.max(0, event.priority - 10);
      this.sortQueue();
    }, finalDelay);
    
    this.retryTimeouts.set(event.syncId, timeout);
  }
  
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // 優先度で基本ソート（高い方が先）
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // 優先度が同じ場合はタイムスタンプで ソート（古い方が先）
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }
  
  private updateStats(): void {
    this.stats.pending = this.queue.length - this.processing.size;
    this.stats.retrying = this.retryTimeouts.size;
  }
  
  // ユーティリティメソッド
  getPendingCount(): number {
    return this.queue.length;
  }
  
  getFailedCount(): number {
    return this.failed.size;
  }
  
  getProcessingCount(): number {
    return this.processing.size;
  }
  
  getRetryingCount(): number {
    return this.retryTimeouts.size;
  }
  
  getCompletedCount(): number {
    return this.completed.size;
  }
  
  getStats(): QueueStats {
    this.updateStats();
    return { ...this.stats };
  }
  
  // 詳細情報の取得
  getPendingEvents(): QueuedEvent[] {
    return [...this.queue];
  }
  
  getFailedEvents(): Array<{ syncId: string; error: Error }> {
    return Array.from(this.failed.entries()).map(([syncId, error]) => ({
      syncId,
      error
    }));
  }
  
  getEventByEntity(entity: SyncEvent['entity']): QueuedEvent[] {
    return this.queue.filter(event => event.entity === entity);
  }
  
  getEventsByPriority(minPriority: number): QueuedEvent[] {
    return this.queue.filter(event => event.priority >= minPriority);
  }
  
  getOldestEvent(): QueuedEvent | null {
    if (this.queue.length === 0) {
      return null;
    }
    
    return this.queue.reduce((oldest, current) => 
      current.timestamp < oldest.timestamp ? current : oldest
    );
  }
  
  getNewestEvent(): QueuedEvent | null {
    if (this.queue.length === 0) {
      return null;
    }
    
    return this.queue.reduce((newest, current) => 
      current.timestamp > newest.timestamp ? current : newest
    );
  }
  
  // キューの管理
  clear(): void {
    // 全ての再試行タイマーをクリア
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    
    this.queue = [];
    this.completed.clear();
    this.failed.clear();
    this.processing.clear();
    this.retryTimeouts.clear();
    
    this.stats = {
      pending: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      totalProcessed: 0
    };
  }
  
  clearCompleted(): void {
    this.completed.clear();
    this.stats.completed = 0;
  }
  
  clearFailed(): void {
    this.failed.clear();
    this.stats.failed = 0;
  }
  
  removeEvent(syncId: string): boolean {
    const eventIndex = this.queue.findIndex(event => event.syncId === syncId);
    if (eventIndex !== -1) {
      this.queue.splice(eventIndex, 1);
      this.processing.delete(syncId);
      
      // 再試行タイマーもクリア
      const timeout = this.retryTimeouts.get(syncId);
      if (timeout) {
        clearTimeout(timeout);
        this.retryTimeouts.delete(syncId);
      }
      
      this.updateStats();
      return true;
    }
    return false;
  }
  
  // 優先度の調整
  updateEventPriority(syncId: string, newPriority: number): boolean {
    const event = this.queue.find(event => event.syncId === syncId);
    if (event) {
      event.priority = newPriority;
      this.sortQueue();
      return true;
    }
    return false;
  }
  
  boostPriority(entity: SyncEvent['entity'], boost: number = 10): void {
    this.queue.forEach(event => {
      if (event.entity === entity) {
        event.priority += boost;
      }
    });
    this.sortQueue();
  }
  
  // パフォーマンス最適化
  compact(): void {
    // 完了したイベントの履歴を制限
    if (this.completed.size > 1000) {
      const completedArray = Array.from(this.completed);
      this.completed = new Set(completedArray.slice(-500));
    }
    
    // 失敗したイベントの履歴を制限
    if (this.failed.size > 100) {
      const failedArray = Array.from(this.failed.entries());
      this.failed = new Map(failedArray.slice(-50));
    }
  }
  
  // ヘルスチェック
  isHealthy(): boolean {
    const stats = this.getStats();
    
    // 失敗率が50%を超えている場合は不健全
    if (stats.totalProcessed > 10 && stats.failed / stats.totalProcessed > 0.5) {
      return false;
    }
    
    // 再試行中のイベントが多すぎる場合
    if (stats.retrying > 100) {
      return false;
    }
    
    // 古すぎるイベントがある場合
    const oldestEvent = this.getOldestEvent();
    if (oldestEvent && Date.now() - oldestEvent.timestamp.getTime() > 300000) { // 5分
      return false;
    }
    
    return true;
  }
  
  getHealthReport(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const stats = this.getStats();
    
    // 失敗率チェック
    const failureRate = stats.totalProcessed > 0 ? stats.failed / stats.totalProcessed : 0;
    if (failureRate > 0.5) {
      issues.push(`High failure rate: ${Math.round(failureRate * 100)}%`);
      recommendations.push('Check network connectivity and AWS Amplify configuration');
    }
    
    // キューサイズチェック
    if (stats.pending > 1000) {
      issues.push(`Large queue size: ${stats.pending} pending events`);
      recommendations.push('Consider increasing processing frequency or batch size');
    }
    
    // 再試行チェック
    if (stats.retrying > 50) {
      issues.push(`Many retrying events: ${stats.retrying}`);
      recommendations.push('Check for persistent connection issues');
    }
    
    // 古いイベントチェック
    const oldestEvent = this.getOldestEvent();
    if (oldestEvent) {
      const age = Date.now() - oldestEvent.timestamp.getTime();
      if (age > 300000) { // 5分
        issues.push(`Old events in queue: oldest is ${Math.round(age / 1000)}s old`);
        recommendations.push('Check for processing bottlenecks');
      }
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }
}
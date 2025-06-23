export interface ProcessingInfo {
  startTime: Date;
  status: 'processing' | 'completed' | 'failed';
  retryCount?: number;
}

export class ActionConsistencyManager {
  private processingActions: Map<string, ProcessingInfo> = new Map();
  private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5分
  
  /**
   * 重複実行防止（排他制御）
   */
  async acquireActionLock(actionId: string): Promise<boolean> {
    if (this.processingActions.has(actionId)) {
      const info = this.processingActions.get(actionId)!;
      console.log(`🔒 Action ${actionId} is already being processed since ${info.startTime.toISOString()}`);
      return false; // 既に処理中
    }
    
    this.processingActions.set(actionId, {
      startTime: new Date(),
      status: 'processing'
    });
    
    console.log(`🔐 Acquired lock for action: ${actionId}`);
    return true;
  }
  
  /**
   * ロック解除
   */
  releaseActionLock(actionId: string): void {
    const info = this.processingActions.get(actionId);
    if (info) {
      info.status = 'completed';
      this.processingActions.delete(actionId);
      console.log(`🔓 Released lock for action: ${actionId}`);
    }
  }
  
  /**
   * 失敗としてロック解除
   */
  releaseActionLockWithFailure(actionId: string): void {
    const info = this.processingActions.get(actionId);
    if (info) {
      info.status = 'failed';
      this.processingActions.delete(actionId);
      console.log(`❌ Released lock with failure for action: ${actionId}`);
    }
  }
  
  /**
   * タイムアウト処理（stale action cleanup）
   */
  async cleanupStaleActions(): Promise<void> {
    const now = new Date();
    const stalledActions: string[] = [];
    
    for (const [actionId, info] of this.processingActions) {
      const elapsed = now.getTime() - info.startTime.getTime();
      
      if (elapsed > this.DEFAULT_TIMEOUT) {
        stalledActions.push(actionId);
        console.warn(`⚠️ Stale action detected: ${actionId} (${Math.round(elapsed / 1000)}s elapsed)`);
      }
    }
    
    // stale actionsを削除
    for (const actionId of stalledActions) {
      this.processingActions.delete(actionId);
      console.warn(`🧹 Cleaned up stale action: ${actionId}`);
    }
    
    if (stalledActions.length > 0) {
      console.log(`🧹 Cleaned up ${stalledActions.length} stale actions`);
    }
  }
  
  /**
   * 処理中のAction一覧取得
   */
  getProcessingActions(): Map<string, ProcessingInfo> {
    return new Map(this.processingActions);
  }
  
  /**
   * 特定のActionの処理状況確認
   */
  isActionBeingProcessed(actionId: string): boolean {
    return this.processingActions.has(actionId);
  }
  
  /**
   * 統計情報取得
   */
  getStats() {
    const now = new Date();
    const processingList = Array.from(this.processingActions.values());
    
    return {
      totalProcessing: this.processingActions.size,
      oldestProcessingTime: processingList.length > 0 
        ? Math.min(...processingList.map(info => now.getTime() - info.startTime.getTime()))
        : 0,
      averageProcessingTime: processingList.length > 0
        ? processingList.reduce((sum, info) => sum + (now.getTime() - info.startTime.getTime()), 0) / processingList.length
        : 0
    };
  }
  
  /**
   * 強制的に全ロック解除（緊急時用）
   */
  forceReleaseAllLocks(): void {
    const count = this.processingActions.size;
    this.processingActions.clear();
    console.warn(`🚨 Force released all locks (${count} actions affected)`);
  }
  
  /**
   * タイムアウト時間設定
   */
  setTimeoutMs(timeoutMs: number): void {
    console.log(`⏱️ Action timeout set to ${timeoutMs}ms`);
  }
}
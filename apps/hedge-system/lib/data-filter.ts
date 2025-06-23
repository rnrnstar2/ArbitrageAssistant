import { Position, Strategy, Action } from '@repo/shared-types';

interface FilterOptions {
  enableTimestamping?: boolean;
  enableSensitiveDataFilter?: boolean;
  enableRateLimiting?: boolean;
  enableDataCompression?: boolean;
}

interface SyncThresholds {
  position: number;
  price: number;
  balance: number;
  strategy: number;
  action: number;
  [key: string]: number;
}

export class DataFilter {
  private lastSyncTime: Map<string, Date> = new Map();
  private syncThresholds: SyncThresholds;
  private options: FilterOptions;
  private requestCounts: Map<string, number> = new Map();
  private rateLimitWindowMs: number = 60000; // 1分間のウィンドウ
  
  constructor(
    options: FilterOptions = {},
    customThresholds?: Partial<SyncThresholds>
  ) {
    this.options = {
      enableTimestamping: true,
      enableSensitiveDataFilter: true,
      enableRateLimiting: true,
      enableDataCompression: false,
      ...options
    };
    
    this.syncThresholds = {
      position: 1000,   // 1秒間隔
      price: 500,       // 500ms間隔
      balance: 5000,    // 5秒間隔
      strategy: 2000,   // 2秒間隔
      action: 1000,     // 1秒間隔
      ...customThresholds
    };
  }
  
  // 同期タイミング制御
  shouldSyncPosition(positionId: string): boolean {
    return this.shouldSync('position', positionId);
  }
  
  shouldSyncPrice(symbol: string): boolean {
    return this.shouldSync('price', symbol);
  }
  
  shouldSyncBalance(accountId: string): boolean {
    return this.shouldSync('balance', accountId);
  }
  
  shouldSyncStrategy(strategyId: string): boolean {
    return this.shouldSync('strategy', strategyId);
  }
  
  shouldSyncAction(actionId: string): boolean {
    return this.shouldSync('action', actionId);
  }
  
  private shouldSync(type: string, key: string): boolean {
    const cacheKey = `${type}:${key}`;
    const lastSync = this.lastSyncTime.get(cacheKey);
    const threshold = this.syncThresholds[type] || 1000;
    
    if (!lastSync || Date.now() - lastSync.getTime() > threshold) {
      this.lastSyncTime.set(cacheKey, new Date());
      return true;
    }
    
    return false;
  }
  
  // レート制限
  checkRateLimit(operationType: string, limit: number = 60): boolean {
    if (!this.options.enableRateLimiting) {
      return true;
    }
    
    const currentTime = Date.now();
    const windowStart = currentTime - this.rateLimitWindowMs;
    
    // 古いエントリをクリーンアップ
    this.cleanupOldRequests(windowStart);
    
    const requestKey = `${operationType}:${Math.floor(currentTime / this.rateLimitWindowMs)}`;
    const currentCount = this.requestCounts.get(requestKey) || 0;
    
    if (currentCount >= limit) {
      console.warn(`Rate limit exceeded for ${operationType}: ${currentCount}/${limit}`);
      return false;
    }
    
    this.requestCounts.set(requestKey, currentCount + 1);
    return true;
  }
  
  private cleanupOldRequests(windowStart: number): void {
    const keysToDelete: string[] = [];
    
    this.requestCounts.forEach((value, key) => {
      const [, timestampStr] = key.split(':');
      const timestamp = parseInt(timestampStr) * this.rateLimitWindowMs;
      
      if (timestamp < windowStart) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.requestCounts.delete(key));
  }
  
  // データフィルタリング
  filterSensitiveData<T extends Record<string, any>>(data: T): T {
    if (!this.options.enableSensitiveDataFilter) {
      return data;
    }
    
    const filtered = { ...data };
    
    // 機密データフィールドを削除
    const sensitiveFields = [
      'internalCalculations',
      'temporaryData',
      'debugInfo',
      'privateNotes',
      'internalId',
      'serverTimestamp',
      'processingMetadata'
    ];
    
    sensitiveFields.forEach(field => {
      if (field in filtered) {
        delete filtered[field];
      }
    });
    
    return filtered;
  }
  
  filterPositionData(position: Position): Position {
    const filtered = this.filterSensitiveData(position);
    
    // ポジション特有のフィルタリング
    return {
      ...filtered,
      // 必要に応じて追加のフィルタリングロジック
    };
  }
  
  filterStrategyData(strategy: Strategy): Strategy {
    const filtered = this.filterSensitiveData(strategy);
    
    // 戦略特有のフィルタリング
    return {
      ...filtered,
      // 戦略固有の機密情報がある場合の処理
    };
  }
  
  filterActionData(action: Action): Action {
    const filtered = this.filterSensitiveData(action);
    
    // アクション固有のフィルタリング
    return {
      ...filtered,
      // パラメータ内の機密情報をフィルタ
      // parameters: this.filterActionParams(action.parameters) // TODO: Fix Action type parameters field
    };
  }
  
  private filterActionParams(params: Record<string, any>): Record<string, any> {
    const filtered = { ...params };
    
    // アクションパラメータから機密情報を除去
    const sensitiveParamKeys = [
      'apiKey',
      'secretKey',
      'token',
      'password',
      'internalData'
    ];
    
    sensitiveParamKeys.forEach(key => {
      if (key in filtered) {
        delete filtered[key];
      }
    });
    
    return filtered;
  }
  
  // データ圧縮・最適化
  compressData(data: any): any {
    if (!this.options.enableDataCompression) {
      return data;
    }
    
    // 簡単な圧縮ロジック：不要なnullやundefinedを除去
    return this.removeNullValues(data);
  }
  
  private removeNullValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    
    if (typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeNullValues(item)).filter(item => item !== undefined);
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanValue = this.removeNullValues(value);
      if (cleanValue !== undefined) {
        result[key] = cleanValue;
      }
    }
    
    return result;
  }
  
  // バッチ処理用のデータフィルタリング
  filterPositionBatch(positions: Position[]): Position[] {
    return positions.map(position => this.filterPositionData(position));
  }
  
  filterStrategyBatch(strategies: Strategy[]): Strategy[] {
    return strategies.map(strategy => this.filterStrategyData(strategy));
  }
  
  filterActionBatch(actions: Action[]): Action[] {
    return actions.map(action => this.filterActionData(action));
  }
  
  // 統計情報
  getFilterStats(): {
    totalSyncChecks: number;
    rateLimitHits: number;
    activeThresholds: SyncThresholds;
    cacheSize: number;
  } {
    return {
      totalSyncChecks: this.lastSyncTime.size,
      rateLimitHits: Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0),
      activeThresholds: { ...this.syncThresholds },
      cacheSize: this.lastSyncTime.size
    };
  }
  
  // 設定管理
  updateSyncThreshold(type: string, thresholdMs: number): void {
    this.syncThresholds[type] = thresholdMs;
    console.log(`Updated sync threshold for ${type}: ${thresholdMs}ms`);
  }
  
  updateRateLimitWindow(windowMs: number): void {
    this.rateLimitWindowMs = windowMs;
    console.log(`Updated rate limit window: ${windowMs}ms`);
  }
  
  // キャッシュ管理
  clearSyncCache(): void {
    this.lastSyncTime.clear();
    console.log('Sync cache cleared');
  }
  
  clearRateLimitCache(): void {
    this.requestCounts.clear();
    console.log('Rate limit cache cleared');
  }
  
  // 設定の有効化/無効化
  enableFilter(filterType: keyof FilterOptions): void {
    this.options[filterType] = true;
    console.log(`Enabled filter: ${filterType}`);
  }
  
  disableFilter(filterType: keyof FilterOptions): void {
    this.options[filterType] = false;
    console.log(`Disabled filter: ${filterType}`);
  }
  
  // デバッグ用
  debugInfo(): any {
    return {
      options: this.options,
      syncThresholds: this.syncThresholds,
      rateLimitWindowMs: this.rateLimitWindowMs,
      cacheStats: {
        syncCacheSize: this.lastSyncTime.size,
        rateLimitCacheSize: this.requestCounts.size
      }
    };
  }
  
  // クリーンアップ
  dispose(): void {
    this.clearSyncCache();
    this.clearRateLimitCache();
  }
}
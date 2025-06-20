import { EventEmitter } from 'events';

export interface PersistenceEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  checksum: string;
  compressed: boolean;
}

export interface HistoryEntry<T> {
  id: string;
  data: T;
  timestamp: number;
  version: string;
  type: string;
}

export interface PersistenceStats {
  totalEntries: number;
  memoryUsage: number;
  compressionRatio: number;
  lastBackup: number;
  historicalEntries: number;
}

export interface PersistenceConfig {
  enableCompression: boolean;
  compressionThreshold: number; // bytes
  maxHistoryEntries: number;
  historyRetentionDays: number;
  autoBackupInterval: number; // milliseconds
  enableVersioning: boolean;
  storagePrefix: string;
}

export interface DataChanges<T> {
  added: T[];
  updated: T[];
  removed: string[];
  timestamp: Date;
}

const DEFAULT_CONFIG: PersistenceConfig = {
  enableCompression: true,
  compressionThreshold: 1024, // 1KB
  maxHistoryEntries: 1000,
  historyRetentionDays: 30,
  autoBackupInterval: 5 * 60 * 1000, // 5分
  enableVersioning: true,
  storagePrefix: 'hedge-system-data',
};

export class DataPersistenceService<T = any> extends EventEmitter {
  private config: PersistenceConfig;
  private version: string = '1.0.0';
  private backupTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;
  private stats: PersistenceStats;

  constructor(config?: Partial<PersistenceConfig>) {
    super();
    
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.stats = {
      totalEntries: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      lastBackup: 0,
      historicalEntries: 0,
    };
  }

  /**
   * サービスの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 既存データの復元
      await this.restoreFromStorage();
      
      // 自動バックアップの開始
      this.startAutoBackup();
      
      // 古い履歴データの削除
      await this.cleanupOldHistory();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('DataPersistenceService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DataPersistenceService:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * データを永続化
   */
  async persistData(key: string, data: T, type: string = 'unknown'): Promise<boolean> {
    try {
      const entry = await this.createPersistenceEntry(data);
      const storageKey = this.getStorageKey(key);
      
      // ローカルストレージに保存
      const serialized = JSON.stringify(entry);
      localStorage.setItem(storageKey, serialized);
      
      // 履歴に追加
      await this.addToHistory(key, data, type);
      
      // 統計更新
      this.updateStats();
      
      this.emit('data_persisted', { key, type, size: serialized.length });
      return true;
      
    } catch (error) {
      console.error('Failed to persist data:', error);
      this.emit('persistence_error', { key, error });
      return false;
    }
  }

  /**
   * データを復元
   */
  async restoreData(key: string): Promise<T | null> {
    try {
      const storageKey = this.getStorageKey(key);
      const serialized = localStorage.getItem(storageKey);
      
      if (!serialized) {
        return null;
      }
      
      const entry: PersistenceEntry<T> = JSON.parse(serialized);
      
      // データの整合性チェック
      if (!await this.validateEntry(entry)) {
        console.warn('Data validation failed, removing corrupt entry:', key);
        localStorage.removeItem(storageKey);
        return null;
      }
      
      // データの展開
      const data = await this.extractDataFromEntry(entry);
      
      this.emit('data_restored', { key, timestamp: entry.timestamp });
      return data;
      
    } catch (error) {
      console.error('Failed to restore data:', error);
      this.emit('restoration_error', { key, error });
      return null;
    }
  }

  /**
   * 複数のデータを一括で永続化
   */
  async persistBatch(items: Array<{ key: string; data: T; type?: string }>): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const item of items) {
      const result = await this.persistData(item.key, item.data, item.type || 'batch');
      results.push(result);
    }
    
    this.emit('batch_persisted', { count: items.length, successful: results.filter(r => r).length });
    return results;
  }

  /**
   * 複数のデータを一括で復元
   */
  async restoreBatch(keys: string[]): Promise<Array<{ key: string; data: T | null }>> {
    const results: Array<{ key: string; data: T | null }> = [];
    
    for (const key of keys) {
      const data = await this.restoreData(key);
      results.push({ key, data });
    }
    
    return results;
  }

  /**
   * 変更セットの永続化
   */
  async persistChanges(key: string, changes: DataChanges<T>): Promise<boolean> {
    try {
      const changeKey = `${key}_changes_${Date.now()}`;
      return await this.persistData(changeKey, changes, 'changes');
    } catch (error) {
      console.error('Failed to persist changes:', error);
      return false;
    }
  }

  /**
   * 履歴データの取得
   */
  async getHistory(key: string, limit?: number): Promise<HistoryEntry<T>[]> {
    try {
      const historyKey = this.getHistoryKey(key);
      const serialized = localStorage.getItem(historyKey);
      
      if (!serialized) {
        return [];
      }
      
      const history: HistoryEntry<T>[] = JSON.parse(serialized);
      
      // 制限がある場合は最新のエントリのみ返す
      if (limit && history.length > limit) {
        return history.slice(-limit);
      }
      
      return history;
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  /**
   * データの削除
   */
  async deleteData(key: string): Promise<boolean> {
    try {
      const storageKey = this.getStorageKey(key);
      localStorage.removeItem(storageKey);
      
      this.emit('data_deleted', { key });
      return true;
    } catch (error) {
      console.error('Failed to delete data:', error);
      return false;
    }
  }

  /**
   * 全データのバックアップ
   */
  async createBackup(): Promise<string> {
    try {
      const backup: Record<string, any> = {};
      const prefix = this.config.storagePrefix;
      
      // 関連するすべてのキーを取得
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            backup[key] = JSON.parse(value);
          }
        }
      }
      
      // バックアップデータを圧縮
      const backupStr = JSON.stringify(backup);
      const compressed = this.config.enableCompression ? 
        btoa(backupStr) : backupStr;
      
      const backupData = {
        version: this.version,
        timestamp: Date.now(),
        compressed: this.config.enableCompression,
        data: compressed,
      };
      
      this.stats.lastBackup = Date.now();
      this.emit('backup_created', { size: backupStr.length });
      
      return JSON.stringify(backupData);
    } catch (error) {
      console.error('Failed to create backup:', error);
      this.emit('backup_error', error);
      throw error;
    }
  }

  /**
   * バックアップからの復元
   */
  async restoreFromBackup(backupStr: string): Promise<boolean> {
    try {
      const backupData = JSON.parse(backupStr);
      
      // バージョンチェック
      if (backupData.version !== this.version) {
        console.warn('Backup version mismatch, attempting migration...');
      }
      
      // データの展開
      let dataStr: string;
      if (backupData.compressed) {
        dataStr = atob(backupData.data);
      } else {
        dataStr = backupData.data;
      }
      
      const backup: Record<string, any> = JSON.parse(dataStr);
      
      // データの復元
      for (const [key, value] of Object.entries(backup)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      
      this.updateStats();
      this.emit('backup_restored', { timestamp: backupData.timestamp });
      
      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      this.emit('restore_error', error);
      return false;
    }
  }

  /**
   * 統計情報の取得
   */
  getStats(): PersistenceStats {
    return { ...this.stats };
  }

  /**
   * サービスの停止
   */
  dispose(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    
    this.removeAllListeners();
    this.isInitialized = false;
    
    this.emit('disposed');
  }

  // Private Methods

  private async createPersistenceEntry(data: T): Promise<PersistenceEntry<T>> {
    const dataStr = JSON.stringify(data);
    const shouldCompress = this.config.enableCompression && 
                          dataStr.length > this.config.compressionThreshold;
    
    let processedData: string;
    if (shouldCompress) {
      processedData = btoa(dataStr);
    } else {
      processedData = dataStr;
    }
    
    return {
      data: processedData as any,
      timestamp: Date.now(),
      version: this.version,
      checksum: this.calculateChecksum(dataStr),
      compressed: shouldCompress,
    };
  }

  private async extractDataFromEntry(entry: PersistenceEntry<T>): Promise<T> {
    let dataStr: string;
    
    if (entry.compressed) {
      dataStr = atob(entry.data as any);
    } else {
      dataStr = entry.data as any;
    }
    
    return JSON.parse(dataStr);
  }

  private async validateEntry(entry: PersistenceEntry<T>): Promise<boolean> {
    try {
      // バージョンチェック
      if (this.config.enableVersioning && entry.version !== this.version) {
        console.warn('Version mismatch:', entry.version, 'vs', this.version);
      }
      
      // データの展開とチェックサム検証
      const data = await this.extractDataFromEntry(entry);
      const dataStr = JSON.stringify(data);
      const calculatedChecksum = this.calculateChecksum(dataStr);
      
      return calculatedChecksum === entry.checksum;
    } catch (error) {
      console.error('Entry validation failed:', error);
      return false;
    }
  }

  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString(36);
  }

  private getStorageKey(key: string): string {
    return `${this.config.storagePrefix}:${key}`;
  }

  private getHistoryKey(key: string): string {
    return `${this.config.storagePrefix}:history:${key}`;
  }

  private async addToHistory(key: string, data: T, type: string): Promise<void> {
    try {
      const historyKey = this.getHistoryKey(key);
      const existing = await this.getHistory(key);
      
      const entry: HistoryEntry<T> = {
        id: `${key}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data,
        timestamp: Date.now(),
        version: this.version,
        type,
      };
      
      existing.push(entry);
      
      // 履歴サイズ制限
      if (existing.length > this.config.maxHistoryEntries) {
        existing.splice(0, existing.length - this.config.maxHistoryEntries);
      }
      
      localStorage.setItem(historyKey, JSON.stringify(existing));
      this.stats.historicalEntries = existing.length;
    } catch (error) {
      console.error('Failed to add to history:', error);
    }
  }

  private async cleanupOldHistory(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (this.config.historyRetentionDays * 24 * 60 * 60 * 1000);
      const prefix = `${this.config.storagePrefix}:history:`;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const serialized = localStorage.getItem(key);
          if (serialized) {
            const history: HistoryEntry<T>[] = JSON.parse(serialized);
            const filtered = history.filter(entry => entry.timestamp > cutoffTime);
            
            if (filtered.length !== history.length) {
              localStorage.setItem(key, JSON.stringify(filtered));
            }
          }
        }
      }
      
      this.emit('history_cleaned', { cutoffTime });
    } catch (error) {
      console.error('Failed to cleanup old history:', error);
    }
  }

  private async restoreFromStorage(): Promise<void> {
    // 基本的な接続性チェックのみ実装
    // 実際の復元処理は個別のrestoreData呼び出しで行う
    this.updateStats();
  }

  private updateStats(): void {
    let totalEntries = 0;
    let memoryUsage = 0;
    let compressedSize = 0;
    let uncompressedSize = 0;
    
    const prefix = this.config.storagePrefix;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalEntries++;
          memoryUsage += value.length * 2; // UTF-16
          
          try {
            const entry = JSON.parse(value);
            if (entry.compressed) {
              compressedSize += value.length;
              // 圧縮前のサイズは推定
              uncompressedSize += value.length * 3; // 推定値
            }
          } catch {
            // パース失敗は無視
          }
        }
      }
    }
    
    this.stats = {
      ...this.stats,
      totalEntries,
      memoryUsage,
      compressionRatio: uncompressedSize > 0 ? (compressedSize / uncompressedSize) : 0,
    };
  }

  private startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup();
        this.emit('auto_backup_completed');
      } catch (error) {
        this.emit('auto_backup_failed', error);
      }
    }, this.config.autoBackupInterval);
  }
}

// グローバルインスタンス
let globalPersistenceService: DataPersistenceService | null = null;

export function getPersistenceService(config?: Partial<PersistenceConfig>): DataPersistenceService {
  if (!globalPersistenceService) {
    globalPersistenceService = new DataPersistenceService(config);
  }
  return globalPersistenceService;
}

// 特定用途向けのPersistenceサービス

export class PositionPersistenceService extends DataPersistenceService {
  constructor() {
    super({
      storagePrefix: 'hedge-position-data',
      maxHistoryEntries: 500,
      historyRetentionDays: 7,
      enableCompression: true,
    });
  }

  async persistPosition(positionId: string, positionData: any): Promise<boolean> {
    return this.persistData(`position:${positionId}`, positionData, 'position');
  }

  async restorePosition(positionId: string): Promise<any> {
    return this.restoreData(`position:${positionId}`);
  }

  async persistAccountPositions(accountId: string, positions: any[]): Promise<boolean> {
    return this.persistData(`account_positions:${accountId}`, positions, 'account_positions');
  }

  async restoreAccountPositions(accountId: string): Promise<any[]> {
    const result = await this.restoreData(`account_positions:${accountId}`);
    return result || [];
  }
}

export class MarketDataPersistenceService extends DataPersistenceService {
  constructor() {
    super({
      storagePrefix: 'hedge-market-data',
      maxHistoryEntries: 2000,
      historyRetentionDays: 1,
      enableCompression: true,
      autoBackupInterval: 60 * 1000, // 1分
    });
  }

  async persistPriceData(symbol: string, priceData: any): Promise<boolean> {
    return this.persistData(`price:${symbol}`, priceData, 'price');
  }

  async restorePriceData(symbol: string): Promise<any> {
    return this.restoreData(`price:${symbol}`);
  }
}
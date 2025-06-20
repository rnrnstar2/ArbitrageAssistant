import { DataBuffer, DataType, DataItem } from './data-buffer';
import { SequenceManager, SequenceValidationResult, MissingDataRequest } from './sequence-manager';
import { SyncQualityMonitor, SyncResult, QualityReport, QualityAlert } from './sync-quality-monitor';
import { EAMessage, PositionUpdateData, AccountInfoData, MarketData, LosscutAlert, HeartbeatData } from './message-types';

export interface DataSynchronizer {
  syncPositionData(data: PositionUpdateData[], accountId: string): Promise<SyncResult>;
  syncAccountData(data: AccountInfoData[], accountId: string): Promise<SyncResult>;
  syncMarketData(data: MarketData[], accountId: string): Promise<SyncResult>;
  syncLosscutAlerts(data: LosscutAlert[], accountId: string): Promise<SyncResult>;
  syncHeartbeatData(data: HeartbeatData[], accountId: string): Promise<SyncResult>;
  checkSyncStatus(): Promise<SyncStatus>;
  resyncData(type: DataType, accountId: string, since?: Date): Promise<SyncResult>;
}

export interface SyncStatus {
  lastSyncTime: Date;
  totalSynced: number;
  pendingSync: number;
  syncLag: number; // milliseconds
  qualityScore: number; // 0-100
  byDataType: Map<DataType, {
    lastSyncTime: Date;
    totalSynced: number;
    pendingSync: number;
    syncLag: number;
    qualityScore: number;
  }>;
  byAccount: Map<string, {
    lastSyncTime: Date;
    totalSynced: number;
    pendingSync: number;
    syncLag: number;
    qualityScore: number;
  }>;
}

export interface DataSynchronizerConfig {
  bufferConfig?: Parameters<typeof DataBuffer.prototype.constructor>[0];
  sequenceConfig?: Parameters<typeof SequenceManager.prototype.constructor>[0];
  qualityConfig?: Parameters<typeof SyncQualityMonitor.prototype.constructor>[0];
  enableQualityMonitoring: boolean;
  enableSequenceValidation: boolean;
  batchSize: number;
  syncTimeoutMs: number;
}

export interface MissingDataHandler {
  (request: MissingDataRequest): Promise<EAMessage[]>;
}

export interface SyncEventHandlers {
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: Error, dataType: DataType, accountId: string) => void;
  onQualityAlert?: (alert: QualityAlert) => void;
  onMissingData?: (request: MissingDataRequest) => void;
}

export class DataSynchronizerImpl implements DataSynchronizer {
  private dataBuffer: DataBuffer;
  private sequenceManager: SequenceManager;
  private qualityMonitor: SyncQualityMonitor;
  private config: DataSynchronizerConfig;
  private missingDataHandler?: MissingDataHandler;
  private eventHandlers: SyncEventHandlers = {};
  private syncStats: Map<string, { lastSync: Date; totalSynced: number }> = new Map();

  constructor(config: Partial<DataSynchronizerConfig> = {}) {
    this.config = {
      enableQualityMonitoring: config.enableQualityMonitoring ?? true,
      enableSequenceValidation: config.enableSequenceValidation ?? true,
      batchSize: config.batchSize ?? 100,
      syncTimeoutMs: config.syncTimeoutMs ?? 5000,
      ...config,
    };

    this.dataBuffer = new DataBuffer(this.config.bufferConfig);
    this.sequenceManager = new SequenceManager(this.config.sequenceConfig);
    this.qualityMonitor = new SyncQualityMonitor(this.config.qualityConfig);

    this.setupSequenceManager();
    this.setupQualityMonitor();
  }

  setMissingDataHandler(handler: MissingDataHandler): void {
    this.missingDataHandler = handler;
  }

  setEventHandlers(handlers: SyncEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  async syncPositionData(data: PositionUpdateData[], accountId: string): Promise<SyncResult> {
    return this.syncDataInternal('position_update', data, accountId);
  }

  async syncAccountData(data: AccountInfoData[], accountId: string): Promise<SyncResult> {
    return this.syncDataInternal('account_update', data, accountId);
  }

  async syncMarketData(data: MarketData[], accountId: string): Promise<SyncResult> {
    return this.syncDataInternal('market_data', data, accountId);
  }

  async syncLosscutAlerts(data: LosscutAlert[], accountId: string): Promise<SyncResult> {
    return this.syncDataInternal('losscut_alert', data, accountId);
  }

  async syncHeartbeatData(data: HeartbeatData[], accountId: string): Promise<SyncResult> {
    return this.syncDataInternal('heartbeat', data, accountId);
  }

  async checkSyncStatus(): Promise<SyncStatus> {
    const overallStats = this.calculateOverallStats();
    const qualityScore = this.config.enableQualityMonitoring 
      ? this.qualityMonitor.calculateQualityScore()
      : 100;

    const byDataType = new Map<DataType, SyncStatus['byDataType'][DataType]>();
    const byAccount = new Map<string, SyncStatus['byAccount'][string]>();

    // Calculate stats by data type
    const dataTypes: DataType[] = ['position_update', 'account_update', 'market_data', 'losscut_alert', 'heartbeat'];
    for (const dataType of dataTypes) {
      const stats = this.calculateDataTypeStats(dataType);
      byDataType.set(dataType, stats);
    }

    // Calculate stats by account
    const accounts = new Set<string>();
    for (const key of this.syncStats.keys()) {
      const accountId = key.split(':')[1];
      if (accountId) accounts.add(accountId);
    }

    for (const accountId of accounts) {
      const stats = this.calculateAccountStats(accountId);
      byAccount.set(accountId, stats);
    }

    return {
      lastSyncTime: overallStats.lastSyncTime,
      totalSynced: overallStats.totalSynced,
      pendingSync: this.dataBuffer.getBufferStatus().totalItems,
      syncLag: overallStats.syncLag,
      qualityScore,
      byDataType,
      byAccount,
    };
  }

  async resyncData(type: DataType, accountId: string, since?: Date): Promise<SyncResult> {
    if (!this.missingDataHandler) {
      throw new Error('Missing data handler not configured for resync operation');
    }

    const request: MissingDataRequest = {
      type,
      accountId,
      missingSequences: [], // Will be filled by sequence manager
      timestamp: new Date(),
    };

    try {
      const missingMessages = await this.missingDataHandler(request);
      const data = missingMessages.map(msg => msg.data);
      return this.syncDataInternal(type, data, accountId);
    } catch (error) {
      const result: SyncResult = {
        success: false,
        processed: 0,
        duplicates: 0,
        missing: 0,
        errors: 1,
        syncTime: 0,
        timestamp: new Date(),
        dataType: type,
        accountId,
      };

      if (this.eventHandlers.onSyncError) {
        this.eventHandlers.onSyncError(error as Error, type, accountId);
      }

      return result;
    }
  }

  getQualityReport(timeWindow?: number): QualityReport {
    return this.qualityMonitor.getQualityReport(timeWindow);
  }

  getBufferStatus() {
    return this.dataBuffer.getBufferStatus();
  }

  getSequenceStatistics(type: DataType, accountId: string) {
    return this.sequenceManager.getSequenceStatistics(type, accountId);
  }

  destroy(): void {
    this.dataBuffer.destroy();
  }

  private async syncDataInternal(
    type: DataType,
    data: any[],
    accountId: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let duplicates = 0;
    let missing = 0;
    let errors = 0;

    try {
      // Process data in batches
      const batches = this.createBatches(data, this.config.batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.processBatch(type, batch, accountId);
        processed += batchResult.processed;
        duplicates += batchResult.duplicates;
        missing += batchResult.missing;
        errors += batchResult.errors;
      }

      const syncTime = Date.now() - startTime;
      const success = errors === 0;

      const result: SyncResult = {
        success,
        processed,
        duplicates,
        missing,
        errors,
        syncTime,
        timestamp: new Date(),
        dataType: type,
        accountId,
      };

      // Update sync statistics
      this.updateSyncStats(type, accountId, processed);

      // Record quality metrics
      if (this.config.enableQualityMonitoring) {
        this.qualityMonitor.recordSyncMetrics(result);
      }

      // Trigger event handlers
      if (this.eventHandlers.onSyncComplete) {
        this.eventHandlers.onSyncComplete(result);
      }

      return result;
    } catch (error) {
      const syncTime = Date.now() - startTime;
      const result: SyncResult = {
        success: false,
        processed,
        duplicates,
        missing,
        errors: errors + 1,
        syncTime,
        timestamp: new Date(),
        dataType: type,
        accountId,
      };

      if (this.eventHandlers.onSyncError) {
        this.eventHandlers.onSyncError(error as Error, type, accountId);
      }

      return result;
    }
  }

  private async processBatch(
    type: DataType,
    batch: any[],
    accountId: string
  ): Promise<{ processed: number; duplicates: number; missing: number; errors: number }> {
    let processed = 0;
    let duplicates = 0;
    let missing = 0;
    let errors = 0;

    for (const item of batch) {
      try {
        const message = this.createEAMessage(type, accountId, item);
        
        // Add to buffer
        this.dataBuffer.addData(message);

        // Process sequence validation if enabled
        if (this.config.enableSequenceValidation) {
          const sequenceResult = this.sequenceManager.processMessage(message);
          
          if (!sequenceResult.canProcess) {
            // Message is out of order or duplicate
            if (sequenceResult.reorderedMessages.length === 0) {
              duplicates++;
              continue;
            }
          }

          // Process any reordered messages
          for (const reorderedMsg of sequenceResult.reorderedMessages) {
            await this.applyDataUpdate(reorderedMsg);
            processed++;
          }
        }

        if (this.config.enableSequenceValidation) {
          const sequenceResult = this.sequenceManager.processMessage(message);
          if (sequenceResult.canProcess) {
            await this.applyDataUpdate(this.createDataItem(message));
            processed++;
          }
        } else {
          await this.applyDataUpdate(this.createDataItem(message));
          processed++;
        }
      } catch (error) {
        errors++;
        console.error(`Error processing ${type} data:`, error);
      }
    }

    return { processed, duplicates, missing, errors };
  }

  private createEAMessage(type: DataType, accountId: string, data: any): EAMessage {
    return {
      version: '1.0',
      type,
      timestamp: Date.now(),
      messageId: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId,
      data,
    };
  }

  private createDataItem(message: EAMessage): DataItem {
    return {
      type: message.type,
      data: message.data,
      timestamp: new Date(message.timestamp),
      sequence: message.timestamp, // Using timestamp as sequence for now
      messageId: message.messageId,
      accountId: message.accountId,
    };
  }

  private async applyDataUpdate(item: DataItem): Promise<void> {
    // In a real implementation, this would update the application state
    // For now, we'll just simulate the processing
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateSyncStats(type: DataType, accountId: string, processed: number): void {
    const key = `${type}:${accountId}`;
    const existing = this.syncStats.get(key) || { lastSync: new Date(0), totalSynced: 0 };
    
    this.syncStats.set(key, {
      lastSync: new Date(),
      totalSynced: existing.totalSynced + processed,
    });
  }

  private calculateOverallStats() {
    let totalSynced = 0;
    let lastSyncTime = new Date(0);
    
    for (const stats of this.syncStats.values()) {
      totalSynced += stats.totalSynced;
      if (stats.lastSync > lastSyncTime) {
        lastSyncTime = stats.lastSync;
      }
    }

    const syncLag = lastSyncTime.getTime() > 0 
      ? Date.now() - lastSyncTime.getTime()
      : 0;

    return { totalSynced, lastSyncTime, syncLag };
  }

  private calculateDataTypeStats(dataType: DataType) {
    let totalSynced = 0;
    let lastSyncTime = new Date(0);
    
    for (const [key, stats] of this.syncStats) {
      if (key.startsWith(`${dataType}:`)) {
        totalSynced += stats.totalSynced;
        if (stats.lastSync > lastSyncTime) {
          lastSyncTime = stats.lastSync;
        }
      }
    }

    const syncLag = lastSyncTime.getTime() > 0 
      ? Date.now() - lastSyncTime.getTime()
      : 0;

    return {
      lastSyncTime,
      totalSynced,
      pendingSync: 0, // Would need to calculate from buffer
      syncLag,
      qualityScore: 100, // Would calculate specific quality score
    };
  }

  private calculateAccountStats(accountId: string) {
    let totalSynced = 0;
    let lastSyncTime = new Date(0);
    
    for (const [key, stats] of this.syncStats) {
      if (key.endsWith(`:${accountId}`)) {
        totalSynced += stats.totalSynced;
        if (stats.lastSync > lastSyncTime) {
          lastSyncTime = stats.lastSync;
        }
      }
    }

    const syncLag = lastSyncTime.getTime() > 0 
      ? Date.now() - lastSyncTime.getTime()
      : 0;

    return {
      lastSyncTime,
      totalSynced,
      pendingSync: 0, // Would need to calculate from buffer
      syncLag,
      qualityScore: 100, // Would calculate specific quality score
    };
  }

  private setupSequenceManager(): void {
    if (this.missingDataHandler) {
      this.sequenceManager.setMissingDataHandler(this.missingDataHandler);
    }
  }

  private setupQualityMonitor(): void {
    if (this.config.enableQualityMonitoring) {
      this.qualityMonitor.onAlert('high_latency', (alert) => {
        if (this.eventHandlers.onQualityAlert) {
          this.eventHandlers.onQualityAlert(alert);
        }
      });

      this.qualityMonitor.onAlert('high_error_rate', (alert) => {
        if (this.eventHandlers.onQualityAlert) {
          this.eventHandlers.onQualityAlert(alert);
        }
      });

      this.qualityMonitor.onAlert('high_duplicate_rate', (alert) => {
        if (this.eventHandlers.onQualityAlert) {
          this.eventHandlers.onQualityAlert(alert);
        }
      });

      this.qualityMonitor.onAlert('high_missing_rate', (alert) => {
        if (this.eventHandlers.onQualityAlert) {
          this.eventHandlers.onQualityAlert(alert);
        }
      });
    }
  }
}

// Singleton instance for easy access
export const dataSynchronizer = new DataSynchronizerImpl();
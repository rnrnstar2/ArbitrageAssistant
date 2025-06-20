import { EAMessage, PositionUpdateData, AccountInfoData, MarketData, LosscutAlert, HeartbeatData } from './message-types';

// Data types for synchronization
export type DataType = 'position_update' | 'account_update' | 'market_data' | 'losscut_alert' | 'heartbeat';

export interface DataItem {
  type: DataType;
  data: PositionUpdateData | AccountInfoData | MarketData | LosscutAlert | HeartbeatData;
  timestamp: Date;
  sequence: number;
  messageId: string;
  accountId: string;
}

export interface BufferStatus {
  totalItems: number;
  buffersByType: Map<DataType, number>;
  memoryUsage: number;
  oldestItem?: Date;
}

export interface DataBufferConfig {
  maxBufferSize: number;
  maxAge: number; // milliseconds
  cleanupInterval: number; // milliseconds
}

export class DataBuffer {
  private buffers: Map<DataType, DataItem[]> = new Map();
  private sequences: Map<DataType, number> = new Map();
  private config: DataBufferConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<DataBufferConfig> = {}) {
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 10000,
      maxAge: config.maxAge ?? 5 * 60 * 1000, // 5 minutes
      cleanupInterval: config.cleanupInterval ?? 30 * 1000, // 30 seconds
    };

    // Initialize buffers for each data type
    this.initializeBuffers();
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  private initializeBuffers(): void {
    const dataTypes: DataType[] = ['position_update', 'account_update', 'market_data', 'losscut_alert', 'heartbeat'];
    dataTypes.forEach(type => {
      this.buffers.set(type, []);
      this.sequences.set(type, 0);
    });
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, this.config.cleanupInterval);
  }

  addData(message: EAMessage): void {
    const item: DataItem = {
      type: message.type,
      data: message.data,
      timestamp: new Date(message.timestamp),
      sequence: this.getNextSequence(message.type),
      messageId: message.messageId,
      accountId: message.accountId,
    };

    const buffer = this.buffers.get(message.type) || [];
    buffer.push(item);

    // Enforce buffer size limit
    if (buffer.length > this.config.maxBufferSize) {
      buffer.shift(); // Remove oldest item
    }

    this.buffers.set(message.type, buffer);
  }

  getData(type: DataType, count?: number): DataItem[] {
    const buffer = this.buffers.get(type) || [];
    if (count === undefined) {
      return [...buffer]; // Return all items
    }
    return buffer.slice(-count); // Return last N items
  }

  getDataByTimeRange(type: DataType, startTime: Date, endTime: Date): DataItem[] {
    const buffer = this.buffers.get(type) || [];
    return buffer.filter(item => 
      item.timestamp >= startTime && item.timestamp <= endTime
    );
  }

  getDataBySequenceRange(type: DataType, startSequence: number, endSequence: number): DataItem[] {
    const buffer = this.buffers.get(type) || [];
    return buffer.filter(item => 
      item.sequence >= startSequence && item.sequence <= endSequence
    );
  }

  flush(type: DataType): DataItem[] {
    const buffer = this.buffers.get(type) || [];
    this.buffers.set(type, []);
    return buffer;
  }

  flushAll(): Map<DataType, DataItem[]> {
    const result = new Map<DataType, DataItem[]>();
    for (const [type, buffer] of this.buffers) {
      result.set(type, [...buffer]);
      this.buffers.set(type, []);
    }
    return result;
  }

  getBufferStatus(): BufferStatus {
    let totalItems = 0;
    const buffersByType = new Map<DataType, number>();
    let oldestItem: Date | undefined;

    for (const [type, buffer] of this.buffers) {
      const count = buffer.length;
      totalItems += count;
      buffersByType.set(type, count);

      // Find oldest item across all buffers
      if (buffer.length > 0) {
        const firstItem = buffer[0];
        if (!oldestItem || firstItem.timestamp < oldestItem) {
          oldestItem = firstItem.timestamp;
        }
      }
    }

    // Estimate memory usage (rough calculation)
    const memoryUsage = this.estimateMemoryUsage();

    return {
      totalItems,
      buffersByType,
      memoryUsage,
      oldestItem,
    };
  }

  getLatestSequence(type: DataType): number {
    return this.sequences.get(type) ?? 0;
  }

  resetSequence(type: DataType): void {
    this.sequences.set(type, 0);
  }

  private getNextSequence(type: DataType): number {
    const current = this.sequences.get(type) ?? 0;
    const next = current + 1;
    this.sequences.set(type, next);
    return next;
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - this.config.maxAge);
    
    for (const [type, buffer] of this.buffers) {
      const filtered = buffer.filter(item => item.timestamp > cutoff);
      this.buffers.set(type, filtered);
    }
  }

  private estimateMemoryUsage(): number {
    let totalBytes = 0;
    
    for (const buffer of this.buffers.values()) {
      // Rough estimation: each item is approximately 1KB
      totalBytes += buffer.length * 1024;
    }
    
    return totalBytes;
  }

  // Get buffer statistics for monitoring
  getStatistics(): {
    totalItems: number;
    itemsByType: Record<DataType, number>;
    memoryUsageMB: number;
    oldestItemAge?: number; // milliseconds
  } {
    const status = this.getBufferStatus();
    const itemsByType: Record<DataType, number> = {} as Record<DataType, number>;
    
    for (const [type, count] of status.buffersByType) {
      itemsByType[type] = count;
    }

    const oldestItemAge = status.oldestItem 
      ? Date.now() - status.oldestItem.getTime()
      : undefined;

    return {
      totalItems: status.totalItems,
      itemsByType,
      memoryUsageMB: Math.round(status.memoryUsage / 1024 / 1024 * 100) / 100,
      oldestItemAge,
    };
  }

  // Clear specific buffer
  clear(type: DataType): void {
    this.buffers.set(type, []);
  }

  // Clear all buffers
  clearAll(): void {
    for (const type of this.buffers.keys()) {
      this.buffers.set(type, []);
    }
  }

  // Destroy the buffer and cleanup resources
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clearAll();
  }
}
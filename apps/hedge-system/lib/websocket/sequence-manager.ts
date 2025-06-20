import { DataType, DataItem } from './data-buffer';
import { EAMessage } from './message-types';

export interface SequenceValidationResult {
  valid: boolean;
  missing: number[];
  duplicates: number[];
  outOfOrder: number[];
  gaps: SequenceGap[];
}

export interface SequenceGap {
  start: number;
  end: number;
  count: number;
}

export interface MissingDataRequest {
  type: DataType;
  accountId: string;
  missingSequences: number[];
  timestamp: Date;
}

export interface SequenceState {
  type: DataType;
  accountId: string;
  lastSequence: number;
  expectedNext: number;
  missingSequences: Set<number>;
  totalReceived: number;
  totalMissing: number;
  totalDuplicates: number;
}

export interface SequenceManagerConfig {
  maxMissingSequences: number;
  sequenceTimeout: number; // milliseconds
  reorderBufferSize: number;
  enableAutoRequest: boolean;
}

export class SequenceManager {
  private sequences: Map<string, SequenceState> = new Map();
  private config: SequenceManagerConfig;
  private missingDataHandler?: (request: MissingDataRequest) => Promise<void>;
  private reorderBuffers: Map<string, Map<number, DataItem>> = new Map();

  constructor(config: Partial<SequenceManagerConfig> = {}) {
    this.config = {
      maxMissingSequences: config.maxMissingSequences ?? 1000,
      sequenceTimeout: config.sequenceTimeout ?? 30000, // 30 seconds
      reorderBufferSize: config.reorderBufferSize ?? 100,
      enableAutoRequest: config.enableAutoRequest ?? true,
    };
  }

  setMissingDataHandler(handler: (request: MissingDataRequest) => Promise<void>): void {
    this.missingDataHandler = handler;
  }

  processMessage(message: EAMessage): {
    canProcess: boolean;
    reorderedMessages: DataItem[];
  } {
    const key = this.getSequenceKey(message.type, message.accountId);
    const state = this.getOrCreateSequenceState(message.type, message.accountId);
    
    // Extract sequence from message (assuming it's added during buffering)
    const sequence = this.extractSequenceFromMessage(message);
    
    if (sequence <= state.lastSequence) {
      // Duplicate message
      state.totalDuplicates++;
      return { canProcess: false, reorderedMessages: [] };
    }

    // Check if this is the next expected sequence
    if (sequence === state.expectedNext) {
      // Perfect order - process immediately
      this.updateSequenceState(state, sequence);
      
      // Check reorder buffer for any messages that can now be processed
      const reorderedMessages = this.processReorderBuffer(key, state);
      
      return { canProcess: true, reorderedMessages };
    } else if (sequence > state.expectedNext) {
      // Out of order - add to reorder buffer
      this.addToReorderBuffer(key, sequence, this.createDataItem(message, sequence));
      
      // Mark missing sequences
      this.markMissingSequences(state, state.expectedNext, sequence - 1);
      
      // Request missing data if enabled
      if (this.config.enableAutoRequest && this.missingDataHandler) {
        this.requestMissingData(message.type, message.accountId, state);
      }
      
      return { canProcess: false, reorderedMessages: [] };
    } else {
      // This is a late arrival of a missing sequence
      if (state.missingSequences.has(sequence)) {
        state.missingSequences.delete(sequence);
        state.totalMissing--;
        return { canProcess: true, reorderedMessages: [] };
      } else {
        // Duplicate
        state.totalDuplicates++;
        return { canProcess: false, reorderedMessages: [] };
      }
    }
  }

  validateSequence(data: DataItem[]): SequenceValidationResult {
    if (data.length === 0) {
      return {
        valid: true,
        missing: [],
        duplicates: [],
        outOfOrder: [],
        gaps: []
      };
    }

    const sequences = data.map(item => item.sequence).sort((a, b) => a - b);
    const missing: number[] = [];
    const duplicates: number[] = [];
    const outOfOrder: number[] = [];
    const gaps: SequenceGap[] = [];

    // Check for duplicates
    const seen = new Set<number>();
    for (const seq of sequences) {
      if (seen.has(seq)) {
        duplicates.push(seq);
      }
      seen.add(seq);
    }

    // Check for missing sequences and gaps
    if (sequences.length > 1) {
      for (let i = 1; i < sequences.length; i++) {
        const current = sequences[i];
        const previous = sequences[i - 1];
        
        if (current > previous + 1) {
          // Found a gap
          const gapStart = previous + 1;
          const gapEnd = current - 1;
          const missingInGap = [];
          
          for (let j = gapStart; j <= gapEnd; j++) {
            missing.push(j);
            missingInGap.push(j);
          }
          
          gaps.push({
            start: gapStart,
            end: gapEnd,
            count: missingInGap.length
          });
        }
      }
    }

    // Check for out of order sequences in original data
    const originalSequences = data.map(item => item.sequence);
    for (let i = 1; i < originalSequences.length; i++) {
      if (originalSequences[i] < originalSequences[i - 1]) {
        outOfOrder.push(originalSequences[i]);
      }
    }

    return {
      valid: missing.length === 0 && duplicates.length === 0 && outOfOrder.length === 0,
      missing,
      duplicates,
      outOfOrder,
      gaps
    };
  }

  getExpectedSequence(type: DataType, accountId: string): number {
    const state = this.sequences.get(this.getSequenceKey(type, accountId));
    return state?.expectedNext ?? 1;
  }

  resetSequence(type: DataType, accountId: string): void {
    const key = this.getSequenceKey(type, accountId);
    this.sequences.delete(key);
    this.reorderBuffers.delete(key);
  }

  getSequenceStatistics(type: DataType, accountId: string): SequenceState | null {
    return this.sequences.get(this.getSequenceKey(type, accountId)) ?? null;
  }

  getAllSequenceStatistics(): Map<string, SequenceState> {
    return new Map(this.sequences);
  }

  // Remove sequences older than the timeout
  cleanupOldSequences(): void {
    const now = Date.now();
    const timeout = this.config.sequenceTimeout;

    for (const [key, buffer] of this.reorderBuffers) {
      const filtered = new Map<number, DataItem>();
      
      for (const [sequence, item] of buffer) {
        if (now - item.timestamp.getTime() < timeout) {
          filtered.set(sequence, item);
        }
      }
      
      this.reorderBuffers.set(key, filtered);
    }
  }

  private getSequenceKey(type: DataType, accountId: string): string {
    return `${type}:${accountId}`;
  }

  private getOrCreateSequenceState(type: DataType, accountId: string): SequenceState {
    const key = this.getSequenceKey(type, accountId);
    let state = this.sequences.get(key);
    
    if (!state) {
      state = {
        type,
        accountId,
        lastSequence: 0,
        expectedNext: 1,
        missingSequences: new Set(),
        totalReceived: 0,
        totalMissing: 0,
        totalDuplicates: 0,
      };
      this.sequences.set(key, state);
    }
    
    return state;
  }

  private extractSequenceFromMessage(message: EAMessage): number {
    // In a real implementation, this would extract the sequence number
    // For now, we'll use timestamp as a proxy
    return message.timestamp;
  }

  private createDataItem(message: EAMessage, sequence: number): DataItem {
    return {
      type: message.type,
      data: message.data,
      timestamp: new Date(message.timestamp),
      sequence,
      messageId: message.messageId,
      accountId: message.accountId,
    };
  }

  private updateSequenceState(state: SequenceState, sequence: number): void {
    state.lastSequence = sequence;
    state.expectedNext = sequence + 1;
    state.totalReceived++;
  }

  private addToReorderBuffer(key: string, sequence: number, item: DataItem): void {
    let buffer = this.reorderBuffers.get(key);
    if (!buffer) {
      buffer = new Map();
      this.reorderBuffers.set(key, buffer);
    }

    buffer.set(sequence, item);

    // Enforce buffer size limit
    if (buffer.size > this.config.reorderBufferSize) {
      // Remove oldest item
      const oldestSequence = Math.min(...buffer.keys());
      buffer.delete(oldestSequence);
    }
  }

  private processReorderBuffer(key: string, state: SequenceState): DataItem[] {
    const buffer = this.reorderBuffers.get(key);
    if (!buffer) return [];

    const reorderedMessages: DataItem[] = [];
    let currentSequence = state.expectedNext;

    // Process messages in sequence order
    while (buffer.has(currentSequence)) {
      const item = buffer.get(currentSequence)!;
      reorderedMessages.push(item);
      buffer.delete(currentSequence);
      
      this.updateSequenceState(state, currentSequence);
      currentSequence = state.expectedNext;
    }

    return reorderedMessages;
  }

  private markMissingSequences(state: SequenceState, start: number, end: number): void {
    for (let seq = start; seq <= end; seq++) {
      if (!state.missingSequences.has(seq)) {
        state.missingSequences.add(seq);
        state.totalMissing++;
      }
    }

    // Limit the number of missing sequences tracked
    if (state.missingSequences.size > this.config.maxMissingSequences) {
      const sequences = Array.from(state.missingSequences).sort((a, b) => a - b);
      const toRemove = sequences.slice(0, sequences.length - this.config.maxMissingSequences);
      toRemove.forEach(seq => state.missingSequences.delete(seq));
    }
  }

  private async requestMissingData(type: DataType, accountId: string, state: SequenceState): Promise<void> {
    if (!this.missingDataHandler || state.missingSequences.size === 0) {
      return;
    }

    const missingSequences = Array.from(state.missingSequences);
    const request: MissingDataRequest = {
      type,
      accountId,
      missingSequences,
      timestamp: new Date(),
    };

    try {
      await this.missingDataHandler(request);
    } catch (error) {
      console.error('Failed to request missing data:', error);
    }
  }
}
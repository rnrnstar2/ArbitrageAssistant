import { SyncEvent } from './sync-manager.js';

export interface Conflict {
  type: 'concurrent_update' | 'stale_data' | 'invalid_state';
  localEvent: SyncEvent;
  remoteEvent?: SyncEvent;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConflictResolution {
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'reject';
  resolvedEvent: SyncEvent;
  reason: string;
  confidence: number; // 0-1 scale
}

export class ConflictResolver {
  private localStateCache: Map<string, any> = new Map();
  private resolutionHistory: ConflictResolution[] = [];
  
  async checkConflict(remoteEvent: SyncEvent): Promise<Conflict | null> {
    const entityKey = this.getEntityKey(remoteEvent.entity, remoteEvent.data);
    const localState = this.localStateCache.get(entityKey);
    
    if (!localState) {
      return null; // ローカル状態がない場合は競合なし
    }
    
    // タイムスタンプベースの競合チェック
    if (this.hasTimestampConflict(localState, remoteEvent.data)) {
      return {
        type: 'concurrent_update',
        localEvent: this.createEventFromLocalState(localState, remoteEvent.entity),
        remoteEvent,
        description: 'Concurrent updates detected within 1 second',
        severity: 'medium'
      };
    }
    
    // データの整合性チェック
    if (this.hasDataInconsistency(localState, remoteEvent.data)) {
      return {
        type: 'invalid_state',
        localEvent: this.createEventFromLocalState(localState, remoteEvent.entity),
        remoteEvent,
        description: 'Critical field inconsistency detected',
        severity: 'high'
      };
    }
    
    // 古いデータのチェック
    if (this.isStaleData(localState, remoteEvent.data)) {
      return {
        type: 'stale_data',
        localEvent: this.createEventFromLocalState(localState, remoteEvent.entity),
        remoteEvent,
        description: 'Remote data is older than local data',
        severity: 'low'
      };
    }
    
    return null;
  }
  
  async resolve(conflict: Conflict): Promise<ConflictResolution> {
    let resolution: ConflictResolution;
    
    switch (conflict.type) {
      case 'concurrent_update':
        resolution = this.resolveConcurrentUpdate(conflict);
        break;
      case 'stale_data':
        resolution = this.resolveStaleData(conflict);
        break;
      case 'invalid_state':
        resolution = this.resolveInvalidState(conflict);
        break;
      default:
        throw new Error(`Unknown conflict type: ${conflict.type}`);
    }
    
    // 解決履歴を記録
    this.resolutionHistory.push(resolution);
    
    // 履歴が長くなりすぎないよう制限
    if (this.resolutionHistory.length > 1000) {
      this.resolutionHistory = this.resolutionHistory.slice(-500);
    }
    
    return resolution;
  }
  
  private resolveConcurrentUpdate(conflict: Conflict): ConflictResolution {
    if (!conflict.remoteEvent || !conflict.localEvent) {
      return {
        strategy: 'reject',
        resolvedEvent: conflict.localEvent,
        reason: 'Missing event data for resolution',
        confidence: 0.1
      };
    }
    
    // 重要度による優先順位付け
    const localPriority = this.calculateEventPriority(conflict.localEvent);
    const remotePriority = this.calculateEventPriority(conflict.remoteEvent);
    
    if (localPriority > remotePriority) {
      return {
        strategy: 'local_wins',
        resolvedEvent: conflict.localEvent,
        reason: 'Local event has higher priority',
        confidence: 0.8
      };
    } else if (remotePriority > localPriority) {
      return {
        strategy: 'remote_wins',
        resolvedEvent: conflict.remoteEvent,
        reason: 'Remote event has higher priority',
        confidence: 0.8
      };
    }
    
    // 優先度が同じ場合はタイムスタンプで判定
    const remoteTime = new Date(conflict.remoteEvent.timestamp);
    const localTime = new Date(conflict.localEvent.timestamp);
    
    if (remoteTime > localTime) {
      return {
        strategy: 'remote_wins',
        resolvedEvent: conflict.remoteEvent,
        reason: 'Remote event is newer',
        confidence: 0.7
      };
    } else if (localTime > remoteTime) {
      return {
        strategy: 'local_wins',
        resolvedEvent: conflict.localEvent,
        reason: 'Local event is newer',
        confidence: 0.7
      };
    }
    
    // 同じタイムスタンプの場合はマージを試行
    const canMerge = this.canMergeEvents(conflict.localEvent, conflict.remoteEvent);
    if (canMerge) {
      const mergedEvent = this.mergeEvents(conflict.localEvent, conflict.remoteEvent);
      return {
        strategy: 'merge',
        resolvedEvent: mergedEvent,
        reason: 'Successfully merged concurrent updates',
        confidence: 0.9
      };
    }
    
    // マージできない場合はリモート優先
    return {
      strategy: 'remote_wins',
      resolvedEvent: conflict.remoteEvent,
      reason: 'Cannot merge, defaulting to remote',
      confidence: 0.5
    };
  }
  
  private resolveStaleData(conflict: Conflict): ConflictResolution {
    // 古いデータは無視
    return {
      strategy: 'reject',
      resolvedEvent: conflict.localEvent,
      reason: 'Stale remote data rejected',
      confidence: 0.9
    };
  }
  
  private resolveInvalidState(conflict: Conflict): ConflictResolution {
    if (!conflict.remoteEvent || !conflict.localEvent) {
      return {
        strategy: 'reject',
        resolvedEvent: conflict.localEvent,
        reason: 'Missing event data for resolution',
        confidence: 0.1
      };
    }
    
    // 重要なフィールドの整合性チェック
    const criticalFieldsMatch = this.checkCriticalFields(
      conflict.localEvent.data,
      conflict.remoteEvent.data
    );
    
    if (criticalFieldsMatch) {
      // 重要フィールドが一致する場合はマージを試行
      const mergedEvent = this.mergeEvents(conflict.localEvent, conflict.remoteEvent);
      return {
        strategy: 'merge',
        resolvedEvent: mergedEvent,
        reason: 'Critical fields match, merged non-critical differences',
        confidence: 0.8
      };
    }
    
    // 重要フィールドが不一致の場合
    // より新しいデータを優先
    const remoteTime = new Date(conflict.remoteEvent.data.updatedAt || conflict.remoteEvent.timestamp);
    const localTime = new Date(conflict.localEvent.data.updatedAt || conflict.localEvent.timestamp);
    
    if (remoteTime > localTime) {
      return {
        strategy: 'remote_wins',
        resolvedEvent: conflict.remoteEvent,
        reason: 'Remote data is newer and has critical field differences',
        confidence: 0.7
      };
    } else {
      return {
        strategy: 'local_wins',
        resolvedEvent: conflict.localEvent,
        reason: 'Local data is newer despite critical field differences',
        confidence: 0.7
      };
    }
  }
  
  private calculateEventPriority(event: SyncEvent): number {
    let priority = 0;
    
    // エンティティタイプによる基本優先度
    switch (event.entity) {
      case 'position':
        priority += 100; // 最重要
        break;
      case 'action':
        priority += 50;
        break;
      case 'strategy':
        priority += 10;
        break;
    }
    
    // オペレーションタイプによる優先度
    switch (event.type) {
      case 'DELETE':
        priority += 30;
        break;
      case 'UPDATE':
        priority += 20;
        break;
      case 'CREATE':
        priority += 10;
        break;
    }
    
    // ソースによる優先度
    if (event.source === 'local') {
      priority += 5; // ローカル優先
    }
    
    return priority;
  }
  
  private canMergeEvents(localEvent: SyncEvent, remoteEvent: SyncEvent): boolean {
    // 基本条件チェック
    if (localEvent.entity !== remoteEvent.entity) {
      return false;
    }
    
    if (localEvent.type === 'DELETE' || remoteEvent.type === 'DELETE') {
      return false; // 削除操作はマージできない
    }
    
    // 重要フィールドの競合チェック
    const criticalFields = this.getCriticalFields(localEvent.entity);
    for (const field of criticalFields) {
      const localValue = localEvent.data[field];
      const remoteValue = remoteEvent.data[field];
      
      if (localValue !== undefined && remoteValue !== undefined && localValue !== remoteValue) {
        return false; // 重要フィールドが競合している
      }
    }
    
    return true;
  }
  
  private mergeEvents(localEvent: SyncEvent, remoteEvent: SyncEvent): SyncEvent {
    // 基本的なマージストラテジー：
    // - より新しいタイムスタンプを持つフィールドを優先
    // - undefinedでない値を優先
    // - ローカルデータを基準に、リモートデータで上書き
    
    const mergedData = { ...localEvent.data };
    
    // リモートデータで上書き
    Object.keys(remoteEvent.data).forEach(key => {
      const localValue = localEvent.data[key];
      const remoteValue = remoteEvent.data[key];
      
      if (remoteValue !== undefined) {
        if (localValue === undefined) {
          // ローカルにない値はリモート値を採用
          mergedData[key] = remoteValue;
        } else if (key === 'updatedAt') {
          // updatedAtは新しい方を採用
          const localTime = new Date(localValue).getTime();
          const remoteTime = new Date(remoteValue).getTime();
          mergedData[key] = remoteTime > localTime ? remoteValue : localValue;
        } else {
          // その他のフィールドはリモート優先
          mergedData[key] = remoteValue;
        }
      }
    });
    
    return {
      ...remoteEvent,
      data: mergedData,
      syncId: this.generateMergedSyncId(localEvent.syncId, remoteEvent.syncId),
      timestamp: new Date() // マージ時刻を記録
    };
  }
  
  private getCriticalFields(entity: SyncEvent['entity']): string[] {
    switch (entity) {
      case 'position':
        return ['positionId', 'symbol', 'volume', 'status'];
      case 'strategy':
        return ['strategyId', 'name', 'trailWidth'];
      case 'action':
        return ['actionId', 'type', 'status'];
      default:
        return [];
    }
  }
  
  private checkCriticalFields(localData: any, remoteData: any): boolean {
    // すべてのエンティティに共通する重要フィールドをチェック
    const commonCriticalFields = ['id', 'status'];
    
    for (const field of commonCriticalFields) {
      const localValue = localData[field];
      const remoteValue = remoteData[field];
      
      if (localValue !== undefined && remoteValue !== undefined && localValue !== remoteValue) {
        return false;
      }
    }
    
    return true;
  }
  
  private hasTimestampConflict(localState: any, remoteData: any): boolean {
    if (!localState.updatedAt || !remoteData.updatedAt) {
      return false;
    }
    
    const localTime = new Date(localState.updatedAt).getTime();
    const remoteTime = new Date(remoteData.updatedAt).getTime();
    const timeDiff = Math.abs(localTime - remoteTime);
    
    // 1秒以内の差は競合とみなす
    return timeDiff < 1000;
  }
  
  private hasDataInconsistency(localState: any, remoteData: any): boolean {
    // 重要なフィールドの不整合チェック
    const criticalFields = ['status', 'volume', 'symbol', 'positionId', 'strategyId'];
    
    return criticalFields.some(field => {
      return localState[field] !== undefined && 
             remoteData[field] !== undefined && 
             localState[field] !== remoteData[field];
    });
  }
  
  private isStaleData(localState: any, remoteData: any): boolean {
    if (!localState.updatedAt || !remoteData.updatedAt) {
      return false;
    }
    
    const localTime = new Date(localState.updatedAt).getTime();
    const remoteTime = new Date(remoteData.updatedAt).getTime();
    
    // リモートデータがローカルより5秒以上古い場合は陳腐化とみなす
    return remoteTime < localTime - 5000;
  }
  
  private createEventFromLocalState(localState: any, entity: SyncEvent['entity']): SyncEvent {
    return {
      type: 'UPDATE',
      entity,
      data: localState,
      timestamp: new Date(localState.updatedAt || Date.now()),
      source: 'local',
      syncId: `local_${localState.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  private getEntityKey(entity: SyncEvent['entity'], data: any): string {
    switch (entity) {
      case 'position':
        return `position_${data.positionId}`;
      case 'strategy':
        return `strategy_${data.strategyId}`;
      case 'action':
        return `action_${data.actionId}`;
      default:
        return `${entity}_${data.id || 'unknown'}`;
    }
  }
  
  private generateMergedSyncId(localSyncId: string, remoteSyncId: string): string {
    return `merged_${Date.now()}_${localSyncId.split('_').pop()}_${remoteSyncId.split('_').pop()}`;
  }
  
  // ローカル状態の管理
  updateLocalState(entity: SyncEvent['entity'], data: any): void {
    const entityKey = this.getEntityKey(entity, data);
    this.localStateCache.set(entityKey, { ...data, updatedAt: new Date() });
  }
  
  getLocalState(entity: SyncEvent['entity'], data: any): any | null {
    const entityKey = this.getEntityKey(entity, data);
    return this.localStateCache.get(entityKey) || null;
  }
  
  clearLocalState(): void {
    this.localStateCache.clear();
  }
  
  // 統計情報
  getResolutionStats(): {
    totalResolutions: number;
    strategyCounts: Record<string, number>;
    averageConfidence: number;
  } {
    const strategyCounts: Record<string, number> = {};
    let totalConfidence = 0;
    
    this.resolutionHistory.forEach(resolution => {
      strategyCounts[resolution.strategy] = (strategyCounts[resolution.strategy] || 0) + 1;
      totalConfidence += resolution.confidence;
    });
    
    return {
      totalResolutions: this.resolutionHistory.length,
      strategyCounts,
      averageConfidence: this.resolutionHistory.length > 0 
        ? totalConfidence / this.resolutionHistory.length 
        : 0
    };
  }
  
  getRecentResolutions(count: number = 10): ConflictResolution[] {
    return this.resolutionHistory.slice(-count);
  }
}
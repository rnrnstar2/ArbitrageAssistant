import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { filter, debounceTime, retry } from 'rxjs/operators';
import { Position, Strategy, Action } from '@repo/shared-types';
import { AmplifyGraphQLClient } from './amplify-client.js';
import { RealtimeSync } from './realtime-sync.js';
import { EventDispatcher } from './event-dispatcher.js';
import { DataValidator } from './data-validator.js';
import { ConflictResolver } from './conflict-resolver.js';
import { SyncQueue } from './sync-queue.js';

export interface SyncEvent {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'position' | 'strategy' | 'action';
  data: any;
  timestamp: Date;
  source: 'local' | 'remote';
  syncId: string;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSyncTime: Date;
  pendingChanges: number;
  errorCount: number;
  retryCount: number;
}

export class SyncManager {
  private syncQueue: SyncQueue;
  private eventDispatcher: EventDispatcher;
  private dataValidator: DataValidator;
  private conflictResolver: ConflictResolver;
  
  private syncStatus$ = new BehaviorSubject<SyncStatus>({
    isConnected: false,
    lastSyncTime: new Date(),
    pendingChanges: 0,
    errorCount: 0,
    retryCount: 0
  });
  
  private localEvents$ = new Subject<SyncEvent>();
  private remoteEvents$ = new Subject<SyncEvent>();
  private syncInterval?: NodeJS.Timeout;
  private connectionCheckInterval?: NodeJS.Timeout;
  
  constructor(
    private amplifyClient: AmplifyGraphQLClient,
    private realtimeSync: RealtimeSync
  ) {
    this.syncQueue = new SyncQueue();
    this.eventDispatcher = new EventDispatcher();
    this.dataValidator = new DataValidator();
    this.conflictResolver = new ConflictResolver();
    
    this.setupEventHandlers();
    this.startSyncProcess();
  }
  
  private setupEventHandlers(): void {
    // ローカルイベントの処理
    this.localEvents$.pipe(
      debounceTime(100), // 短時間の連続更新をまとめる
      filter(event => this.dataValidator.validate(event))
    ).subscribe(event => {
      this.syncQueue.enqueue(event);
    });
    
    // リモートイベントの処理
    this.remoteEvents$.subscribe(event => {
      this.handleRemoteEvent(event);
    });
    
    // AWS Amplifyからのリアルタイムイベント監視
    this.setupAmplifySubscriptions();
  }
  
  private setupAmplifySubscriptions(): void {
    // Position更新の監視
    this.realtimeSync.subscribeToPositionUpdates()
      .pipe(retry(3))
      .subscribe({
        next: (position) => {
          this.emitRemoteEvent('UPDATE', 'position', position);
        },
        error: (error) => {
          this.handleSyncError(error);
        }
      });
    
    // 新規Position作成の監視
    this.realtimeSync.subscribeToNewPositions()
      .pipe(retry(3))
      .subscribe({
        next: (position) => {
          this.emitRemoteEvent('CREATE', 'position', position);
        },
        error: (error) => {
          this.handleSyncError(error);
        }
      });
    
    // Strategy更新の監視
    this.realtimeSync.subscribeToStrategyUpdates()
      .pipe(retry(3))
      .subscribe({
        next: (strategy) => {
          this.emitRemoteEvent('UPDATE', 'strategy', strategy);
        },
        error: (error) => {
          this.handleSyncError(error);
        }
      });
    
    // 新規Strategy作成の監視
    this.realtimeSync.subscribeToNewStrategies()
      .pipe(retry(3))
      .subscribe({
        next: (strategy) => {
          this.emitRemoteEvent('CREATE', 'strategy', strategy);
        },
        error: (error) => {
          this.handleSyncError(error);
        }
      });
    
    // Action更新の監視
    this.realtimeSync.subscribeToActionUpdates()
      .pipe(retry(3))
      .subscribe({
        next: (action) => {
          this.emitRemoteEvent('UPDATE', 'action', action);
        },
        error: (error) => {
          this.handleSyncError(error);
        }
      });
    
    // 新規Action作成の監視
    this.realtimeSync.subscribeToNewActions()
      .pipe(retry(3))
      .subscribe({
        next: (action) => {
          this.emitRemoteEvent('CREATE', 'action', action);
        },
        error: (error) => {
          this.handleSyncError(error);
        }
      });
  }
  
  private startSyncProcess(): void {
    // 定期的な同期処理
    this.syncInterval = setInterval(async () => {
      await this.processSyncQueue();
    }, 1000);
    
    // 接続状態の監視
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionStatus();
    }, 5000);
  }
  
  async processSyncQueue(): Promise<void> {
    const pendingEvents = this.syncQueue.dequeue(10); // バッチ処理
    
    for (const event of pendingEvents) {
      try {
        await this.syncEventToRemote(event);
        this.syncQueue.markAsCompleted(event.syncId);
        
        // 成功時の状態更新
        this.updateSyncStatus({
          lastSyncTime: new Date(),
          pendingChanges: this.syncQueue.getPendingCount(),
          errorCount: 0,
          retryCount: 0
        });
        
      } catch (error) {
        this.handleSyncError(error, event);
      }
    }
  }
  
  private async syncEventToRemote(event: SyncEvent): Promise<void> {
    switch (event.entity) {
      case 'position':
        await this.syncPosition(event);
        break;
      case 'strategy':
        await this.syncStrategy(event);
        break;
      case 'action':
        await this.syncAction(event);
        break;
      default:
        throw new Error(`Unknown entity type: ${event.entity}`);
    }
  }
  
  private async syncPosition(event: SyncEvent): Promise<void> {
    switch (event.type) {
      case 'CREATE':
        await this.amplifyClient.createPosition(event.data);
        break;
      case 'UPDATE':
        await this.amplifyClient.updatePosition(event.data);
        break;
      case 'DELETE':
        // Positionは通常削除しない（クローズのみ）
        break;
    }
  }
  
  private async syncStrategy(event: SyncEvent): Promise<void> {
    switch (event.type) {
      case 'CREATE':
        await this.amplifyClient.createStrategy(event.data);
        break;
      case 'UPDATE':
        await this.amplifyClient.updateStrategy(event.data);
        break;
      case 'DELETE':
        // Strategyは通常削除しない
        break;
    }
  }
  
  private async syncAction(event: SyncEvent): Promise<void> {
    switch (event.type) {
      case 'CREATE':
        await this.amplifyClient.createAction(event.data);
        break;
      case 'UPDATE':
        await this.amplifyClient.updateAction(event.data);
        break;
      case 'DELETE':
        // Actionは削除可能だが現在実装なし
        break;
    }
  }
  
  private async handleRemoteEvent(event: SyncEvent): Promise<void> {
    // 競合チェック
    const conflict = await this.conflictResolver.checkConflict(event);
    if (conflict) {
      const resolution = await this.conflictResolver.resolve(conflict);
      event = resolution.resolvedEvent;
    }
    
    // ローカル状態の更新
    await this.updateLocalState(event);
    
    // 他のコンポーネントに通知
    this.eventDispatcher.dispatch(event);
  }
  
  private async updateLocalState(event: SyncEvent): Promise<void> {
    // ローカルキャッシュの更新
    switch (event.entity) {
      case 'position':
        await this.updateLocalPosition(event);
        break;
      case 'strategy':
        await this.updateLocalStrategy(event);
        break;
      case 'action':
        await this.updateLocalAction(event);
        break;
    }
  }
  
  private async updateLocalPosition(event: SyncEvent): Promise<void> {
    // ローカルPositionキャッシュの更新
    // 実装は他のローカル状態管理システムに依存
    console.log('Updating local position:', event.data.positionId);
  }
  
  private async updateLocalStrategy(event: SyncEvent): Promise<void> {
    // ローカルStrategyキャッシュの更新
    console.log('Updating local strategy:', event.data.strategyId);
  }
  
  private async updateLocalAction(event: SyncEvent): Promise<void> {
    // ローカルActionキャッシュの更新
    console.log('Updating local action:', event.data.actionId);
  }
  
  // Public API
  emitLocalEvent(type: SyncEvent['type'], entity: SyncEvent['entity'], data: any): void {
    const event: SyncEvent = {
      type,
      entity,
      data,
      timestamp: new Date(),
      source: 'local',
      syncId: this.generateSyncId()
    };
    
    this.localEvents$.next(event);
  }
  
  emitRemoteEvent(type: SyncEvent['type'], entity: SyncEvent['entity'], data: any): void {
    const event: SyncEvent = {
      type,
      entity,
      data,
      timestamp: new Date(),
      source: 'remote',
      syncId: this.generateSyncId()
    };
    
    this.remoteEvents$.next(event);
  }
  
  getSyncStatus(): Observable<SyncStatus> {
    return this.syncStatus$.asObservable();
  }
  
  async forceSyncAll(): Promise<void> {
    // 全データの強制同期
    await this.syncAllPositions();
    await this.syncAllStrategies();
    await this.syncAllActions();
  }
  
  private async syncAllPositions(): Promise<void> {
    try {
      const positions = await this.amplifyClient.listPositions();
      positions.forEach(position => {
        this.emitRemoteEvent('UPDATE', 'position', position);
      });
    } catch (error) {
      console.error('Failed to sync all positions:', error);
    }
  }
  
  private async syncAllStrategies(): Promise<void> {
    try {
      const strategies = await this.amplifyClient.listStrategies();
      strategies.forEach(strategy => {
        this.emitRemoteEvent('UPDATE', 'strategy', strategy);
      });
    } catch (error) {
      console.error('Failed to sync all strategies:', error);
    }
  }
  
  private async syncAllActions(): Promise<void> {
    try {
      const actions = await this.amplifyClient.listActions();
      actions.forEach(action => {
        this.emitRemoteEvent('UPDATE', 'action', action);
      });
    } catch (error) {
      console.error('Failed to sync all actions:', error);
    }
  }
  
  private handleSyncError(error: any, event?: SyncEvent): void {
    console.error('Sync error:', error);
    
    if (event) {
      this.syncQueue.markAsError(event.syncId, error);
    }
    
    this.updateSyncStatus({
      errorCount: this.syncStatus$.value.errorCount + 1
    });
  }
  
  private checkConnectionStatus(): void {
    // 接続状態のチェック
    const isConnected = this.amplifyClient.isConnected();
    
    this.updateSyncStatus({
      isConnected
    });
  }
  
  private updateSyncStatus(update: Partial<SyncStatus>): void {
    const currentStatus = this.syncStatus$.value;
    this.syncStatus$.next({ ...currentStatus, ...update });
  }
  
  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Cleanup
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    this.localEvents$.complete();
    this.remoteEvents$.complete();
    this.syncStatus$.complete();
    
    this.realtimeSync.unsubscribeAll();
  }
}
import type { RealtimePosition, RealtimeAccount } from '@repo/shared-types';

interface MT4Connection {
  accountId: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
  lastHeartbeat: Date;
  endpoint: string;
}

interface SyncQuality {
  lastMT4Sync: Date;
  conflictCount: number;
  syncLatency: number; // ms
  isHealthy: boolean;
}

/**
 * リアルタイム状態管理（メモリベース）
 * MT4/MT5をSSOTとし、WebSocketはUI表示用キャッシュのみ
 */
export class RealtimeStateManager {
  private positions = new Map<string, RealtimePosition>();
  private accounts = new Map<string, RealtimeAccount>();
  private mt4Connections = new Map<string, MT4Connection>();
  private syncQuality = new Map<string, SyncQuality>();
  
  // 設定
  private readonly STALE_THRESHOLD = 30000; // 30秒でstale判定
  private readonly SYNC_INTERVAL = 60000;   // 1分ごとにMT4同期
  private readonly MAX_CONFLICTS = 5;       // 最大競合許容数
  
  private syncTimer?: NodeJS.Timeout;
  
  constructor() {
    this.startPeriodicSync();
  }
  
  // ===== WebSocketからの更新（キャッシュ更新） =====
  
  /**
   * WebSocketからポジション更新受信
   */
  updatePositionFromWebSocket(positionData: Omit<RealtimePosition, 'lastUpdate' | 'isStale'>): void {
    const position: RealtimePosition = {
      ...positionData,
      lastUpdate: new Date(),
      isStale: false
    };
    
    this.positions.set(position.id, position);
    
    // アカウント情報も更新
    this.updateAccountPositions(position.accountId);
    
    console.log(`📊 Position updated via WebSocket: ${position.symbol} (${position.accountId})`);
  }
  
  /**
   * WebSocketからアカウント更新受信
   */
  updateAccountFromWebSocket(accountData: Omit<RealtimeAccount, 'lastUpdate' | 'positions'>): void {
    const account: RealtimeAccount = {
      ...accountData,
      positions: this.getPositionsByAccount(accountData.id),
      lastUpdate: new Date()
    };
    
    this.accounts.set(account.id, account);
    
    console.log(`💰 Account updated via WebSocket: ${account.id}`);
  }
  
  /**
   * WebSocket接続状態更新
   */
  updateMT4Connection(accountId: string, status: 'connected' | 'disconnected' | 'reconnecting', endpoint?: string): void {
    const connection: MT4Connection = {
      accountId,
      status,
      lastHeartbeat: new Date(),
      endpoint: endpoint || this.mt4Connections.get(accountId)?.endpoint || 'unknown'
    };
    
    this.mt4Connections.set(accountId, connection);
    
    // アカウントの接続状態も更新
    const account = this.accounts.get(accountId);
    if (account) {
      account.connectionStatus = status === 'connected' ? 'connected' : 'disconnected';
      account.lastUpdate = new Date();
    }
    
    console.log(`🔗 MT4 connection updated: ${accountId} - ${status}`);
  }
  
  // ===== MT4/MT5からの同期（正確性担保） =====
  
  /**
   * MT4/MT5から定期同期実行
   */
  async syncFromMT4(): Promise<void> {
    console.log('🔄 Starting MT4/MT5 sync...');
    
    for (const [accountId, connection] of this.mt4Connections) {
      if (connection.status === 'connected') {
        try {
          await this.syncAccountFromMT4(accountId);
        } catch (error) {
          console.error(`❌ Failed to sync account ${accountId}:`, error);
          this.updateSyncQuality(accountId, false);
        }
      }
    }
    
    console.log('✅ MT4/MT5 sync completed');
  }
  
  /**
   * 単一アカウントのMT4同期
   */
  private async syncAccountFromMT4(accountId: string): Promise<void> {
    const startTime = Date.now();
    
    // MT4からポジション・アカウント情報取得
    const mt4Positions = await this.fetchMT4Positions(accountId);
    const mt4Account = await this.fetchMT4Account(accountId);
    
    // 競合検出・修正
    const conflicts = this.detectConflicts(accountId, mt4Positions, mt4Account);
    
    if (conflicts.length > 0) {
      console.log(`⚠️ Detected ${conflicts.length} conflicts for account ${accountId}`);
      this.resolveConflicts(accountId, mt4Positions, mt4Account);
    }
    
    // 同期品質更新
    const syncLatency = Date.now() - startTime;
    this.updateSyncQuality(accountId, true, conflicts.length, syncLatency);
  }
  
  /**
   * データ競合検出
   */
  private detectConflicts(accountId: string, mt4Positions: RealtimePosition[], mt4Account: RealtimeAccount): string[] {
    const conflicts: string[] = [];
    
    // ポジション競合チェック
    const cachedPositions = this.getPositionsByAccount(accountId);
    
    for (const mt4Position of mt4Positions) {
      const cachedPosition = cachedPositions.find(p => p.id === mt4Position.id);
      
      if (cachedPosition) {
        // 価格差チェック
        if (Math.abs(cachedPosition.currentPrice - mt4Position.currentPrice) > 0.0001) {
          conflicts.push(`Price mismatch for ${mt4Position.symbol}: cached=${cachedPosition.currentPrice}, mt4=${mt4Position.currentPrice}`);
        }
        
        // 利益差チェック
        if (Math.abs(cachedPosition.profit - mt4Position.profit) > 1) {
          conflicts.push(`Profit mismatch for ${mt4Position.symbol}: cached=${cachedPosition.profit}, mt4=${mt4Position.profit}`);
        }
      }
    }
    
    // 存在しないポジションチェック
    const mt4PositionIds = new Set(mt4Positions.map(p => p.id));
    for (const cachedPosition of cachedPositions) {
      if (!mt4PositionIds.has(cachedPosition.id)) {
        conflicts.push(`Position ${cachedPosition.id} exists in cache but not in MT4`);
      }
    }
    
    return conflicts;
  }
  
  /**
   * 競合解決（MT4データで上書き）
   */
  private resolveConflicts(accountId: string, mt4Positions: RealtimePosition[], mt4Account: RealtimeAccount): void {
    console.log(`🔧 Resolving conflicts for account ${accountId} - MT4 data is authoritative`);
    
    // ポジション全置換
    const existingPositions = this.getPositionsByAccount(accountId);
    existingPositions.forEach(p => this.positions.delete(p.id));
    
    mt4Positions.forEach(position => {
      this.positions.set(position.id, {
        ...position,
        lastUpdate: new Date(),
        isStale: false
      });
    });
    
    // アカウント情報更新
    this.accounts.set(accountId, {
      ...mt4Account,
      positions: mt4Positions,
      lastUpdate: new Date()
    });
    
    console.log(`✅ Conflicts resolved for account ${accountId}`);
  }
  
  // ===== データ取得（UI用） =====
  
  /**
   * 全ポジション取得
   */
  getAllPositions(): RealtimePosition[] {
    return Array.from(this.positions.values());
  }
  
  /**
   * アカウント別ポジション取得
   */
  getPositionsByAccount(accountId: string): RealtimePosition[] {
    return Array.from(this.positions.values()).filter(p => p.accountId === accountId);
  }
  
  /**
   * 全アカウント取得
   */
  getAllAccounts(): RealtimeAccount[] {
    return Array.from(this.accounts.values());
  }
  
  /**
   * 単一アカウント取得
   */
  getAccount(accountId: string): RealtimeAccount | undefined {
    return this.accounts.get(accountId);
  }
  
  /**
   * 接続状態取得
   */
  getConnectionStatus(): { accountId: string; status: string; lastHeartbeat: Date }[] {
    return Array.from(this.mt4Connections.values()).map(conn => ({
      accountId: conn.accountId,
      status: conn.status,
      lastHeartbeat: conn.lastHeartbeat
    }));
  }
  
  /**
   * 同期品質取得
   */
  getSyncQuality(): { accountId: string; quality: SyncQuality }[] {
    return Array.from(this.syncQuality.entries()).map(([accountId, quality]) => ({
      accountId,
      quality
    }));
  }
  
  // ===== 内部メソッド =====
  
  /**
   * アカウントポジション更新
   */
  private updateAccountPositions(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.positions = this.getPositionsByAccount(accountId);
      account.lastUpdate = new Date();
    }
  }
  
  /**
   * 同期品質更新
   */
  private updateSyncQuality(accountId: string, success: boolean, conflictCount = 0, syncLatency = 0): void {
    const quality: SyncQuality = {
      lastMT4Sync: new Date(),
      conflictCount,
      syncLatency,
      isHealthy: success && conflictCount < this.MAX_CONFLICTS
    };
    
    this.syncQuality.set(accountId, quality);
  }
  
  /**
   * 定期同期開始
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      this.syncFromMT4().catch(error => {
        console.error('❌ Periodic sync failed:', error);
      });
    }, this.SYNC_INTERVAL);
    
    console.log(`⏰ Periodic MT4 sync started (interval: ${this.SYNC_INTERVAL}ms)`);
  }
  
  /**
   * ステイル状態チェック
   */
  markStaleData(): void {
    const now = new Date();
    
    for (const position of this.positions.values()) {
      if (now.getTime() - position.lastUpdate.getTime() > this.STALE_THRESHOLD) {
        position.isStale = true;
      }
    }
  }
  
  // ===== MT4 API模擬実装 =====
  
  /**
   * MT4からポジション取得（模擬実装）
   */
  private async fetchMT4Positions(accountId: string): Promise<RealtimePosition[]> {
    // TODO: 実際のMT4 API実装
    console.log(`📡 Fetching positions from MT4 for account: ${accountId}`);
    
    // 模擬データ
    return [
      {
        id: `pos_${accountId}_1`,
        accountId,
        symbol: 'USDJPY',
        type: 'buy',
        volume: 0.1,
        openPrice: 149.50,
        currentPrice: 149.75,
        profit: 250,
        openTime: new Date(Date.now() - 3600000), // 1時間前
        lastUpdate: new Date(),
        isStale: false
      }
    ];
  }
  
  /**
   * MT4からアカウント情報取得（模擬実装）
   */
  private async fetchMT4Account(accountId: string): Promise<RealtimeAccount> {
    // TODO: 実際のMT4 API実装
    console.log(`📡 Fetching account info from MT4 for account: ${accountId}`);
    
    return {
      id: accountId,
      balance: 100000,
      equity: 100250,
      margin: 1495,
      freeMargin: 98755,
      marginLevel: 6706,
      positions: [],
      lastUpdate: new Date(),
      connectionStatus: 'connected'
    };
  }
  
  /**
   * リソースクリーンアップ
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.positions.clear();
    this.accounts.clear();
    this.mt4Connections.clear();
    this.syncQuality.clear();
    
    console.log('🧹 RealtimeStateManager destroyed');
  }
}
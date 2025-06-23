import { AmplifyGraphQLClient } from './amplify-client';
import { Position, PositionStatus } from '@repo/shared-types';
import { CREATE_TRAIL_ACTION, UPDATE_POSITION_STATUS } from './graphql/mutations';

interface TrailConfig {
  positionId: string;
  trailWidth: number;
  lastPrice: number;
  bestPrice: number;
  isActive: boolean;
  startTime: Date;
  symbol: string;
  direction: 'BUY' | 'SELL';
}

interface PriceUpdate {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}

/**
 * トレール判定エンジン
 * MVPデザイン仕様3-3に基づくトレール監視・実行
 */
export class TrailEngine {
  private amplifyClient: AmplifyGraphQLClient;
  private monitoredPositions: Map<string, TrailConfig> = new Map();
  private priceSubscriptions: Map<string, any> = new Map();
  private isRunning = false;
  
  // 統計・監視
  private stats = {
    totalTrailsStarted: 0,
    totalTrailsExecuted: 0,
    totalLossCutsHandled: 0,
    activeTrails: 0
  };

  constructor(amplifyClient: AmplifyGraphQLClient) {
    this.amplifyClient = amplifyClient;
  }

  /**
   * トレール監視開始
   * ポジション毎のトレール設定で価格監視開始
   */
  async startTrailMonitoring(position: Position, trailWidth: number): Promise<void> {
    console.log(`🎯 Starting trail monitoring for position: ${position.positionId}`);
    
    if (this.monitoredPositions.has(position.positionId)) {
      console.warn(`Trail already exists for position: ${position.positionId}`);
      return;
    }

    const config: TrailConfig = {
      positionId: position.positionId,
      trailWidth,
      lastPrice: position.currentPrice || position.entryPrice || 0,
      bestPrice: position.currentPrice || position.entryPrice || 0,
      isActive: true,
      startTime: new Date(),
      symbol: position.symbol,
      direction: this.getPositionDirection(position)
    };

    this.monitoredPositions.set(position.positionId, config);
    this.stats.totalTrailsStarted++;
    this.stats.activeTrails++;
    
    // シンボル別価格監視開始
    await this.startPriceMonitoring(position.symbol);
    
    console.log(`✅ Trail monitoring started for ${position.positionId} with trail width: ${trailWidth}`);
  }

  /**
   * シンボル別価格監視開始
   */
  private async startPriceMonitoring(symbol: string): Promise<void> {
    if (this.priceSubscriptions.has(symbol)) {
      return; // 既に監視中
    }

    // 実際の実装では価格配信システムとの統合が必要
    // ここではサンプル実装
    console.log(`📊 Starting price monitoring for symbol: ${symbol}`);
    
    // WebSocketやMT4からの価格配信を監視
    // 実装は価格配信システムに依存
    this.priceSubscriptions.set(symbol, true);
  }

  /**
   * 価格更新処理
   * 外部から呼び出される価格更新ハンドラー
   */
  async handlePriceUpdate(priceUpdate: PriceUpdate): Promise<void> {
    if (!this.isRunning) return;

    // 該当シンボルのトレール設定を取得
    const relevantTrails = Array.from(this.monitoredPositions.values())
      .filter(config => config.symbol === priceUpdate.symbol && config.isActive);

    for (const config of relevantTrails) {
      await this.evaluateTrailCondition(config, priceUpdate);
    }
  }

  /**
   * トレール条件判定（設計書3-3準拠）
   * 価格変動に基づくトレール実行判定
   */
  private async evaluateTrailCondition(
    config: TrailConfig,
    priceUpdate: PriceUpdate
  ): Promise<void> {
    const currentPrice = config.direction === 'BUY' ? priceUpdate.bid : priceUpdate.ask;
    
    try {
      // 1. 最良価格更新判定
      const isProfitable = this.isProfitableMove(config, currentPrice);
      
      if (isProfitable) {
        config.bestPrice = currentPrice;
        console.log(`📈 Best price updated for ${config.positionId}: ${currentPrice}`);
      }

      // 2. トレール条件判定
      const shouldTriggerTrail = this.shouldTriggerTrail(config, currentPrice);
      
      if (shouldTriggerTrail) {
        console.log(`🚨 Trail condition triggered for position: ${config.positionId}`);
        await this.executeTrail(config, currentPrice);
      }

      // 3. 価格情報更新
      config.lastPrice = currentPrice;

    } catch (error) {
      console.error(`Trail evaluation error for ${config.positionId}:`, error);
    }
  }

  /**
   * 利益方向の価格変動判定
   */
  private isProfitableMove(config: TrailConfig, currentPrice: number): boolean {
    if (config.direction === 'BUY') {
      return currentPrice > config.bestPrice;
    } else {
      return currentPrice < config.bestPrice;
    }
  }

  /**
   * トレール実行判定
   */
  private shouldTriggerTrail(config: TrailConfig, currentPrice: number): boolean {
    const priceMove = Math.abs(currentPrice - config.bestPrice);
    const trailThreshold = config.trailWidth * this.getPipValue(config.symbol);
    
    // 不利な方向への価格変動がトレール幅を超えた場合
    if (config.direction === 'BUY') {
      return (config.bestPrice - currentPrice) >= trailThreshold;
    } else {
      return (currentPrice - config.bestPrice) >= trailThreshold;
    }
  }

  /**
   * pips値取得（シンボル別）
   */
  private getPipValue(symbol: string): number {
    // JPY通貨ペアは0.01、その他は0.0001
    if (symbol.includes('JPY')) {
      return 0.01;
    }
    return 0.0001;
  }

  /**
   * トレール実行
   */
  private async executeTrail(config: TrailConfig, triggerPrice: number): Promise<void> {
    try {
      // 1. トレール設定を非アクティブ化
      config.isActive = false;
      this.stats.activeTrails--;

      // 2. トレール用Action作成
      await this.createTrailAction(config.positionId, triggerPrice);

      // 3. ポジション状態更新
      await this.updatePositionStatus(config.positionId, PositionStatus.CLOSING);

      this.stats.totalTrailsExecuted++;
      console.log(`✅ Trail executed for position: ${config.positionId} at price: ${triggerPrice}`);

    } catch (error) {
      console.error(`Failed to execute trail for ${config.positionId}:`, error);
      // エラー時はトレール設定を再アクティブ化
      config.isActive = true;
      this.stats.activeTrails++;
      throw error;
    }
  }

  /**
   * ロスカット対応（設計書3-3準拠）
   * MT4からのロスカット通知に対する対応
   */
  async handleLossCut(positionId: string, lossCutPrice: number): Promise<void> {
    console.log(`💥 Handling loss cut for position: ${positionId} at price: ${lossCutPrice}`);
    
    try {
      // 1. ポジション情報取得
      const position = await this.getPosition(positionId);
      if (!position) {
        console.error(`Position not found: ${positionId}`);
        return;
      }

      // 2. ポジション状態をSTOPPEDに更新
      await this.updatePositionStatus(positionId, PositionStatus.STOPPED);

      // 3. トレール設定確認
      if (position.trailWidth && position.trailWidth > 0) {
        console.log(`🎯 Creating trail action for loss cut position: ${positionId}`);
        
        // 4. トレール実行用Action作成
        await this.createTrailAction(positionId, lossCutPrice);
      }

      // 5. 監視中のトレール設定削除
      if (this.monitoredPositions.has(positionId)) {
        this.monitoredPositions.delete(positionId);
        this.stats.activeTrails--;
      }

      this.stats.totalLossCutsHandled++;
      console.log(`✅ Loss cut handled for position: ${positionId}`);

    } catch (error) {
      console.error(`Failed to handle loss cut for ${positionId}:`, error);
      throw error;
    }
  }

  /**
   * トレール用Action作成
   */
  private async createTrailAction(positionId: string, triggerPrice: number): Promise<void> {
    const actionInput = {
      strategyId: '', // トレールActionは戦略外実行
      type: 'TRAIL',
      positionId,
      params: {
        triggerPrice,
        triggerType: 'TRAIL',
        reason: 'trail_execution',
        comment: `Trail execution at ${triggerPrice}`
      }
    };

    await this.amplifyClient.client.graphql({
      query: CREATE_TRAIL_ACTION,
      variables: { input: actionInput }
    });
  }

  /**
   * ポジション取得
   */
  private async getPosition(positionId: string): Promise<Position | null> {
    return await this.amplifyClient.getPosition(positionId);
  }

  /**
   * ポジション状態更新
   */
  private async updatePositionStatus(
    positionId: string, 
    status: PositionStatus
  ): Promise<void> {
    await this.amplifyClient.client.graphql({
      query: UPDATE_POSITION_STATUS,
      variables: { positionId, status }
    });
  }

  /**
   * ポジション方向取得
   */
  private getPositionDirection(position: Position): 'BUY' | 'SELL' {
    // 実際の実装ではPositionの詳細情報から方向を取得
    // 暫定的にvolumeの符号で判定
    return position.volume > 0 ? 'BUY' : 'SELL';
  }

  /**
   * トレール監視停止
   */
  async stopTrailMonitoring(positionId: string): Promise<void> {
    const config = this.monitoredPositions.get(positionId);
    if (config) {
      config.isActive = false;
      this.monitoredPositions.delete(positionId);
      this.stats.activeTrails--;
      console.log(`⏹️ Trail monitoring stopped for position: ${positionId}`);
    }
  }

  /**
   * 全トレール監視停止
   */
  async stopAllTrailMonitoring(): Promise<void> {
    console.log('🛑 Stopping all trail monitoring...');
    
    for (const [positionId] of this.monitoredPositions) {
      await this.stopTrailMonitoring(positionId);
    }
    
    // 価格監視停止
    this.priceSubscriptions.clear();
    this.isRunning = false;
    
    console.log('✅ All trail monitoring stopped');
  }

  /**
   * トレールエンジン開始
   */
  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🚀 Trail Engine started');
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      monitoredPositions: this.monitoredPositions.size,
      priceSubscriptions: this.priceSubscriptions.size
    };
  }

  /**
   * アクティブなトレール一覧取得
   */
  getActiveTrails(): TrailConfig[] {
    return Array.from(this.monitoredPositions.values())
      .filter(config => config.isActive);
  }
}
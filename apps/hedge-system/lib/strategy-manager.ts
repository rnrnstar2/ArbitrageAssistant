import { 
  Strategy, 
  Position,
  CreateStrategyInput,
  UpdateStrategyInput,
  PositionStatus
} from '@repo/shared-types';
import { AmplifyGraphQLClient } from './amplify-client.js';
import { RealtimeSync } from './realtime-sync.js';
import { DataFilter } from './data-filter.js';

interface StrategyManagerOptions {
  enableRealtime?: boolean;
  enableDataFiltering?: boolean;
  enableAutoValidation?: boolean;
  maxPositionsPerStrategy?: number;
}

interface StrategyMetrics {
  totalPositions: number;
  activePositions: number;
  closedPositions: number;
  totalProfit?: number;
  winRate?: number;
  averageHoldTime?: number;
}

export class StrategyManager {
  private strategies: Map<string, Strategy> = new Map();
  private strategyMetrics: Map<string, StrategyMetrics> = new Map();
  private amplifyClient: AmplifyGraphQLClient;
  private realtimeSync: RealtimeSync;
  private dataFilter: DataFilter;
  private options: StrategyManagerOptions;
  private subscriptions: (() => void)[] = [];
  
  constructor(
    amplifyClient: AmplifyGraphQLClient,
    options: StrategyManagerOptions = {}
  ) {
    this.amplifyClient = amplifyClient;
    this.realtimeSync = new RealtimeSync(amplifyClient);
    this.dataFilter = new DataFilter({
      enableSensitiveDataFilter: options.enableDataFiltering !== false
    });
    
    this.options = {
      enableRealtime: true,
      enableDataFiltering: true,
      enableAutoValidation: true,
      maxPositionsPerStrategy: 10,
      ...options
    };
    
    if (this.options.enableRealtime) {
      this.setupSubscriptions();
    }
  }
  
  private setupSubscriptions(): void {
    // 戦略更新監視
    const strategyUpdateSub = this.realtimeSync.subscribeToStrategyUpdates().subscribe({
      next: (strategy) => this.handleStrategyUpdate(strategy),
      error: (error) => console.error('Strategy update subscription error:', error)
    });
    this.subscriptions.push(() => strategyUpdateSub.unsubscribe());
    
    // 新規戦略監視
    const newStrategySub = this.realtimeSync.subscribeToNewStrategies().subscribe({
      next: (strategy) => this.handleNewStrategy(strategy),
      error: (error) => console.error('New strategy subscription error:', error)
    });
    this.subscriptions.push(() => newStrategySub.unsubscribe());
  }
  
  private handleStrategyUpdate(strategy: Strategy): void {
    console.log(`Strategy updated: ${strategy.strategyId}`);
    
    const filtered = this.options.enableDataFiltering 
      ? this.dataFilter.filterStrategyData(strategy)
      : strategy;
    
    this.strategies.set(strategy.strategyId, filtered);
    this.updateStrategyMetrics(strategy.strategyId);
  }
  
  private handleNewStrategy(strategy: Strategy): void {
    console.log(`New strategy created: ${strategy.strategyId}`);
    
    const filtered = this.options.enableDataFiltering 
      ? this.dataFilter.filterStrategyData(strategy)
      : strategy;
    
    this.strategies.set(strategy.strategyId, filtered);
    this.initializeStrategyMetrics(strategy.strategyId);
  }
  
  // 戦略CRUD操作
  async createStrategy(input: CreateStrategyInput): Promise<Strategy> {
    if (this.options.enableAutoValidation) {
      this.validateStrategyInput(input);
    }
    
    // データフィルタリング
    const filteredInput = this.options.enableDataFiltering 
      ? this.dataFilter.filterSensitiveData(input)
      : input;
    
    const strategy = await this.amplifyClient.createStrategy(filteredInput);
    
    // ローカルキャッシュに追加
    this.strategies.set(strategy.strategyId, strategy);
    this.initializeStrategyMetrics(strategy.strategyId);
    
    console.log(`Strategy created: ${strategy.strategyId}`);
    return strategy;
  }
  
  async updateStrategy(input: UpdateStrategyInput): Promise<Strategy> {
    if (this.options.enableAutoValidation) {
      await this.validateStrategyUpdate(input);
    }
    
    const filteredInput = this.options.enableDataFiltering 
      ? this.dataFilter.filterSensitiveData(input)
      : input;
    
    const strategy = await this.amplifyClient.updateStrategy(filteredInput);
    
    // ローカルキャッシュを更新
    this.strategies.set(strategy.strategyId, strategy);
    
    console.log(`Strategy updated: ${strategy.strategyId}`);
    return strategy;
  }
  
  async getStrategy(strategyId: string): Promise<Strategy | undefined> {
    // ローカルキャッシュを確認
    let strategy = this.strategies.get(strategyId);
    
    if (!strategy) {
      // GraphQLから取得
      strategy = await this.amplifyClient.getStrategy(strategyId) || undefined;
      if (strategy) {
        const filtered = this.options.enableDataFiltering 
          ? this.dataFilter.filterStrategyData(strategy)
          : strategy;
        this.strategies.set(strategyId, filtered);
      }
    }
    
    return strategy || undefined;
  }
  
  async listStrategies(forceRefresh: boolean = false): Promise<Strategy[]> {
    if (forceRefresh || this.strategies.size === 0) {
      const strategies = await this.amplifyClient.listStrategies();
      
      // ローカルキャッシュを更新
      this.strategies.clear();
      for (const strategy of strategies) {
        const filtered = this.options.enableDataFiltering 
          ? this.dataFilter.filterStrategyData(strategy)
          : strategy;
        this.strategies.set(strategy.strategyId, filtered);
      }
      
      console.log(`Loaded ${strategies.length} strategies`);
    }
    
    return Array.from(this.strategies.values());
  }
  
  async deleteStrategy(strategyId: string): Promise<void> {
    // 関連するポジションの確認
    const positions = await this.amplifyClient.listPositions({
      strategyId: { eq: strategyId }
    });
    
    const activePositions = positions.filter(p => 
      p.status === PositionStatus.OPEN || p.status === PositionStatus.PENDING
    );
    
    if (activePositions.length > 0) {
      throw new Error(`Cannot delete strategy with ${activePositions.length} active positions`);
    }
    
    // GraphQLからの削除は実装依存
    // await this.amplifyClient.deleteStrategy(strategyId);
    
    // ローカルキャッシュから削除
    this.strategies.delete(strategyId);
    this.strategyMetrics.delete(strategyId);
    
    console.log(`Strategy deleted: ${strategyId}`);
  }
  
  // 戦略のバリデーション
  private validateStrategyInput(input: CreateStrategyInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Strategy name is required');
    }
    
    if (!input.trailWidth || input.trailWidth <= 0) {
      throw new Error('Trail width must be greater than 0');
    }
    
    if (input.maxRisk && input.maxRisk <= 0) {
      throw new Error('Max risk must be greater than 0');
    }
  }
  
  private async validateStrategyUpdate(input: UpdateStrategyInput): Promise<void> {
    const existingStrategy = await this.getStrategy(input.strategyId);
    if (!existingStrategy) {
      throw new Error(`Strategy not found: ${input.strategyId}`);
    }
    
    if (input.trailWidth && input.trailWidth <= 0) {
      throw new Error('Trail width must be greater than 0');
    }
    
    if (input.maxRisk && input.maxRisk <= 0) {
      throw new Error('Max risk must be greater than 0');
    }
  }
  
  // メトリクス管理
  private initializeStrategyMetrics(strategyId: string): void {
    this.strategyMetrics.set(strategyId, {
      totalPositions: 0,
      activePositions: 0,
      closedPositions: 0,
      totalProfit: 0,
      winRate: 0,
      averageHoldTime: 0
    });
  }
  
  private async updateStrategyMetrics(strategyId: string): Promise<void> {
    try {
      const positions = await this.amplifyClient.listPositions({
        strategyId: { eq: strategyId }
      });
      
      const metrics: StrategyMetrics = {
        totalPositions: positions.length,
        activePositions: positions.filter(p => p.status === PositionStatus.OPEN).length,
        closedPositions: positions.filter(p => p.status === PositionStatus.CLOSED).length
      };
      
      // 追加のメトリクス計算
      const closedPositions = positions.filter(p => 
        p.status === PositionStatus.CLOSED && p.entryPrice && p.exitPrice
      );
      
      if (closedPositions.length > 0) {
        metrics.totalProfit = closedPositions.reduce((sum, pos) => {
          const profit = (pos.exitPrice! - pos.entryPrice!) * pos.volume;
          return sum + profit;
        }, 0);
        
        const winningPositions = closedPositions.filter(pos => 
          (pos.exitPrice! - pos.entryPrice!) > 0
        );
        metrics.winRate = winningPositions.length / closedPositions.length;
        
        // 平均保有時間の計算
        const totalHoldTime = closedPositions.reduce((sum, pos) => {
          if (pos.entryTime && pos.exitTime) {
            return sum + (pos.exitTime.getTime() - pos.entryTime.getTime());
          }
          return sum;
        }, 0);
        metrics.averageHoldTime = totalHoldTime / closedPositions.length;
      }
      
      this.strategyMetrics.set(strategyId, metrics);
      
    } catch (error) {
      console.error(`Failed to update metrics for strategy ${strategyId}:`, error);
    }
  }
  
  // 戦略パフォーマンス分析
  async getStrategyMetrics(strategyId: string): Promise<StrategyMetrics | null> {
    let metrics = this.strategyMetrics.get(strategyId);
    
    if (!metrics) {
      await this.updateStrategyMetrics(strategyId);
      metrics = this.strategyMetrics.get(strategyId);
    }
    
    return metrics || null;
  }
  
  async refreshAllMetrics(): Promise<void> {
    const strategies = Array.from(this.strategies.keys());
    
    for (const strategyId of strategies) {
      await this.updateStrategyMetrics(strategyId);
    }
    
    console.log(`Refreshed metrics for ${strategies.length} strategies`);
  }
  
  // 戦略の操作可能性チェック
  async canDeleteStrategy(strategyId: string): Promise<boolean> {
    try {
      const positions = await this.amplifyClient.listPositions({
        strategyId: { eq: strategyId }
      });
      
      const activePositions = positions.filter(p => 
        p.status === PositionStatus.OPEN || p.status === PositionStatus.PENDING
      );
      
      return activePositions.length === 0;
    } catch (error) {
      console.error(`Failed to check if strategy can be deleted: ${strategyId}`, error);
      return false;
    }
  }
  
  async canModifyStrategy(strategyId: string): Promise<boolean> {
    try {
      const metrics = await this.getStrategyMetrics(strategyId);
      return metrics ? metrics.activePositions === 0 : true;
    } catch (error) {
      console.error(`Failed to check if strategy can be modified: ${strategyId}`, error);
      return false;
    }
  }
  
  // ユーティリティメソッド
  getStrategyCount(): number {
    return this.strategies.size;
  }
  
  getActiveStrategyCount(): number {
    return Array.from(this.strategyMetrics.values())
      .filter(metrics => metrics.activePositions > 0).length;
  }
  
  getAllMetrics(): Map<string, StrategyMetrics> {
    return new Map(this.strategyMetrics);
  }
  
  // 設定管理
  updateOptions(newOptions: Partial<StrategyManagerOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log('Strategy manager options updated:', newOptions);
  }
  
  // クリーンアップ
  dispose(): void {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
    this.strategies.clear();
    this.strategyMetrics.clear();
    this.dataFilter.dispose();
  }
}
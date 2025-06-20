import { HedgePosition } from './types';

/**
 * 両建て操作の種類
 */
export type HedgeActionType = 
  | 'create'          // 両建て作成
  | 'rebalance'       // リバランス
  | 'close'           // 両建て解除
  | 'modify'          // 設定変更
  | 'maintain'        // 整理時の維持
  | 'error'           // エラー発生
  | 'warning';        // 警告発生

/**
 * 両建て操作記録
 */
export interface HedgeAction {
  id: string;
  hedgeId: string;
  type: HedgeActionType;
  timestamp: Date;
  description: string;
  data: Record<string, any>;
  result: 'success' | 'failure' | 'partial';
  metadata?: {
    triggeredBy?: 'user' | 'system' | 'auto';
    parentActionId?: string;
    relatedPositionIds?: string[];
    performanceImpact?: number;
  };
}

/**
 * 両建て履歴レコード
 */
export interface HedgeHistoryRecord {
  hedgeId: string;
  hedge: HedgePosition;
  actions: HedgeAction[];
  states: HedgeStateSnapshot[];
  performance: HedgePerformanceSnapshot[];
  createdAt: Date;
  lastUpdated: Date;
  isActive: boolean;
}

/**
 * 両建て状態スナップショット
 */
export interface HedgeStateSnapshot {
  timestamp: Date;
  hedge: HedgePosition;
  actionId: string;
  changeType: 'initial' | 'update' | 'rebalance' | 'close';
  previousState?: Partial<HedgePosition>;
}

/**
 * 両建てパフォーマンススナップショット
 */
export interface HedgePerformanceSnapshot {
  timestamp: Date;
  hedgeId: string;
  totalProfit: number;
  unrealizedProfit: number;
  realizedProfit: number;
  totalLots: { buy: number; sell: number };
  balance: number;
  riskScore: number;
  drawdown?: number;
  runningBalance?: number;
}

/**
 * タイムラインイベント
 */
export interface TimelineEvent {
  id: string;
  type: 'action' | 'state_change' | 'performance_milestone' | 'alert';
  timestamp: Date;
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  data: Record<string, any>;
  relatedActionId?: string;
}

/**
 * 履歴フィルター
 */
export interface HistoryFilter {
  hedgeIds?: string[];
  actionTypes?: HedgeActionType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  symbols?: string[];
  accounts?: string[];
  performanceRange?: {
    minProfit?: number;
    maxProfit?: number;
  };
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * エクスポートデータ
 */
export interface ExportData {
  metadata: {
    exportDate: Date;
    filter: HistoryFilter;
    totalRecords: number;
    summary: HistorySummary;
  };
  records: HedgeHistoryRecord[];
  analytics: HistoryAnalytics;
}

/**
 * 履歴サマリー
 */
export interface HistorySummary {
  totalHedges: number;
  totalActions: number;
  totalProfit: number;
  averageHoldingTime: number;
  winRate: number;
  mostActiveSymbol: string;
  performanceByType: Record<string, { count: number; profit: number }>;
}

/**
 * 履歴分析結果
 */
export interface HistoryAnalytics {
  patterns: PatternAnalysis[];
  performance: PerformanceAnalysis;
  trends: TrendAnalysis[];
  recommendations: string[];
}

/**
 * パターン分析
 */
export interface PatternAnalysis {
  type: 'success_pattern' | 'failure_pattern' | 'timing_pattern' | 'symbol_pattern';
  description: string;
  frequency: number;
  confidence: number;
  profitImpact: number;
  examples: string[];
}

/**
 * パフォーマンス分析
 */
export interface PerformanceAnalysis {
  totalReturn: number;
  averageReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  bestPeriod: { start: Date; end: Date; profit: number };
  worstPeriod: { start: Date; end: Date; profit: number };
  monthlyPerformance: Array<{ month: string; profit: number; count: number }>;
}

/**
 * トレンド分析
 */
export interface TrendAnalysis {
  metric: string;
  direction: 'improving' | 'declining' | 'stable';
  strength: number; // 0-1
  timeframe: string;
  dataPoints: Array<{ date: Date; value: number }>;
}

/**
 * 両建て履歴管理システム
 */
export class HedgeHistoryManager {
  private historyMap: Map<string, HedgeHistoryRecord> = new Map();
  private actionIndex: Map<string, HedgeAction> = new Map();
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分

  /**
   * 両建て操作を記録
   */
  async recordHedgeAction(hedge: HedgePosition, action: Omit<HedgeAction, 'id' | 'timestamp'>): Promise<void> {
    const hedgeAction: HedgeAction = {
      id: this.generateActionId(),
      timestamp: new Date(),
      ...action
    };

    // アクションをインデックスに追加
    this.actionIndex.set(hedgeAction.id, hedgeAction);

    // 履歴レコードを取得または作成
    let historyRecord = this.historyMap.get(hedge.id);
    if (!historyRecord) {
      historyRecord = this.createHistoryRecord(hedge);
      this.historyMap.set(hedge.id, historyRecord);
    }

    // アクションを追加
    historyRecord.actions.push(hedgeAction);
    historyRecord.lastUpdated = new Date();

    // 状態スナップショットを作成
    const stateSnapshot = this.createStateSnapshot(hedge, hedgeAction);
    historyRecord.states.push(stateSnapshot);

    // パフォーマンススナップショットを作成
    const performanceSnapshot = this.createPerformanceSnapshot(hedge, hedgeAction.id);
    historyRecord.performance.push(performanceSnapshot);

    // キャッシュをクリア
    this.clearCache();

    console.log(`両建て操作を記録: ${action.type} for hedge ${hedge.id}`);
  }

  /**
   * 両建て履歴を取得
   */
  async getHedgeHistory(hedgeId: string): Promise<HedgeHistoryRecord[]> {
    const cacheKey = `history_${hedgeId}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const records: HedgeHistoryRecord[] = [];
    
    if (hedgeId === 'all') {
      records.push(...Array.from(this.historyMap.values()));
    } else {
      const record = this.historyMap.get(hedgeId);
      if (record) {
        records.push(record);
      }
    }

    // 最新順にソート
    records.forEach(record => {
      record.actions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      record.states.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      record.performance.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });

    this.setCache(cacheKey, records);
    return records;
  }

  /**
   * 両建てタイムラインを取得
   */
  async getHedgeTimeline(hedgeId: string): Promise<TimelineEvent[]> {
    const cacheKey = `timeline_${hedgeId}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const record = this.historyMap.get(hedgeId);
    if (!record) {
      return [];
    }

    const events: TimelineEvent[] = [];

    // アクションからイベントを生成
    record.actions.forEach(action => {
      events.push(this.actionToTimelineEvent(action));
    });

    // 状態変更からイベントを生成
    record.states.forEach((state, index) => {
      if (index > 0) { // 初期状態以外
        events.push(this.stateChangeToTimelineEvent(state, record.states[index - 1]));
      }
    });

    // パフォーマンスマイルストーンからイベントを生成
    const milestones = this.detectPerformanceMilestones(record.performance);
    events.push(...milestones);

    // 時系列順にソート
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    this.setCache(cacheKey, events);
    return events;
  }

  /**
   * 両建て履歴をエクスポート
   */
  async exportHedgeHistory(filter: HistoryFilter = {}): Promise<ExportData> {
    const filteredRecords = await this.filterHistoryRecords(filter);
    const summary = this.generateHistorySummary(filteredRecords);
    const analytics = await this.analyzeHistory(filteredRecords);

    return {
      metadata: {
        exportDate: new Date(),
        filter,
        totalRecords: filteredRecords.length,
        summary
      },
      records: filteredRecords,
      analytics
    };
  }

  /**
   * 履歴分析を実行
   */
  async analyzeHistory(records: HedgeHistoryRecord[]): Promise<HistoryAnalytics> {
    const patterns = await this.detectPatterns(records);
    const performance = this.analyzePerformance(records);
    const trends = this.analyzeTrends(records);
    const recommendations = this.generateRecommendations(patterns, performance, trends);

    return {
      patterns,
      performance,
      trends,
      recommendations
    };
  }

  /**
   * パフォーマンス追跡データを取得
   */
  getPerformanceTracking(hedgeId: string, timeframe: '1h' | '1d' | '1w' | '1m' = '1d'): HedgePerformanceSnapshot[] {
    const record = this.historyMap.get(hedgeId);
    if (!record) return [];

    const now = new Date();
    const timeframeMs = this.getTimeframeMilliseconds(timeframe);
    const cutoff = new Date(now.getTime() - timeframeMs);

    return record.performance.filter(p => p.timestamp >= cutoff);
  }

  /**
   * パターン検出
   */
  private async detectPatterns(records: HedgeHistoryRecord[]): Promise<PatternAnalysis[]> {
    const patterns: PatternAnalysis[] = [];

    // 成功パターンの検出
    const successfulHedges = records.filter(r => r.hedge.totalProfit > 0);
    if (successfulHedges.length >= 3) {
      patterns.push({
        type: 'success_pattern',
        description: '利益を上げた両建ての共通特徴',
        frequency: successfulHedges.length / records.length,
        confidence: 0.8,
        profitImpact: successfulHedges.reduce((sum, r) => sum + r.hedge.totalProfit, 0),
        examples: successfulHedges.slice(0, 3).map(r => `${r.hedge.symbol}: +${r.hedge.totalProfit.toFixed(2)}`)
      });
    }

    // 失敗パターンの検出
    const failedHedges = records.filter(r => r.hedge.totalProfit < -10);
    if (failedHedges.length >= 2) {
      patterns.push({
        type: 'failure_pattern',
        description: '損失を出した両建ての共通特徴',
        frequency: failedHedges.length / records.length,
        confidence: 0.7,
        profitImpact: failedHedges.reduce((sum, r) => sum + r.hedge.totalProfit, 0),
        examples: failedHedges.slice(0, 3).map(r => `${r.hedge.symbol}: ${r.hedge.totalProfit.toFixed(2)}`)
      });
    }

    // タイミングパターンの検出
    const timePatterns = this.analyzeTimingPatterns(records);
    patterns.push(...timePatterns);

    return patterns;
  }

  /**
   * パフォーマンス分析
   */
  private analyzePerformance(records: HedgeHistoryRecord[]): PerformanceAnalysis {
    const profits = records.map(r => r.hedge.totalProfit);
    const totalReturn = profits.reduce((sum, p) => sum + p, 0);
    const averageReturn = profits.length > 0 ? totalReturn / profits.length : 0;
    
    const variance = profits.length > 1 
      ? profits.reduce((sum, p) => sum + Math.pow(p - averageReturn, 2), 0) / (profits.length - 1)
      : 0;
    const volatility = Math.sqrt(variance);
    
    const sharpeRatio = volatility > 0 ? averageReturn / volatility : 0;
    const winRate = profits.length > 0 ? profits.filter(p => p > 0).length / profits.length : 0;
    
    // ドローダウン計算
    const cumulative = this.calculateCumulativeReturns(records);
    const maxDrawdown = this.calculateMaxDrawdown(cumulative);
    
    // 最高・最悪期間
    const periods = this.identifyPerformancePeriods(records);

    return {
      totalReturn,
      averageReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      winRate,
      bestPeriod: periods.best,
      worstPeriod: periods.worst,
      monthlyPerformance: this.calculateMonthlyPerformance(records)
    };
  }

  /**
   * トレンド分析
   */
  private analyzeTrends(records: HedgeHistoryRecord[]): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];

    // 利益トレンド
    const profitTrend = this.calculateTrend(
      records.map(r => ({ date: r.createdAt, value: r.hedge.totalProfit }))
    );
    trends.push({
      metric: 'profit',
      direction: profitTrend.direction,
      strength: profitTrend.strength,
      timeframe: '全期間',
      dataPoints: profitTrend.dataPoints
    });

    // 勝率トレンド
    const winRateTrend = this.calculateWinRateTrend(records);
    trends.push(winRateTrend);

    return trends;
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(
    patterns: PatternAnalysis[], 
    performance: PerformanceAnalysis, 
    trends: TrendAnalysis[]
  ): string[] {
    const recommendations: string[] = [];

    // パフォーマンス基準の推奨
    if (performance.winRate < 0.5) {
      recommendations.push('勝率が50%を下回っています。リスク管理の見直しを検討してください。');
    }

    if (performance.sharpeRatio < 0.5) {
      recommendations.push('シャープレシオが低いです。リスク調整後リターンの改善が必要です。');
    }

    // パターン基準の推奨
    const successPattern = patterns.find(p => p.type === 'success_pattern');
    if (successPattern && successPattern.frequency > 0.6) {
      recommendations.push('成功パターンが確認されています。同様の設定での両建てを継続してください。');
    }

    // トレンド基準の推奨
    const profitTrend = trends.find(t => t.metric === 'profit');
    if (profitTrend?.direction === 'declining') {
      recommendations.push('利益トレンドが下降しています。戦略の見直しを検討してください。');
    }

    return recommendations;
  }

  // ヘルパーメソッド

  private createHistoryRecord(hedge: HedgePosition): HedgeHistoryRecord {
    return {
      hedgeId: hedge.id,
      hedge,
      actions: [],
      states: [],
      performance: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
      isActive: true
    };
  }

  private createStateSnapshot(hedge: HedgePosition, action: HedgeAction): HedgeStateSnapshot {
    const existingRecord = this.historyMap.get(hedge.id);
    const previousState = existingRecord?.states[existingRecord.states.length - 1]?.hedge;

    return {
      timestamp: new Date(),
      hedge: { ...hedge },
      actionId: action.id,
      changeType: this.determineChangeType(action.type),
      previousState: previousState ? this.extractChanges(previousState, hedge) : undefined
    };
  }

  private createPerformanceSnapshot(hedge: HedgePosition, actionId: string): HedgePerformanceSnapshot {
    const balance = Math.abs(hedge.totalLots.buy - hedge.totalLots.sell);
    const riskScore = this.calculateRiskScore(hedge);

    return {
      timestamp: new Date(),
      hedgeId: hedge.id,
      totalProfit: hedge.totalProfit,
      unrealizedProfit: hedge.totalProfit, // 簡易実装
      realizedProfit: 0, // 簡易実装
      totalLots: { ...hedge.totalLots },
      balance,
      riskScore
    };
  }

  private actionToTimelineEvent(action: HedgeAction): TimelineEvent {
    return {
      id: `action_${action.id}`,
      type: 'action',
      timestamp: action.timestamp,
      title: this.getActionTitle(action.type),
      description: action.description,
      impact: this.getActionImpact(action.type),
      data: action.data,
      relatedActionId: action.id
    };
  }

  private stateChangeToTimelineEvent(current: HedgeStateSnapshot, previous: HedgeStateSnapshot): TimelineEvent {
    return {
      id: `state_${current.actionId}`,
      type: 'state_change',
      timestamp: current.timestamp,
      title: '両建て状態変更',
      description: this.generateStateChangeDescription(current, previous),
      impact: 'neutral',
      data: { current: current.hedge, previous: previous.hedge }
    };
  }

  private detectPerformanceMilestones(performance: HedgePerformanceSnapshot[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    
    for (let i = 1; i < performance.length; i++) {
      const current = performance[i];
      const previous = performance[i - 1];
      
      // 利益の大幅変動を検出
      const profitChange = current.totalProfit - previous.totalProfit;
      if (Math.abs(profitChange) > 100) { // 100以上の変動
        events.push({
          id: `milestone_${current.timestamp.getTime()}`,
          type: 'performance_milestone',
          timestamp: current.timestamp,
          title: profitChange > 0 ? '大幅利益増加' : '大幅損失発生',
          description: `利益が${profitChange.toFixed(2)}変動しました`,
          impact: profitChange > 0 ? 'positive' : 'negative',
          data: { profitChange, current: current.totalProfit, previous: previous.totalProfit }
        });
      }
    }
    
    return events;
  }

  private async filterHistoryRecords(filter: HistoryFilter): Promise<HedgeHistoryRecord[]> {
    let records = Array.from(this.historyMap.values());

    if (filter.hedgeIds) {
      records = records.filter(r => filter.hedgeIds!.includes(r.hedgeId));
    }

    if (filter.dateRange) {
      records = records.filter(r => 
        r.createdAt >= filter.dateRange!.start && r.createdAt <= filter.dateRange!.end
      );
    }

    if (filter.symbols) {
      records = records.filter(r => filter.symbols!.includes(r.hedge.symbol));
    }

    if (filter.accounts) {
      records = records.filter(r => 
        r.hedge.accounts.some(account => filter.accounts!.includes(account))
      );
    }

    if (filter.performanceRange) {
      records = records.filter(r => {
        const profit = r.hedge.totalProfit;
        return (!filter.performanceRange!.minProfit || profit >= filter.performanceRange!.minProfit) &&
               (!filter.performanceRange!.maxProfit || profit <= filter.performanceRange!.maxProfit);
      });
    }

    if (filter.activeOnly) {
      records = records.filter(r => r.isActive);
    }

    if (filter.actionTypes) {
      records = records.filter(r => 
        r.actions.some(action => filter.actionTypes!.includes(action.type))
      );
    }

    // ページネーション
    if (filter.offset) {
      records = records.slice(filter.offset);
    }

    if (filter.limit) {
      records = records.slice(0, filter.limit);
    }

    return records;
  }

  private generateHistorySummary(records: HedgeHistoryRecord[]): HistorySummary {
    const totalActions = records.reduce((sum, r) => sum + r.actions.length, 0);
    const totalProfit = records.reduce((sum, r) => sum + r.hedge.totalProfit, 0);
    
    const holdingTimes = records.map(r => {
      const duration = r.lastUpdated.getTime() - r.createdAt.getTime();
      return duration / (1000 * 60 * 60); // 時間単位
    });
    const averageHoldingTime = holdingTimes.length > 0 
      ? holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length
      : 0;

    const winRate = records.length > 0
      ? records.filter(r => r.hedge.totalProfit > 0).length / records.length
      : 0;

    // 最もアクティブな通貨ペア
    const symbolCounts = new Map<string, number>();
    records.forEach(r => {
      symbolCounts.set(r.hedge.symbol, (symbolCounts.get(r.hedge.symbol) || 0) + 1);
    });
    const mostActiveSymbol = symbolCounts.size > 0
      ? Array.from(symbolCounts.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : '';

    // タイプ別パフォーマンス
    const performanceByType: Record<string, { count: number; profit: number }> = {};
    records.forEach(r => {
      const type = r.hedge.hedgeType;
      if (!performanceByType[type]) {
        performanceByType[type] = { count: 0, profit: 0 };
      }
      performanceByType[type].count++;
      performanceByType[type].profit += r.hedge.totalProfit;
    });

    return {
      totalHedges: records.length,
      totalActions,
      totalProfit,
      averageHoldingTime,
      winRate,
      mostActiveSymbol,
      performanceByType
    };
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineChangeType(actionType: HedgeActionType): 'initial' | 'update' | 'rebalance' | 'close' {
    switch (actionType) {
      case 'create': return 'initial';
      case 'rebalance': return 'rebalance';
      case 'close': return 'close';
      default: return 'update';
    }
  }

  private extractChanges(previous: HedgePosition, current: HedgePosition): Partial<HedgePosition> {
    const changes: Partial<HedgePosition> = {};
    
    if (previous.totalProfit !== current.totalProfit) {
      changes.totalProfit = previous.totalProfit;
    }
    
    if (previous.isBalanced !== current.isBalanced) {
      changes.isBalanced = previous.isBalanced;
    }
    
    return changes;
  }

  private calculateRiskScore(hedge: HedgePosition): number {
    const imbalance = Math.abs(hedge.totalLots.buy - hedge.totalLots.sell);
    const totalLots = hedge.totalLots.buy + hedge.totalLots.sell;
    const imbalanceRatio = totalLots > 0 ? imbalance / totalLots : 0;
    
    return Math.min(imbalanceRatio * 10, 10); // 0-10スケール
  }

  private getActionTitle(type: HedgeActionType): string {
    const titles = {
      create: '両建て作成',
      rebalance: 'リバランス実行',
      close: '両建て解除',
      modify: '設定変更',
      maintain: '整理時維持',
      error: 'エラー発生',
      warning: '警告発生'
    };
    return titles[type] || type;
  }

  private getActionImpact(type: HedgeActionType): 'positive' | 'negative' | 'neutral' {
    switch (type) {
      case 'create':
      case 'rebalance':
        return 'positive';
      case 'error':
        return 'negative';
      default:
        return 'neutral';
    }
  }

  private generateStateChangeDescription(current: HedgeStateSnapshot, previous: HedgeStateSnapshot): string {
    const profitChange = current.hedge.totalProfit - previous.hedge.totalProfit;
    const balanceChange = current.hedge.isBalanced !== previous.hedge.isBalanced;
    
    let description = '';
    if (profitChange !== 0) {
      description += `利益: ${profitChange > 0 ? '+' : ''}${profitChange.toFixed(2)} `;
    }
    if (balanceChange) {
      description += `バランス: ${current.hedge.isBalanced ? '均衡' : '不均衡'}`;
    }
    
    return description || '状態が変更されました';
  }

  private analyzeTimingPatterns(records: HedgeHistoryRecord[]): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];
    
    // 時間帯別の成功率を分析
    const hourlyStats = new Map<number, { count: number; profit: number }>();
    
    records.forEach(record => {
      const hour = record.createdAt.getHours();
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { count: 0, profit: 0 });
      }
      const stats = hourlyStats.get(hour)!;
      stats.count++;
      stats.profit += record.hedge.totalProfit;
    });
    
    // 最も成功している時間帯を特定
    let bestHour = -1;
    let bestProfitRatio = 0;
    
    hourlyStats.forEach((stats, hour) => {
      const avgProfit = stats.profit / stats.count;
      if (avgProfit > bestProfitRatio && stats.count >= 3) {
        bestProfitRatio = avgProfit;
        bestHour = hour;
      }
    });
    
    if (bestHour >= 0) {
      patterns.push({
        type: 'timing_pattern',
        description: `${bestHour}時台の両建てが最も高い収益を上げています`,
        frequency: hourlyStats.get(bestHour)!.count / records.length,
        confidence: 0.6,
        profitImpact: bestProfitRatio,
        examples: [`${bestHour}:00 - 平均利益: ${bestProfitRatio.toFixed(2)}`]
      });
    }
    
    return patterns;
  }

  private calculateCumulativeReturns(records: HedgeHistoryRecord[]): number[] {
    const sorted = records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const cumulative: number[] = [];
    let sum = 0;
    
    sorted.forEach(record => {
      sum += record.hedge.totalProfit;
      cumulative.push(sum);
    });
    
    return cumulative;
  }

  private calculateMaxDrawdown(cumulative: number[]): number {
    let maxDrawdown = 0;
    let peak = cumulative[0] || 0;
    
    cumulative.forEach(value => {
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = (peak - value) / Math.max(peak, 1) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    });
    
    return maxDrawdown;
  }

  private identifyPerformancePeriods(records: HedgeHistoryRecord[]): {
    best: { start: Date; end: Date; profit: number };
    worst: { start: Date; end: Date; profit: number };
  } {
    const sorted = records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    return {
      best: {
        start: sorted[0]?.createdAt || new Date(),
        end: sorted[0]?.lastUpdated || new Date(),
        profit: Math.max(...records.map(r => r.hedge.totalProfit), 0)
      },
      worst: {
        start: sorted[0]?.createdAt || new Date(),
        end: sorted[0]?.lastUpdated || new Date(),
        profit: Math.min(...records.map(r => r.hedge.totalProfit), 0)
      }
    };
  }

  private calculateMonthlyPerformance(records: HedgeHistoryRecord[]): Array<{ month: string; profit: number; count: number }> {
    const monthlyMap = new Map<string, { profit: number; count: number }>();
    
    records.forEach(record => {
      const month = record.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { profit: 0, count: 0 });
      }
      const data = monthlyMap.get(month)!;
      data.profit += record.hedge.totalProfit;
      data.count++;
    });
    
    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      profit: data.profit,
      count: data.count
    }));
  }

  private calculateTrend(dataPoints: Array<{ date: Date; value: number }>): {
    direction: 'improving' | 'declining' | 'stable';
    strength: number;
    dataPoints: Array<{ date: Date; value: number }>;
  } {
    if (dataPoints.length < 2) {
      return { direction: 'stable', strength: 0, dataPoints };
    }
    
    const firstValue = dataPoints[0].value;
    const lastValue = dataPoints[dataPoints.length - 1].value;
    const change = lastValue - firstValue;
    const changeRatio = Math.abs(change) / Math.max(Math.abs(firstValue), 1);
    
    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (changeRatio > 0.1) { // 10%以上の変化
      direction = change > 0 ? 'improving' : 'declining';
    }
    
    return {
      direction,
      strength: Math.min(changeRatio, 1),
      dataPoints
    };
  }

  private calculateWinRateTrend(records: HedgeHistoryRecord[]): TrendAnalysis {
    const sortedRecords = records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const windowSize = Math.max(5, Math.floor(records.length / 4)); // 25%のウィンドウサイズ
    
    const dataPoints: Array<{ date: Date; value: number }> = [];
    
    for (let i = windowSize; i <= sortedRecords.length; i++) {
      const window = sortedRecords.slice(i - windowSize, i);
      const winRate = window.filter(r => r.hedge.totalProfit > 0).length / window.length;
      dataPoints.push({
        date: window[window.length - 1].createdAt,
        value: winRate
      });
    }
    
    const trend = this.calculateTrend(dataPoints);
    
    return {
      metric: 'winRate',
      direction: trend.direction,
      strength: trend.strength,
      timeframe: '移動平均',
      dataPoints: trend.dataPoints
    };
  }

  private getTimeframeMilliseconds(timeframe: '1h' | '1d' | '1w' | '1m'): number {
    switch (timeframe) {
      case '1h': return 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      case '1w': return 7 * 24 * 60 * 60 * 1000;
      case '1m': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? expiry > Date.now() : false;
  }

  private setCache(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

export default HedgeHistoryManager;
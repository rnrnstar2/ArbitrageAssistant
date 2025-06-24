import { 
  Position, 
  PositionStatus,
  Account,
  Symbol,
  ExecutionType
} from '@repo/shared-types';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { listOpenPositions } from './graphql/queries';

// ========================================
// 型定義・インターフェース
// ========================================

export interface NetPosition {
  symbol: SymbolEnum;
  netVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  buyPositions: Position[];
  sellPositions: Position[];
  unrealizedPnL: number;
  marginUsed: number;
}

export interface HedgeAnalysis {
  accountId: string;
  netPositions: NetPosition[];
  totalNetExposure: number;
  hedgeRatio: number; // 0-1, 1が完全にヘッジされた状態
  isFullyHedged: boolean;
  suggestions: HedgeSuggestion[];
}

export interface HedgeSuggestion {
  type: 'CREATE_HEDGE' | 'CLOSE_EXCESS' | 'ADJUST_VOLUME' | 'OPTIMIZE_MARGIN';
  symbol: SymbolEnum;
  action: 'BUY' | 'SELL';
  volume: number;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedMarginImpact: number;
}

export interface CreditUtilization {
  accountId: string;
  totalCredit: number;
  usedCredit: number;
  availableCredit: number;
  utilizationRate: number; // 0-1
  positions: Position[];
  creditEfficiency: number; // クレジット効率性
}

export interface HedgeManagerStats {
  totalAccounts: number;
  monitoredPositions: number;
  hedgedAccounts: number;
  totalCreditUtilization: number;
  lastAnalysisTime: Date | null;
  analysisErrors: number;
}

// ========================================
// Hedge Manager - 両建て管理（MVPシステム設計書準拠）
// ========================================

/**
 * Hedge Manager - MVPシステム設計書準拠
 * 両建て管理・ネットポジション計算・クレジット活用最適化
 * 
 * 主要機能：
 * 1. 口座全体のポジション監視
 * 2. 両建ての動的な組み替え支援
 * 3. ネットポジションの計算
 * 4. クレジット活用状況の可視化
 * 5. 両建て最適化の提案
 */
export class HedgeManager {
  private currentUserId?: string;
  private monitoredAccounts: Set<string> = new Set();
  private lastAnalysis: Map<string, HedgeAnalysis> = new Map();
  private isMonitoring = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  
  // 統計情報
  private stats: HedgeManagerStats = {
    totalAccounts: 0,
    monitoredPositions: 0,
    hedgedAccounts: 0,
    totalCreditUtilization: 0,
    lastAnalysisTime: null,
    analysisErrors: 0
  };

  constructor() {
    this.initializeUserId();
  }

  // ========================================
  // 初期化・ライフサイクル
  // ========================================

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
      console.log('✅ HedgeManager user ID initialized:', this.currentUserId);
    } catch (error) {
      console.error('Failed to get current user ID:', error);
    }
  }

  /**
   * 監視開始
   */
  async startMonitoring(accountIds: string[]): Promise<void> {
    if (this.isMonitoring) {
      console.log('🔄 Hedge monitoring is already running');
      return;
    }

    this.monitoredAccounts = new Set(accountIds);
    this.isMonitoring = true;
    this.stats.totalAccounts = accountIds.length;
    
    // 初期分析実行
    await this.performHedgeAnalysis();
    
    // 定期分析開始
    this.startPeriodicAnalysis();
    
    console.log(`🛡️ Hedge monitoring started for ${accountIds.length} accounts:`, accountIds);
  }

  /**
   * 監視停止
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    // 定期分析停止
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    this.monitoredAccounts.clear();
    this.lastAnalysis.clear();
    
    console.log('🛑 Hedge monitoring stopped');
  }

  // ========================================
  // 両建て分析・計算
  // ========================================

  /**
   * 全口座の両建て分析実行
   */
  async performHedgeAnalysis(): Promise<HedgeAnalysis[]> {
    const analyses: HedgeAnalysis[] = [];
    
    try {
      for (const accountId of this.monitoredAccounts) {
        const analysis = await this.analyzeAccountHedge(accountId);
        analyses.push(analysis);
        this.lastAnalysis.set(accountId, analysis);
      }
      
      this.updateStats(analyses);
      this.stats.lastAnalysisTime = new Date();
      
      console.log(`📊 Hedge analysis completed for ${analyses.length} accounts`);
      
    } catch (error) {
      console.error('❌ Hedge analysis failed:', error);
      this.stats.analysisErrors++;
    }
    
    return analyses;
  }

  /**
   * 特定口座の両建て分析
   */
  async analyzeAccountHedge(accountId: string): Promise<HedgeAnalysis> {
    console.log(`🔍 Analyzing hedge for account: ${accountId}`);
    
    // 口座のオープンポジション取得
    const positions = await this.getAccountOpenPositions(accountId);
    
    // シンボル別ネットポジション計算
    const netPositions = this.calculateNetPositions(positions);
    
    // 両建て状況分析
    const totalNetExposure = this.calculateTotalNetExposure(netPositions);
    const hedgeRatio = this.calculateHedgeRatio(netPositions);
    const isFullyHedged = hedgeRatio > 0.95; // 95%以上ヘッジされていれば完全ヘッジとみなす
    
    // 最適化提案生成
    const suggestions = this.generateHedgeSuggestions(netPositions, hedgeRatio);
    
    return {
      accountId,
      netPositions,
      totalNetExposure,
      hedgeRatio,
      isFullyHedged,
      suggestions
    };
  }

  /**
   * ネットポジション計算（シンボル別）
   */
  private calculateNetPositions(positions: Position[]): NetPosition[] {
    const positionsBySymbol = new Map<SymbolEnum, Position[]>();
    
    // シンボル別にグループ化
    positions.forEach(position => {
      const symbol = position.symbol as SymbolEnum;
      if (!positionsBySymbol.has(symbol)) {
        positionsBySymbol.set(symbol, []);
      }
      positionsBySymbol.get(symbol)!.push(position);
    });
    
    // シンボル別にネットポジション計算
    const netPositions: NetPosition[] = [];
    
    for (const [symbol, symbolPositions] of positionsBySymbol) {
      const buyPositions = symbolPositions.filter(p => p.volume > 0);
      const sellPositions = symbolPositions.filter(p => p.volume < 0);
      
      const totalBuyVolume = buyPositions.reduce((sum, p) => sum + Math.abs(p.volume), 0);
      const totalSellVolume = sellPositions.reduce((sum, p) => sum + Math.abs(p.volume), 0);
      const netVolume = totalBuyVolume - totalSellVolume;
      
      // 損益計算（簡易版）
      const unrealizedPnL = this.calculateUnrealizedPnL(symbolPositions);
      const marginUsed = this.calculateMarginUsed(symbolPositions);
      
      netPositions.push({
        symbol,
        netVolume,
        totalBuyVolume,
        totalSellVolume,
        buyPositions,
        sellPositions,
        unrealizedPnL,
        marginUsed
      });
    }
    
    return netPositions;
  }

  /**
   * 総ネットエクスポージャー計算
   */
  private calculateTotalNetExposure(netPositions: NetPosition[]): number {
    return netPositions.reduce((total, net) => total + Math.abs(net.netVolume), 0);
  }

  /**
   * ヘッジ比率計算
   */
  private calculateHedgeRatio(netPositions: NetPosition[]): number {
    let totalGrossVolume = 0;
    let totalNetVolume = 0;
    
    netPositions.forEach(net => {
      const grossVolume = net.totalBuyVolume + net.totalSellVolume;
      totalGrossVolume += grossVolume;
      totalNetVolume += Math.abs(net.netVolume);
    });
    
    if (totalGrossVolume === 0) return 1; // ポジションがなければ完全ヘッジとみなす
    
    return 1 - (totalNetVolume / totalGrossVolume);
  }

  // ========================================
  // 両建て最適化提案
  // ========================================

  /**
   * ヘッジ提案生成
   */
  private generateHedgeSuggestions(netPositions: NetPosition[], hedgeRatio: number): HedgeSuggestion[] {
    const suggestions: HedgeSuggestion[] = [];
    
    // ヘッジ比率が低い場合の提案
    if (hedgeRatio < 0.8) {
      netPositions.forEach(net => {
        if (Math.abs(net.netVolume) > 0.1) { // 0.1ロット以上のネットポジションがある場合
          const hedgeVolume = Math.abs(net.netVolume);
          const hedgeAction = net.netVolume > 0 ? 'SELL' : 'BUY';
          
          suggestions.push({
            type: 'CREATE_HEDGE',
            symbol: net.symbol,
            action: hedgeAction,
            volume: hedgeVolume,
            reason: `Net ${net.netVolume > 0 ? 'long' : 'short'} exposure of ${Math.abs(net.netVolume)} lots`,
            priority: Math.abs(net.netVolume) > 1.0 ? 'HIGH' : 'MEDIUM',
            estimatedMarginImpact: this.estimateMarginImpact(net.symbol, hedgeVolume)
          });
        }
      });
    }
    
    // 過剰ポジションの整理提案
    netPositions.forEach(net => {
      const excessVolume = Math.min(net.totalBuyVolume, net.totalSellVolume);
      if (excessVolume > 2.0) { // 2ロット以上の両建てがある場合
        suggestions.push({
          type: 'CLOSE_EXCESS',
          symbol: net.symbol,
          action: 'BUY', // どちらでも良い
          volume: excessVolume * 0.5, // 半分を整理提案
          reason: `Excessive hedge volume: ${excessVolume} lots can be reduced`,
          priority: 'LOW',
          estimatedMarginImpact: -this.estimateMarginImpact(net.symbol, excessVolume * 0.5)
        });
      }
    });
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // ========================================
  // クレジット活用分析
  // ========================================

  /**
   * クレジット活用状況分析
   */
  async analyzeCreditUtilization(accountId: string): Promise<CreditUtilization> {
    // 口座情報取得
    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    
    // オープンポジション取得
    const positions = await this.getAccountOpenPositions(accountId);
    
    // クレジット使用量計算
    const usedCredit = this.calculateUsedCredit(positions, account);
    const availableCredit = Math.max(0, account.credit - usedCredit);
    const utilizationRate = account.credit > 0 ? usedCredit / account.credit : 0;
    
    // クレジット効率性計算（利益/使用クレジット）
    const totalUnrealizedPnL = positions.reduce((sum, p) => sum + this.calculatePositionPnL(p), 0);
    const creditEfficiency = usedCredit > 0 ? totalUnrealizedPnL / usedCredit : 0;
    
    return {
      accountId,
      totalCredit: account.credit,
      usedCredit,
      availableCredit,
      utilizationRate,
      positions,
      creditEfficiency
    };
  }

  /**
   * 全口座のクレジット活用分析
   */
  async analyzeAllCreditUtilization(): Promise<CreditUtilization[]> {
    const analyses: CreditUtilization[] = [];
    
    for (const accountId of this.monitoredAccounts) {
      try {
        const analysis = await this.analyzeCreditUtilization(accountId);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze credit for account ${accountId}:`, error);
      }
    }
    
    return analyses;
  }

  // ========================================
  // 動的組み替え提案
  // ========================================

  /**
   * 動的組み替え提案生成
   */
  async generateRebalanceProposal(accountId: string): Promise<{
    currentState: HedgeAnalysis;
    proposals: HedgeSuggestion[];
    expectedHedgeRatio: number;
    marginImpact: number;
  }> {
    const currentState = await this.analyzeAccountHedge(accountId);
    const creditAnalysis = await this.analyzeCreditUtilization(accountId);
    
    // クレジット効率も考慮した最適化提案
    const proposals = this.generateOptimizedSuggestions(currentState, creditAnalysis);
    
    // 提案実行後の予想ヘッジ比率計算
    const expectedHedgeRatio = this.calculateExpectedHedgeRatio(currentState, proposals);
    
    // マージン影響計算
    const marginImpact = proposals.reduce((sum, p) => sum + p.estimatedMarginImpact, 0);
    
    return {
      currentState,
      proposals,
      expectedHedgeRatio,
      marginImpact
    };
  }

  /**
   * 最適化提案生成（クレジット効率考慮）
   */
  private generateOptimizedSuggestions(
    hedgeAnalysis: HedgeAnalysis, 
    creditAnalysis: CreditUtilization
  ): HedgeSuggestion[] {
    const suggestions = [...hedgeAnalysis.suggestions];
    
    // クレジット使用率が高い場合は整理提案を優先
    if (creditAnalysis.utilizationRate > 0.8) {
      suggestions.forEach(s => {
        if (s.type === 'CLOSE_EXCESS') {
          s.priority = 'HIGH';
          s.reason += ' (High credit utilization)';
        }
      });
    }
    
    // クレジット効率が悪い場合は最適化提案
    if (creditAnalysis.creditEfficiency < 0) {
      suggestions.push({
        type: 'OPTIMIZE_MARGIN',
        symbol: 'USDJPY' as SymbolEnum, // デフォルト
        action: 'SELL',
        volume: 0,
        reason: `Poor credit efficiency: ${creditAnalysis.creditEfficiency.toFixed(4)}`,
        priority: 'MEDIUM',
        estimatedMarginImpact: 0
      });
    }
    
    return suggestions;
  }

  // ========================================
  // 定期監視・更新
  // ========================================

  /**
   * 定期分析開始
   */
  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(async () => {
      await this.performHedgeAnalysis();
    }, 30000); // 30秒間隔
  }

  /**
   * 統計情報更新
   */
  private updateStats(analyses: HedgeAnalysis[]): void {
    this.stats.totalAccounts = this.monitoredAccounts.size;
    this.stats.hedgedAccounts = analyses.filter(a => a.isFullyHedged).length;
    
    let totalPositions = 0;
    analyses.forEach(analysis => {
      analysis.netPositions.forEach(net => {
        totalPositions += net.buyPositions.length + net.sellPositions.length;
      });
    });
    
    this.stats.monitoredPositions = totalPositions;
  }

  // ========================================
  // ヘルパーメソッド・計算
  // ========================================

  /**
   * 口座のオープンポジション取得
   */
  private async getAccountOpenPositions(accountId: string): Promise<Position[]> {
    try {
      if (!this.currentUserId) {
        await this.initializeUserId();
      }
      
      const result = await amplifyClient.graphql({
        query: listOpenPositions,
        variables: { userId: this.currentUserId }
      });
      
      const allPositions = result.data.listPositions.items;
      return allPositions.filter((p: Position) => 
        p.accountId === accountId && p.status === PositionStatus.OPEN
      );
    } catch (error) {
      console.error(`Failed to get positions for account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * 口座情報取得
   */
  private async getAccount(accountId: string): Promise<Account | null> {
    try {
      // TODO: Fix schema mismatch - regenerate amplify_outputs.json
      const result = await (amplifyClient as any).models?.Account?.get({
        id: accountId
      });
      return result?.data || null;
    } catch (error) {
      console.error(`Failed to get account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * 未実現損益計算（簡易版）
   */
  private calculateUnrealizedPnL(positions: Position[]): number {
    // 簡易実装：実際はリアルタイム価格で計算する必要がある
    return positions.reduce((sum, p) => sum + this.calculatePositionPnL(p), 0);
  }

  /**
   * ポジション損益計算
   */
  private calculatePositionPnL(position: Position): number {
    // 簡易実装：現在価格がないため0を返す
    // 実際の実装では現在価格と約定価格の差から計算
    return 0;
  }

  /**
   * マージン使用量計算
   */
  private calculateMarginUsed(positions: Position[]): number {
    // 簡易実装：ボリューム * レバレッジで計算
    return positions.reduce((sum, p) => sum + Math.abs(p.volume) * 1000, 0); // 仮定: 1ロット=1000通貨単位
  }

  /**
   * 使用クレジット計算
   */
  private calculateUsedCredit(positions: Position[], account: Account): number {
    const totalMargin = this.calculateMarginUsed(positions);
    // クレジットはマージンから優先的に使用されると仮定
    return Math.min(totalMargin, account.credit);
  }

  /**
   * マージン影響見積もり
   */
  private estimateMarginImpact(symbol: SymbolEnum, volume: number): number {
    // 簡易実装：シンボルとボリュームから推定
    const baseMargin = 1000; // 1ロットあたりのベースマージン
    return volume * baseMargin;
  }

  /**
   * 予想ヘッジ比率計算
   */
  private calculateExpectedHedgeRatio(
    currentState: HedgeAnalysis, 
    proposals: HedgeSuggestion[]
  ): number {
    // 簡易実装：提案が実行された場合のヘッジ比率を推定
    let adjustedNetExposure = currentState.totalNetExposure;
    
    proposals.forEach(proposal => {
      if (proposal.type === 'CREATE_HEDGE') {
        adjustedNetExposure -= proposal.volume;
      }
    });
    
    // 簡易計算
    return Math.max(0, Math.min(1, 1 - (adjustedNetExposure / (currentState.totalNetExposure || 1))));
  }

  // ========================================
  // 外部アクセス用メソッド
  // ========================================

  /**
   * 最新の分析結果取得
   */
  getLatestAnalysis(accountId?: string): HedgeAnalysis | HedgeAnalysis[] {
    if (accountId) {
      return this.lastAnalysis.get(accountId) || this.createEmptyAnalysis(accountId);
    }
    return Array.from(this.lastAnalysis.values());
  }

  /**
   * 監視対象口座一覧取得
   */
  getMonitoredAccounts(): string[] {
    return Array.from(this.monitoredAccounts);
  }

  /**
   * 統計情報取得
   */
  getStats(): HedgeManagerStats {
    return { ...this.stats };
  }

  /**
   * ヘルスチェック
   */
  isHealthy(): boolean {
    return this.isMonitoring && this.stats.analysisErrors < 5;
  }

  /**
   * 空の分析結果作成
   */
  private createEmptyAnalysis(accountId: string): HedgeAnalysis {
    return {
      accountId,
      netPositions: [],
      totalNetExposure: 0,
      hedgeRatio: 1,
      isFullyHedged: true,
      suggestions: []
    };
  }

  /**
   * 手動分析実行
   */
  async runManualAnalysis(): Promise<HedgeAnalysis[]> {
    console.log('🔄 Manual hedge analysis started');
    const results = await this.performHedgeAnalysis();
    console.log('✅ Manual hedge analysis completed');
    return results;
  }

  /**
   * 緊急停止
   */
  async emergencyStop(): Promise<void> {
    console.warn('🚨 Emergency stopping HedgeManager...');
    await this.stopMonitoring();
  }
}
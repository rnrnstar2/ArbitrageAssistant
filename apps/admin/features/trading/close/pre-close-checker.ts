/**
 * 決済前チェック機能
 * 
 * 決済実行前の包括的な状態チェックを提供
 */

import { Position } from "../../monitoring/types";
import { CloseFormData, BatchCloseInput } from "./types";

export interface PreCloseCheckResult {
  canProceed: boolean;
  blockers: CheckBlocker[];
  warnings: CheckWarning[];
  recommendations: CheckRecommendation[];
}

export interface CheckBlocker {
  category: BlockerCategory;
  code: string;
  message: string;
  severity: "critical" | "high";
  affectedPositions?: string[];
}

export interface CheckWarning {
  category: WarningCategory;
  code: string;
  message: string;
  impact: string;
  affectedPositions?: string[];
}

export interface CheckRecommendation {
  category: RecommendationCategory;
  code: string;
  message: string;
  action: string;
  benefit?: string;
}

export type BlockerCategory = 
  | "position_state"
  | "market_condition"
  | "account_status"
  | "connection"
  | "system";

export type WarningCategory = 
  | "market_risk"
  | "account_risk"
  | "timing"
  | "cost"
  | "liquidity";

export type RecommendationCategory = 
  | "optimization"
  | "risk_management"
  | "timing"
  | "cost_reduction";

export interface MarketCondition {
  isMarketOpen: boolean;
  currentSpread: number;
  volatility: "low" | "medium" | "high";
  liquidityLevel: "low" | "medium" | "high";
  lastPriceUpdate: Date;
  newsEvents?: NewsEvent[];
}

export interface NewsEvent {
  severity: "low" | "medium" | "high";
  currency: string;
  title: string;
  scheduledTime: Date;
  impact: string;
}

export interface AccountStatus {
  balance: number;
  equity: number;
  marginLevel: number;
  freeMargin: number;
  totalPositions: number;
  connectionStatus: "connected" | "disconnected" | "unstable";
  lastHeartbeat: Date;
}

export interface SystemStatus {
  websocketConnected: boolean;
  eaConnected: boolean;
  lastEaResponse: Date;
  serverLatency: number;
  errorRate: number;
}

export class PreCloseChecker {
  /**
   * 個別ポジション決済前チェック
   */
  async checkSingleClose(
    data: CloseFormData,
    position: Position,
    marketCondition: MarketCondition,
    accountStatus: AccountStatus,
    systemStatus: SystemStatus
  ): Promise<PreCloseCheckResult> {
    const blockers: CheckBlocker[] = [];
    const warnings: CheckWarning[] = [];
    const recommendations: CheckRecommendation[] = [];

    // ポジション状態チェック
    this.checkPositionState([position], blockers, warnings);

    // 市場状況チェック
    this.checkMarketCondition(marketCondition, blockers, warnings, recommendations);

    // アカウント状態チェック
    this.checkAccountStatus(accountStatus, position.symbol, blockers, warnings);

    // システム状態チェック
    this.checkSystemStatus(systemStatus, blockers, warnings);

    // 決済固有のチェック
    this.checkCloseSpecific(data, position, marketCondition, warnings, recommendations);

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
      recommendations,
    };
  }

  /**
   * 一括決済前チェック
   */
  async checkBatchClose(
    data: BatchCloseInput,
    positions: Position[],
    marketCondition: MarketCondition,
    accountStatus: AccountStatus,
    systemStatus: SystemStatus
  ): Promise<PreCloseCheckResult> {
    const blockers: CheckBlocker[] = [];
    const warnings: CheckWarning[] = [];
    const recommendations: CheckRecommendation[] = [];

    // 対象ポジションのフィルタリング
    const targetPositions = positions.filter(p => data.positionIds.includes(p.id));

    if (targetPositions.length !== data.positionIds.length) {
      blockers.push({
        category: "position_state",
        code: "MISSING_POSITIONS",
        message: "一部のポジションが見つかりません",
        severity: "critical",
        affectedPositions: data.positionIds.filter(id => 
          !targetPositions.some(p => p.id === id)
        ),
      });
    }

    // 基本チェック
    this.checkPositionState(targetPositions, blockers, warnings);
    this.checkMarketCondition(marketCondition, blockers, warnings, recommendations);
    this.checkAccountStatus(accountStatus, "", blockers, warnings);
    this.checkSystemStatus(systemStatus, blockers, warnings);

    // 一括決済固有のチェック
    this.checkBatchSpecific(data, targetPositions, warnings, recommendations);

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
      recommendations,
    };
  }

  /**
   * ポジション状態のチェック
   */
  private checkPositionState(
    positions: Position[],
    blockers: CheckBlocker[],
    warnings: CheckWarning[]
  ): void {
    const nonOpenPositions = positions.filter(p => p.status !== "open");
    if (nonOpenPositions.length > 0) {
      blockers.push({
        category: "position_state",
        code: "NON_OPEN_POSITIONS",
        message: `${nonOpenPositions.length}件のポジションが決済可能状態ではありません`,
        severity: "critical",
        affectedPositions: nonOpenPositions.map(p => p.id),
      });
    }

    // データ鮮度チェック
    const stalePositions = positions.filter(p => {
      const minutes = this.getMinutesSince(p.lastUpdate);
      return minutes > 5;
    });

    if (stalePositions.length > 0) {
      warnings.push({
        category: "timing",
        code: "STALE_POSITION_DATA",
        message: `${stalePositions.length}件のポジションのデータが古い可能性があります`,
        impact: "最新価格が反映されていない可能性があります",
        affectedPositions: stalePositions.map(p => p.id),
      });
    }

    // 大きな損失ポジションの警告
    const largeLossPositions = positions.filter(p => {
      const lossThreshold = Math.abs(p.openPrice * p.lots * 1000); // 1%の損失閾値
      return p.profit < -lossThreshold;
    });

    if (largeLossPositions.length > 0) {
      warnings.push({
        category: "account_risk",
        code: "LARGE_LOSS_POSITIONS",
        message: `${largeLossPositions.length}件のポジションで大きな損失が発生しています`,
        impact: "アカウント残高への影響が大きいです",
        affectedPositions: largeLossPositions.map(p => p.id),
      });
    }
  }

  /**
   * 市場状況のチェック
   */
  private checkMarketCondition(
    market: MarketCondition,
    blockers: CheckBlocker[],
    warnings: CheckWarning[],
    recommendations: CheckRecommendation[]
  ): void {
    // 市場開閉チェック
    if (!market.isMarketOpen) {
      warnings.push({
        category: "timing",
        code: "MARKET_CLOSED",
        message: "市場が閉まっています",
        impact: "決済が翌営業日に延期される可能性があります",
      });

      recommendations.push({
        category: "timing",
        code: "WAIT_FOR_MARKET_OPEN",
        message: "市場開場まで待機することを推奨します",
        action: "決済を市場開場後に実行",
        benefit: "より良い流動性とスプレッドでの決済が期待できます",
      });
    }

    // スプレッドチェック
    if (market.currentSpread > 50) { // 5pips
      warnings.push({
        category: "cost",
        code: "HIGH_SPREAD",
        message: `スプレッドが広がっています（${market.currentSpread / 10}pips）`,
        impact: "取引コストが増加します",
      });

      if (market.currentSpread > 100) { // 10pips
        recommendations.push({
          category: "cost_reduction",
          code: "WAIT_FOR_BETTER_SPREAD",
          message: "スプレッドが正常化するまで待機することを推奨します",
          action: "決済を延期",
          benefit: "取引コストの削減",
        });
      }
    }

    // ボラティリティチェック
    if (market.volatility === "high") {
      warnings.push({
        category: "market_risk",
        code: "HIGH_VOLATILITY",
        message: "市場のボラティリティが高い状態です",
        impact: "予想外の価格変動のリスクがあります",
      });

      recommendations.push({
        category: "risk_management",
        code: "USE_LIMIT_ORDERS",
        message: "成行ではなく指値注文の使用を推奨します",
        action: "指値決済への変更",
        benefit: "スリッページのリスクを軽減",
      });
    }

    // 重要ニュースイベントチェック
    if (market.newsEvents) {
      const highImpactEvents = market.newsEvents.filter(e => e.severity === "high");
      if (highImpactEvents.length > 0) {
        warnings.push({
          category: "market_risk",
          code: "HIGH_IMPACT_NEWS",
          message: `${highImpactEvents.length}件の重要経済指標の発表が予定されています`,
          impact: "市場の急激な変動のリスクがあります",
        });
      }
    }

    // 流動性チェック
    if (market.liquidityLevel === "low") {
      warnings.push({
        category: "liquidity",
        code: "LOW_LIQUIDITY",
        message: "市場の流動性が低下しています",
        impact: "決済価格が不利になる可能性があります",
      });
    }
  }

  /**
   * アカウント状態のチェック
   */
  private checkAccountStatus(
    account: AccountStatus,
    symbol: string,
    blockers: CheckBlocker[],
    warnings: CheckWarning[]
  ): void {
    // 接続状態チェック
    if (account.connectionStatus !== "connected") {
      blockers.push({
        category: "connection",
        code: "ACCOUNT_DISCONNECTED",
        message: "アカウントが切断されています",
        severity: "critical",
      });
    }

    // 証拠金レベルチェック
    if (account.marginLevel < 100) {
      warnings.push({
        category: "account_risk",
        code: "LOW_MARGIN_LEVEL",
        message: `証拠金維持率が低下しています（${account.marginLevel.toFixed(1)}%）`,
        impact: "強制ロスカットのリスクがあります",
      });
    }

    if (account.marginLevel < 50) {
      blockers.push({
        category: "account_status",
        code: "CRITICAL_MARGIN_LEVEL",
        message: `証拠金維持率が危険な水準です（${account.marginLevel.toFixed(1)}%）`,
        severity: "high",
      });
    }

    // 残高チェック
    if (account.balance <= 0) {
      blockers.push({
        category: "account_status",
        code: "INSUFFICIENT_BALANCE",
        message: "アカウント残高が不足しています",
        severity: "critical",
      });
    }

    // ハートビートチェック
    const heartbeatMinutes = this.getMinutesSince(account.lastHeartbeat);
    if (heartbeatMinutes > 2) {
      warnings.push({
        category: "timing",
        code: "STALE_ACCOUNT_DATA",
        message: `アカウント情報が${heartbeatMinutes}分前の情報です`,
        impact: "最新の状態が反映されていない可能性があります",
      });
    }
  }

  /**
   * システム状態のチェック
   */
  private checkSystemStatus(
    system: SystemStatus,
    blockers: CheckBlocker[],
    warnings: CheckWarning[]
  ): void {
    // WebSocket接続チェック
    if (!system.websocketConnected) {
      blockers.push({
        category: "connection",
        code: "WEBSOCKET_DISCONNECTED",
        message: "WebSocket接続が切断されています",
        severity: "critical",
      });
    }

    // EA接続チェック
    if (!system.eaConnected) {
      blockers.push({
        category: "connection",
        code: "EA_DISCONNECTED",
        message: "EA（Expert Advisor）が接続されていません",
        severity: "critical",
      });
    }

    // レスポンス時間チェック
    const eaResponseMinutes = this.getMinutesSince(system.lastEaResponse);
    if (eaResponseMinutes > 1) {
      warnings.push({
        category: "timing",
        code: "EA_UNRESPONSIVE",
        message: `EAからの応答が${eaResponseMinutes}分前です`,
        impact: "コマンドが実行されない可能性があります",
      });
    }

    // サーバーレイテンシチェック
    if (system.serverLatency > 1000) { // 1秒
      warnings.push({
        category: "timing",
        code: "HIGH_LATENCY",
        message: `サーバーレイテンシが高い状態です（${system.serverLatency}ms）`,
        impact: "約定価格にスリッページが生じる可能性があります",
      });
    }

    // エラー率チェック
    if (system.errorRate > 0.1) { // 10%
      warnings.push({
        category: "timing",
        code: "HIGH_ERROR_RATE",
        message: `システムエラー率が高い状態です（${(system.errorRate * 100).toFixed(1)}%）`,
        impact: "決済が失敗する可能性があります",
      });
    }
  }

  /**
   * 決済固有のチェック
   */
  private checkCloseSpecific(
    data: CloseFormData,
    position: Position,
    market: MarketCondition,
    warnings: CheckWarning[],
    recommendations: CheckRecommendation[]
  ): void {
    // 指値決済の価格妥当性チェック
    if (data.closeType === "limit" && data.closePrice) {
      const currentPrice = position.currentPrice;
      const priceDeviation = Math.abs(data.closePrice - currentPrice) / currentPrice;

      if (priceDeviation > 0.02) { // 2%以上の乖離
        warnings.push({
          category: "market_risk",
          code: "LARGE_PRICE_DEVIATION",
          message: `決済価格が現在価格から${(priceDeviation * 100).toFixed(1)}%離れています`,
          impact: "約定しない可能性があります",
        });

        if (priceDeviation > 0.05) { // 5%以上の乖離
          recommendations.push({
            category: "optimization",
            code: "ADJUST_LIMIT_PRICE",
            message: "決済価格を現在価格に近づけることを推奨します",
            action: "価格調整",
            benefit: "約定確率の向上",
          });
        }
      }
    }

    // トレール設定のチェック
    if (data.trailSettings?.enabled) {
      const isProfit = (position.type === "buy" && position.currentPrice > position.openPrice) ||
                      (position.type === "sell" && position.currentPrice < position.openPrice);

      if (!isProfit) {
        warnings.push({
          category: "market_risk",
          code: "TRAIL_ON_LOSS_POSITION",
          message: "損失ポジションにトレール設定を適用しようとしています",
          impact: "さらなる損失拡大のリスクがあります",
        });
      }
    }

    // 関連ポジション連動の確認
    if (data.linkedAction && data.linkedAction.action !== "none") {
      recommendations.push({
        category: "risk_management",
        code: "CONFIRM_LINKED_ACTION",
        message: "関連ポジションの連動アクションが設定されています",
        action: "連動設定の再確認",
        benefit: "意図しない決済の防止",
      });
    }
  }

  /**
   * 一括決済固有のチェック
   */
  private checkBatchSpecific(
    data: BatchCloseInput,
    positions: Position[],
    warnings: CheckWarning[],
    recommendations: CheckRecommendation[]
  ): void {
    // 大量決済の警告
    if (positions.length > 10) {
      warnings.push({
        category: "timing",
        code: "LARGE_BATCH_SIZE",
        message: `${positions.length}件の大量決済です`,
        impact: "処理時間が長くなり、市場への影響が大きくなる可能性があります",
      });

      recommendations.push({
        category: "optimization",
        code: "SPLIT_BATCH",
        message: "分割実行を検討することを推奨します",
        action: "バッチサイズの削減",
        benefit: "市場影響の軽減とリスクの分散",
      });
    }

    // 通貨ペアの多様性チェック
    const uniqueSymbols = new Set(positions.map(p => p.symbol));
    if (uniqueSymbols.size > 5) {
      warnings.push({
        category: "market_risk",
        code: "MULTIPLE_SYMBOLS",
        message: `${uniqueSymbols.size}種類の通貨ペアが含まれています`,
        impact: "異なる市場状況による影響を受ける可能性があります",
      });
    }

    // 総取引量チェック
    const totalLots = positions.reduce((sum, p) => sum + p.lots, 0);
    if (totalLots > 50) {
      warnings.push({
        category: "market_risk",
        code: "LARGE_TOTAL_VOLUME",
        message: `総取引量が大きいです（${totalLots} lots）`,
        impact: "市場への影響が大きくなる可能性があります",
      });
    }

    // 両建てポジションの混在チェック
    const hedgePairs = this.findHedgePairs(positions);
    if (hedgePairs.length > 0) {
      warnings.push({
        category: "market_risk",
        code: "HEDGE_POSITIONS_INCLUDED",
        message: `${hedgePairs.length}組の両建てポジションが含まれています`,
        impact: "ヘッジ効果が解除されます",
      });

      recommendations.push({
        category: "risk_management",
        code: "REVIEW_HEDGE_STRATEGY",
        message: "両建て戦略の見直しを推奨します",
        action: "ヘッジポジションの個別管理",
        benefit: "リスク管理の最適化",
      });
    }
  }

  /**
   * 両建てペアの検出
   */
  private findHedgePairs(positions: Position[]): Array<[Position, Position]> {
    const pairs: Array<[Position, Position]> = [];
    
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];
        
        if (pos1.symbol === pos2.symbol && 
            pos1.type !== pos2.type &&
            Math.abs(pos1.lots - pos2.lots) < 0.01) {
          pairs.push([pos1, pos2]);
        }
      }
    }
    
    return pairs;
  }

  /**
   * 経過分数の計算
   */
  private getMinutesSince(timestamp: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(timestamp).getTime());
    return Math.floor(diffTime / (1000 * 60));
  }
}

/**
 * 市場状況取得用のヘルパー関数
 */
export class MarketConditionProvider {
  /**
   * 現在の市場状況を取得
   */
  static async getCurrentMarketCondition(symbol?: string): Promise<MarketCondition> {
    // 実際の実装では、外部APIやリアルタイムデータから取得
    return {
      isMarketOpen: this.isMarketCurrentlyOpen(),
      currentSpread: 15, // 1.5 pips
      volatility: "medium",
      liquidityLevel: "medium",
      lastPriceUpdate: new Date(),
      newsEvents: await this.getUpcomingNewsEvents(symbol),
    };
  }

  /**
   * 市場開閉状態の判定
   */
  private static isMarketCurrentlyOpen(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();

    // 週末は閉場
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // 平日の取引時間をチェック（簡易版）
    return hour >= 6 && hour < 22; // 6:00 - 22:00 (仮の取引時間)
  }

  /**
   * 今後の重要経済指標を取得
   */
  private static async getUpcomingNewsEvents(symbol?: string): Promise<NewsEvent[]> {
    // 実際の実装では、経済カレンダーAPIから取得
    return [];
  }
}

/**
 * 決済前チェックのファクトリー関数
 */
export function createPreCloseChecker(): PreCloseChecker {
  return new PreCloseChecker();
}
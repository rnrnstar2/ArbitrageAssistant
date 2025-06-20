import { Position } from '../../../../lib/websocket/message-types';

/**
 * 両建て検出条件の設定
 */
export interface HedgeDetectionCriteria {
  symbol: string;
  timeWindow: number; // 分
  maxSpread: number; // pips
  minLotSize: number;
  accountGroups?: string[][]; // クロスアカウント両建て用
}

/**
 * 両建てポジション情報
 */
export interface HedgePosition {
  id: string;
  positionIds: string[];
  symbol: string;
  hedgeType: 'perfect' | 'partial' | 'cross_account';
  accounts: string[];
  totalLots: {
    buy: number;
    sell: number;
  };
  totalProfit: number;
  isBalanced: boolean;
  createdAt: Date;
  lastRebalanced?: Date;
  settings: {
    autoRebalance: boolean;
    maxImbalance: number;
    maintainOnClose: boolean;
  };
}

/**
 * 両建て候補
 */
export interface PotentialHedge {
  buyPositions: Position[];
  sellPositions: Position[];
  symbol: string;
  imbalance: number;
  confidence: number; // 0-1
  reason: string;
}

/**
 * デフォルト設定
 */
const DEFAULT_CRITERIA: Omit<HedgeDetectionCriteria, 'symbol'> = {
  timeWindow: 15, // 15分以内
  maxSpread: 5.0, // 5 pips
  minLotSize: 0.01,
  accountGroups: undefined
};

/**
 * 両建てポジション検出エンジン
 */
export class HedgePositionDetector {
  private criteria: Map<string, HedgeDetectionCriteria> = new Map();

  /**
   * 検出条件を設定
   */
  setCriteria(symbol: string, criteria: Partial<HedgeDetectionCriteria>): void {
    const fullCriteria = {
      symbol,
      ...DEFAULT_CRITERIA,
      ...criteria
    };
    this.criteria.set(symbol, fullCriteria);
  }

  /**
   * 指定された通貨ペアの検出条件を取得
   */
  getCriteria(symbol: string): HedgeDetectionCriteria {
    return this.criteria.get(symbol) || {
      symbol,
      ...DEFAULT_CRITERIA
    };
  }

  /**
   * 既存ポジションから両建てを検出
   */
  detectHedgePositions(positions: Position[]): HedgePosition[] {
    const hedgePositions: HedgePosition[] = [];
    const processedPositions = new Set<string>();

    // 通貨ペア別にグループ化
    const positionsBySymbol = this.groupPositionsBySymbol(positions);

    for (const [symbol, symbolPositions] of positionsBySymbol) {
      const criteria = this.getCriteria(symbol);
      const hedges = this.detectHedgesForSymbol(symbolPositions, criteria);
      
      hedges.forEach(hedge => {
        hedgePositions.push(hedge);
        hedge.positionIds.forEach(id => processedPositions.add(id));
      });
    }

    return hedgePositions;
  }

  /**
   * 潜在的な両建て機会を検出
   */
  detectPotentialHedges(positions: Position[]): PotentialHedge[] {
    const potentialHedges: PotentialHedge[] = [];
    const positionsBySymbol = this.groupPositionsBySymbol(positions);

    for (const [symbol, symbolPositions] of positionsBySymbol) {
      const criteria = this.getCriteria(symbol);
      const buyPositions = symbolPositions.filter(p => p.type === 'buy');
      const sellPositions = symbolPositions.filter(p => p.type === 'sell');

      if (buyPositions.length > 0 && sellPositions.length > 0) {
        const potential = this.analyzePotentialHedge(buyPositions, sellPositions, criteria);
        if (potential) {
          potentialHedges.push(potential);
        }
      }
    }

    return potentialHedges;
  }

  /**
   * 両建て機会を検証
   */
  validateHedgeOpportunity(criteria: HedgeDetectionCriteria): boolean {
    // 基本的な妥当性チェック
    if (criteria.timeWindow <= 0) return false;
    if (criteria.maxSpread < 0) return false;
    if (criteria.minLotSize <= 0) return false;
    
    // 通貨ペアの妥当性（簡易チェック）
    if (!criteria.symbol || criteria.symbol.length < 6) return false;
    
    return true;
  }

  /**
   * 通貨ペア別にポジションをグループ化
   */
  private groupPositionsBySymbol(positions: Position[]): Map<string, Position[]> {
    const groups = new Map<string, Position[]>();
    
    positions.forEach(position => {
      if (!groups.has(position.symbol)) {
        groups.set(position.symbol, []);
      }
      groups.get(position.symbol)!.push(position);
    });
    
    return groups;
  }

  /**
   * 特定通貨ペアの両建てを検出
   */
  private detectHedgesForSymbol(positions: Position[], criteria: HedgeDetectionCriteria): HedgePosition[] {
    const hedges: HedgePosition[] = [];
    const buyPositions = positions.filter(p => p.type === 'buy');
    const sellPositions = positions.filter(p => p.type === 'sell');

    if (buyPositions.length === 0 || sellPositions.length === 0) {
      return hedges;
    }

    // 時間窓内でペアリング
    const pairedPositions = this.findPairedPositions(buyPositions, sellPositions, criteria);
    
    // アカウント別グループ化
    const accountGroups = this.groupPositionsByAccount(pairedPositions);
    
    // 各グループから両建てを作成
    accountGroups.forEach((groupPositions, accounts) => {
      const hedge = this.createHedgePosition(groupPositions, criteria, accounts);
      if (hedge) {
        hedges.push(hedge);
      }
    });

    // クロスアカウント両建てもチェック
    if (criteria.accountGroups) {
      const crossAccountHedges = this.detectCrossAccountHedges(
        buyPositions, 
        sellPositions, 
        criteria
      );
      hedges.push(...crossAccountHedges);
    }

    return hedges;
  }

  /**
   * ペアリング可能なポジションを検索
   */
  private findPairedPositions(
    buyPositions: Position[], 
    sellPositions: Position[], 
    criteria: HedgeDetectionCriteria
  ): Position[] {
    const pairedPositions: Position[] = [];
    const timeWindowMs = criteria.timeWindow * 60 * 1000;

    buyPositions.forEach(buyPos => {
      const buyTime = new Date(buyPos.openedAt).getTime();
      
      sellPositions.forEach(sellPos => {
        const sellTime = new Date(sellPos.openedAt).getTime();
        const timeDiff = Math.abs(buyTime - sellTime);
        
        // 時間窓内かつ最小ロットサイズ以上
        if (timeDiff <= timeWindowMs && 
            buyPos.lots >= criteria.minLotSize && 
            sellPos.lots >= criteria.minLotSize) {
          
          // スプレッドチェック（簡易実装）
          const spread = Math.abs(buyPos.openPrice - sellPos.openPrice) * 10000; // pips概算
          
          if (spread <= criteria.maxSpread) {
            if (!pairedPositions.includes(buyPos)) {
              pairedPositions.push(buyPos);
            }
            if (!pairedPositions.includes(sellPos)) {
              pairedPositions.push(sellPos);
            }
          }
        }
      });
    });

    return pairedPositions;
  }

  /**
   * ポジションをアカウント別にグループ化
   */
  private groupPositionsByAccount(positions: Position[]): Map<string, Position[]> {
    const groups = new Map<string, Position[]>();
    
    positions.forEach(position => {
      const accountKey = position.accountId;
      if (!groups.has(accountKey)) {
        groups.set(accountKey, []);
      }
      groups.get(accountKey)!.push(position);
    });
    
    return groups;
  }

  /**
   * 両建てポジションを作成
   */
  private createHedgePosition(
    positions: Position[], 
    criteria: HedgeDetectionCriteria,
    accounts: string
  ): HedgePosition | null {
    const buyPositions = positions.filter(p => p.type === 'buy');
    const sellPositions = positions.filter(p => p.type === 'sell');

    if (buyPositions.length === 0 || sellPositions.length === 0) {
      return null;
    }

    const buyLots = buyPositions.reduce((sum, p) => sum + p.lots, 0);
    const sellLots = sellPositions.reduce((sum, p) => sum + p.lots, 0);
    const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
    
    const imbalance = Math.abs(buyLots - sellLots);
    const isBalanced = imbalance < 0.01; // 0.01ロット以下の差は許容

    // 両建てタイプの判定
    let hedgeType: 'perfect' | 'partial' | 'cross_account' = 'partial';
    if (isBalanced) {
      hedgeType = 'perfect';
    }

    const accountList = Array.from(new Set(positions.map(p => p.accountId)));
    if (accountList.length > 1) {
      hedgeType = 'cross_account';
    }

    return {
      id: this.generateHedgeId(positions),
      positionIds: positions.map(p => p.id),
      symbol: criteria.symbol,
      hedgeType,
      accounts: accountList,
      totalLots: {
        buy: buyLots,
        sell: sellLots
      },
      totalProfit,
      isBalanced,
      createdAt: new Date(),
      settings: {
        autoRebalance: false,
        maxImbalance: 0.05,
        maintainOnClose: true
      }
    };
  }

  /**
   * クロスアカウント両建てを検出
   */
  private detectCrossAccountHedges(
    buyPositions: Position[], 
    sellPositions: Position[], 
    criteria: HedgeDetectionCriteria
  ): HedgePosition[] {
    const hedges: HedgePosition[] = [];
    
    if (!criteria.accountGroups) {
      return hedges;
    }

    criteria.accountGroups.forEach(accountGroup => {
      const groupBuyPositions = buyPositions.filter(p => accountGroup.includes(p.accountId));
      const groupSellPositions = sellPositions.filter(p => accountGroup.includes(p.accountId));
      
      if (groupBuyPositions.length > 0 && groupSellPositions.length > 0) {
        const allPositions = [...groupBuyPositions, ...groupSellPositions];
        const hedge = this.createHedgePosition(allPositions, criteria, accountGroup.join(','));
        
        if (hedge) {
          hedge.hedgeType = 'cross_account';
          hedges.push(hedge);
        }
      }
    });

    return hedges;
  }

  /**
   * 潜在的両建てを分析
   */
  private analyzePotentialHedge(
    buyPositions: Position[], 
    sellPositions: Position[], 
    criteria: HedgeDetectionCriteria
  ): PotentialHedge | null {
    const buyLots = buyPositions.reduce((sum, p) => sum + p.lots, 0);
    const sellLots = sellPositions.reduce((sum, p) => sum + p.lots, 0);
    const imbalance = Math.abs(buyLots - sellLots);
    
    // 不均衡が大きすぎる場合は潜在的でない
    if (imbalance > Math.max(buyLots, sellLots) * 0.5) {
      return null;
    }

    // 信頼度計算（簡易）
    const balanceScore = 1 - (imbalance / Math.max(buyLots, sellLots));
    const sizeScore = Math.min(1, (buyLots + sellLots) / (criteria.minLotSize * 10));
    const confidence = (balanceScore + sizeScore) / 2;

    let reason = '';
    if (imbalance < 0.01) {
      reason = '完全両建て可能';
    } else if (imbalance < 0.1) {
      reason = '軽微な調整で両建て可能';
    } else {
      reason = '部分両建て';
    }

    return {
      buyPositions,
      sellPositions,
      symbol: criteria.symbol,
      imbalance,
      confidence,
      reason
    };
  }

  /**
   * 両建てIDを生成
   */
  private generateHedgeId(positions: Position[]): string {
    const positionIds = positions.map(p => p.id).sort().join('-');
    const hash = Math.abs(this.simpleHash(positionIds));
    return `hedge_${hash.toString(36)}_${Date.now()}`;
  }

  /**
   * 簡易ハッシュ関数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash;
  }

  /**
   * 両建て検出の統計情報を取得
   */
  getDetectionStats(positions: Position[]): {
    totalPositions: number;
    hedgedPositions: number;
    hedgeRatio: number;
    symbolStats: Map<string, { total: number; hedged: number; ratio: number }>;
  } {
    const hedgePositions = this.detectHedgePositions(positions);
    const hedgedPositionIds = new Set(hedgePositions.flatMap(h => h.positionIds));
    
    const symbolStats = new Map<string, { total: number; hedged: number; ratio: number }>();
    const positionsBySymbol = this.groupPositionsBySymbol(positions);
    
    positionsBySymbol.forEach((symbolPositions, symbol) => {
      const hedgedCount = symbolPositions.filter(p => hedgedPositionIds.has(p.id)).length;
      symbolStats.set(symbol, {
        total: symbolPositions.length,
        hedged: hedgedCount,
        ratio: symbolPositions.length > 0 ? hedgedCount / symbolPositions.length : 0
      });
    });

    return {
      totalPositions: positions.length,
      hedgedPositions: hedgedPositionIds.size,
      hedgeRatio: positions.length > 0 ? hedgedPositionIds.size / positions.length : 0,
      symbolStats
    };
  }
}
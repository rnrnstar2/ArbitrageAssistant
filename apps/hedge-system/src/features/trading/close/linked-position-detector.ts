import { Position, LinkedPosition, LinkedPositionGroup, RelationType } from './types';

export class LinkedPositionDetector {
  // 通貨ペア相関マッピング
  private static readonly CORRELATION_MAP: Record<string, Record<string, number>> = {
    'EURUSD': { 'GBPUSD': 0.85, 'AUDUSD': 0.78, 'NZDUSD': 0.72 },
    'GBPUSD': { 'EURUSD': 0.85, 'AUDUSD': 0.72, 'NZDUSD': 0.68 },
    'AUDUSD': { 'EURUSD': 0.78, 'GBPUSD': 0.72, 'NZDUSD': 0.82 },
    'NZDUSD': { 'EURUSD': 0.72, 'GBPUSD': 0.68, 'AUDUSD': 0.82 },
    'USDJPY': { 'EURJPY': 0.89, 'GBPJPY': 0.83 },
    'EURJPY': { 'USDJPY': 0.89, 'GBPJPY': 0.76 },
    'GBPJPY': { 'USDJPY': 0.83, 'EURJPY': 0.76 }
  };

  private static readonly CORRELATION_THRESHOLD = 0.7;

  /**
   * 指定されたポジションに関連するポジションを検出する
   */
  static findLinkedPositions(position: Position, allPositions: Position[]): LinkedPosition[] {
    const linkedPositions: LinkedPosition[] = [];
    
    for (const otherPosition of allPositions) {
      if (otherPosition.id === position.id) continue;

      // 直接的な両建てポジションをチェック
      const hedgeRelation = this.checkHedgeRelationship(position, otherPosition);
      if (hedgeRelation) {
        linkedPositions.push({
          position: otherPosition,
          relationType: RelationType.HEDGE
        });
        continue;
      }

      // 同一通貨ペアのポジションをチェック
      if (this.checkSamePairRelationship(position, otherPosition)) {
        linkedPositions.push({
          position: otherPosition,
          relationType: RelationType.SAME_PAIR
        });
        continue;
      }

      // 相関のある通貨ペアをチェック
      const correlation = this.checkCorrelationRelationship(position, otherPosition);
      if (correlation && correlation >= this.CORRELATION_THRESHOLD) {
        linkedPositions.push({
          position: otherPosition,
          relationType: RelationType.CORRELATION,
          correlation
        });
      }
    }

    return linkedPositions;
  }

  /**
   * 両建てポジションの関係をチェック
   */
  private static checkHedgeRelationship(pos1: Position, pos2: Position): boolean {
    // 同一通貨ペアで反対方向のポジション
    return pos1.symbol === pos2.symbol && pos1.type !== pos2.type;
  }

  /**
   * 同一通貨ペアの関係をチェック
   */
  private static checkSamePairRelationship(pos1: Position, pos2: Position): boolean {
    // 同一通貨ペアで同じ方向のポジション
    return pos1.symbol === pos2.symbol && pos1.type === pos2.type;
  }

  /**
   * 相関関係をチェック
   */
  private static checkCorrelationRelationship(pos1: Position, pos2: Position): number | null {
    const correlation = this.CORRELATION_MAP[pos1.symbol]?.[pos2.symbol];
    return correlation || null;
  }

  /**
   * ポジショングループを作成
   */
  static createLinkedPositionGroups(positions: Position[]): LinkedPositionGroup[] {
    const groups: LinkedPositionGroup[] = [];
    const processedPositions = new Set<string>();

    for (const position of positions) {
      if (processedPositions.has(position.id)) continue;

      const linkedPositions = this.findLinkedPositions(position, positions);
      
      if (linkedPositions.length > 0) {
        const group: LinkedPositionGroup = {
          primaryPosition: position,
          linkedPositions,
          totalExposure: this.calculateTotalExposure(position, linkedPositions),
          netProfit: this.calculateNetProfit(position, linkedPositions)
        };

        groups.push(group);
        
        // 処理済みとしてマーク
        processedPositions.add(position.id);
        linkedPositions.forEach(lp => processedPositions.add(lp.position.id));
      }
    }

    return groups;
  }

  /**
   * 総エクスポージャーを計算
   */
  private static calculateTotalExposure(primary: Position, linked: LinkedPosition[]): number {
    let totalExposure = primary.lots;

    for (const linkedPos of linked) {
      const pos = linkedPos.position;
      
      if (linkedPos.relationType === RelationType.HEDGE) {
        // 両建ての場合、差分がエクスポージャー
        totalExposure = Math.abs(totalExposure - pos.lots);
      } else {
        // 同一方向や相関の場合、加算
        const correlation = linkedPos.correlation || 1.0;
        totalExposure += pos.lots * correlation;
      }
    }

    return Math.abs(totalExposure);
  }

  /**
   * 純損益を計算
   */
  private static calculateNetProfit(primary: Position, linked: LinkedPosition[]): number {
    let netProfit = primary.profit;

    for (const linkedPos of linked) {
      netProfit += linkedPos.position.profit;
    }

    return netProfit;
  }

  /**
   * 関連ポジションの検証
   */
  static validatePositionRelationship(pos1: Position, pos2: Position): RelationType | null {
    if (this.checkHedgeRelationship(pos1, pos2)) {
      return RelationType.HEDGE;
    }
    
    if (this.checkSamePairRelationship(pos1, pos2)) {
      return RelationType.SAME_PAIR;
    }
    
    const correlation = this.checkCorrelationRelationship(pos1, pos2);
    if (correlation && correlation >= this.CORRELATION_THRESHOLD) {
      return RelationType.CORRELATION;
    }

    return null;
  }

  /**
   * 最適な決済順序を推奨
   */
  static recommendCloseOrder(group: LinkedPositionGroup): Position[] {
    const positions = [group.primaryPosition, ...group.linkedPositions.map(lp => lp.position)];
    
    // 1. 利益が出ているポジションを優先
    // 2. 両建ての場合は同時決済を推奨
    // 3. 相関関係の場合は相関の強い順
    
    return positions.sort((a, b) => {
      // 利益順でソート（利益が大きい順）
      if (a.profit !== b.profit) {
        return b.profit - a.profit;
      }
      
      // ロット数順でソート（大きい順）
      return b.lots - a.lots;
    });
  }
}
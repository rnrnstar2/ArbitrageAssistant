import { Position } from '../close/types';
import { HedgePosition, HedgeRelationship, HedgeValidationResult, HedgeValidationIssue } from './types';

export class PositionRelationManager {
  private hedgePositions = new Map<string, HedgePosition>();
  private positionToHedgeMap = new Map<string, string>();
  private relationships = new Map<string, HedgeRelationship>();

  /**
   * ポジションを関連付けて両建て管理対象に追加
   */
  linkPositions(positionIds: string[], positions: Position[]): HedgePosition {
    // 入力検証
    if (positionIds.length < 2) {
      throw new Error('少なくとも2つのポジションが必要です');
    }

    const positionMap = new Map(positions.map(p => [p.id, p]));
    const targetPositions = positionIds.map(id => {
      const position = positionMap.get(id);
      if (!position) {
        throw new Error(`ポジション ${id} が見つかりません`);
      }
      return position;
    });

    // 関連付け可能性の検証
    this.validateLinkability(targetPositions);

    // 既存の関連付けをチェック
    const existingHedgeIds = positionIds
      .map(id => this.positionToHedgeMap.get(id))
      .filter(Boolean) as string[];

    if (existingHedgeIds.length > 0) {
      throw new Error(`ポジションは既に関連付けられています: ${existingHedgeIds.join(', ')}`);
    }

    // 両建て対象の作成
    const hedgePosition = this.createHedgePosition(targetPositions);
    
    // 関連付けの保存
    this.hedgePositions.set(hedgePosition.id, hedgePosition);
    
    // ポジション→両建てマッピングの保存
    positionIds.forEach(positionId => {
      this.positionToHedgeMap.set(positionId, hedgePosition.id);
      
      // 関係性の保存
      const relationship: HedgeRelationship = {
        hedgeId: hedgePosition.id,
        positionId,
        role: positionId === positionIds[0] ? 'primary' : 'hedge',
        createdAt: new Date()
      };
      this.relationships.set(positionId, relationship);
    });

    return hedgePosition;
  }

  /**
   * 両建て管理から関連付けを削除
   */
  unlinkPositions(hedgeId: string): void {
    const hedgePosition = this.hedgePositions.get(hedgeId);
    if (!hedgePosition) {
      throw new Error(`両建て管理 ${hedgeId} が見つかりません`);
    }

    // 関連付けの削除
    hedgePosition.positionIds.forEach(positionId => {
      this.positionToHedgeMap.delete(positionId);
      this.relationships.delete(positionId);
    });

    this.hedgePositions.delete(hedgeId);
  }

  /**
   * 両建て管理の更新
   */
  updateRelation(hedgeId: string, changes: Partial<HedgePosition>): void {
    const hedgePosition = this.hedgePositions.get(hedgeId);
    if (!hedgePosition) {
      throw new Error(`両建て管理 ${hedgeId} が見つかりません`);
    }

    // 更新可能なフィールドのみ適用
    const updatedHedgePosition: HedgePosition = {
      ...hedgePosition,
      ...changes,
      id: hedgePosition.id, // IDは変更不可
      positionIds: hedgePosition.positionIds, // ポジションIDは変更不可
      lastRebalanced: new Date()
    };

    this.hedgePositions.set(hedgeId, updatedHedgePosition);
  }

  /**
   * 指定されたポジションに関連付けられた両建て管理を検索
   */
  findRelatedPositions(positionId: string): HedgePosition | null {
    const hedgeId = this.positionToHedgeMap.get(positionId);
    if (!hedgeId) {
      return null;
    }

    return this.hedgePositions.get(hedgeId) || null;
  }

  /**
   * 全ての両建て管理を取得
   */
  getAllHedgePositions(): HedgePosition[] {
    return Array.from(this.hedgePositions.values());
  }

  /**
   * 指定された通貨ペアの両建て管理を取得
   */
  getHedgePositionsBySymbol(symbol: string): HedgePosition[] {
    return Array.from(this.hedgePositions.values())
      .filter(hedge => hedge.symbol === symbol);
  }

  /**
   * 孤立ポジションの検出
   */
  findOrphanedPositions(allPositions: Position[]): Position[] {
    const managedPositionIds = new Set(this.positionToHedgeMap.keys());
    return allPositions.filter(position => !managedPositionIds.has(position.id));
  }

  /**
   * データ整合性チェック
   */
  validateConsistency(allPositions: Position[]): HedgeValidationResult {
    const issues: HedgeValidationIssue[] = [];
    const positionMap = new Map(allPositions.map(p => [p.id, p]));

    for (const [hedgeId, hedgePosition] of this.hedgePositions) {
      // ポジション存在チェック
      const missingPositions = hedgePosition.positionIds.filter(id => !positionMap.has(id));
      if (missingPositions.length > 0) {
        issues.push({
          type: 'orphaned_position',
          severity: 'error',
          description: `両建て管理 ${hedgeId} で参照されているポジションが存在しません`,
          affectedPositions: missingPositions
        });
      }

      // 両建てバランスチェック
      const positions = hedgePosition.positionIds
        .map(id => positionMap.get(id))
        .filter(Boolean) as Position[];

      if (positions.length >= 2) {
        const balanceResult = this.checkHedgeBalance(positions);
        if (!balanceResult.isValid) {
          issues.push({
            type: 'lot_imbalance',
            severity: 'warning',
            description: `両建て管理 ${hedgeId} でロット数の不均衡が検出されました`,
            affectedPositions: hedgePosition.positionIds
          });
        }
      }

      // 口座整合性チェック
      const accountIds = positions.map(p => p.accountId);
      const uniqueAccounts = new Set(accountIds);
      if (hedgePosition.hedgeType === 'cross_account' && uniqueAccounts.size < 2) {
        issues.push({
          type: 'account_mismatch',
          severity: 'warning',
          description: `クロスアカウント両建て ${hedgeId} で複数口座が使用されていません`,
          affectedPositions: hedgePosition.positionIds
        });
      }
    }

    // 循環参照チェック
    this.checkCircularReferences(issues);

    return {
      isValid: issues.filter(issue => issue.severity === 'error').length === 0,
      issues,
      recommendations: this.generateRecommendations(issues)
    };
  }

  /**
   * 両建て管理の統計情報を取得
   */
  getStatistics(): {
    totalHedgePositions: number;
    byType: Record<string, number>;
    bySymbol: Record<string, number>;
    totalProfit: number;
  } {
    const hedgePositions = Array.from(this.hedgePositions.values());
    
    const byType = hedgePositions.reduce((acc, hedge) => {
      acc[hedge.hedgeType] = (acc[hedge.hedgeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySymbol = hedgePositions.reduce((acc, hedge) => {
      acc[hedge.symbol] = (acc[hedge.symbol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalProfit = hedgePositions.reduce((sum, hedge) => sum + hedge.totalProfit, 0);

    return {
      totalHedgePositions: hedgePositions.length,
      byType,
      bySymbol,
      totalProfit
    };
  }

  /**
   * 関連付け可能性の検証
   */
  private validateLinkability(positions: Position[]): void {
    if (positions.length < 2) {
      throw new Error('少なくとも2つのポジションが必要です');
    }

    // 同一通貨ペアであることを確認
    const symbols = new Set(positions.map(p => p.symbol));
    if (symbols.size > 1) {
      throw new Error('異なる通貨ペアのポジションは関連付けできません');
    }

    // 反対方向のポジションが存在することを確認
    const types = new Set(positions.map(p => p.type));
    if (types.size < 2) {
      throw new Error('両建てには買いと売りの両方のポジションが必要です');
    }
  }

  /**
   * 両建て管理オブジェクトの作成
   */
  private createHedgePosition(positions: Position[]): HedgePosition {
    const symbol = positions[0].symbol;
    const accounts = [...new Set(positions.map(p => p.accountId))];
    
    const buyLots = positions
      .filter(p => p.type === 'buy')
      .reduce((sum, p) => sum + p.lots, 0);
    
    const sellLots = positions
      .filter(p => p.type === 'sell')
      .reduce((sum, p) => sum + p.lots, 0);

    const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);

    const hedgeType: HedgePosition['hedgeType'] = 
      accounts.length > 1 ? 'cross_account' :
      Math.abs(buyLots - sellLots) < 0.01 ? 'perfect' : 'partial';

    return {
      id: this.generateHedgeId(),
      positionIds: positions.map(p => p.id),
      symbol,
      hedgeType,
      accounts,
      totalLots: {
        buy: buyLots,
        sell: sellLots
      },
      totalProfit,
      isBalanced: Math.abs(buyLots - sellLots) < 0.01,
      createdAt: new Date(),
      settings: {
        autoRebalance: true,
        maxImbalance: 0.1,
        maintainOnClose: true
      }
    };
  }

  /**
   * 両建てバランスのチェック
   */
  private checkHedgeBalance(positions: Position[]): { isValid: boolean; imbalance: number } {
    const buyLots = positions
      .filter(p => p.type === 'buy')
      .reduce((sum, p) => sum + p.lots, 0);
    
    const sellLots = positions
      .filter(p => p.type === 'sell')
      .reduce((sum, p) => sum + p.lots, 0);

    const imbalance = Math.abs(buyLots - sellLots);
    
    return {
      isValid: imbalance < 0.1, // 0.1ロット以下の差は許容
      imbalance
    };
  }

  /**
   * 循環参照のチェック
   */
  private checkCircularReferences(issues: HedgeValidationIssue[]): void {
    // 現在の実装では循環参照は発生しないが、将来の拡張のため
    // 関係性グラフを構築して循環参照をチェック
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (hedgeId: string): boolean => {
      if (recursionStack.has(hedgeId)) {
        return true; // 循環参照発見
      }
      if (visited.has(hedgeId)) {
        return false;
      }

      visited.add(hedgeId);
      recursionStack.add(hedgeId);

      // 現在の実装では直接的な依存関係はないが、将来の拡張のため
      recursionStack.delete(hedgeId);
      return false;
    };

    for (const hedgeId of this.hedgePositions.keys()) {
      if (dfs(hedgeId)) {
        issues.push({
          type: 'orphaned_position',
          severity: 'error',
          description: '循環参照が検出されました',
          affectedPositions: [hedgeId]
        });
      }
    }
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(issues: HedgeValidationIssue[]): string[] {
    const recommendations: string[] = [];

    const lotImbalanceIssues = issues.filter(i => i.type === 'lot_imbalance');
    if (lotImbalanceIssues.length > 0) {
      recommendations.push('両建てバランスの調整を検討してください');
    }

    const orphanedIssues = issues.filter(i => i.type === 'orphaned_position');
    if (orphanedIssues.length > 0) {
      recommendations.push('孤立ポジションの整理または再関連付けを実行してください');
    }

    const accountMismatchIssues = issues.filter(i => i.type === 'account_mismatch');
    if (accountMismatchIssues.length > 0) {
      recommendations.push('クロスアカウント両建ての設定を確認してください');
    }

    return recommendations;
  }

  /**
   * 両建てIDの生成
   */
  private generateHedgeId(): string {
    return `hedge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
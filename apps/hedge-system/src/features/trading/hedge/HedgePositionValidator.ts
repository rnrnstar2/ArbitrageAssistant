import { 
  HedgePosition, 
  HedgeValidationResult, 
  HedgeValidationIssue 
} from './types';
import { Position } from '../close/types';
import { notificationService } from '../../dashboard/services/NotificationService';
import { invoke } from '@tauri-apps/api/core';

export class HedgePositionValidator {
  // 許容ロットバランス差率（％）
  private static readonly LOT_BALANCE_THRESHOLD = 5.0;
  // 許容価格差率（％）
  private static readonly PRICE_DIVERGENCE_THRESHOLD = 0.2;
  // 最大許容時間差（分）
  private static readonly MAX_TIMING_DIFF_MINUTES = 30;
  // 最小ヘッジ効率（％）
  private static readonly MIN_HEDGE_EFFICIENCY = 80.0;

  // ログ・アラート設定
  private static readonly ENABLE_ALERTS = true;
  private static readonly ENABLE_AUTO_CORRECTION = false; // 手動確認を推奨
  private static readonly LOG_RETENTION_HOURS = 24;

  /**
   * 両建てポジションの総合整合性検証
   */
  static async validateHedgePosition(hedge: HedgePosition, allPositions: Position[]): Promise<HedgeValidationResult> {
    const issues: HedgeValidationIssue[] = [];
    const recommendations: string[] = [];

    // 基本的な整合性チェック
    issues.push(...this.checkBasicConsistency(hedge));
    
    // ロットバランス検証
    issues.push(...this.checkBalanceConsistency(hedge));
    
    // ポジション存在確認
    issues.push(...this.checkPositionExistence(hedge, allPositions));
    
    // 口座間整合性確認
    issues.push(...this.checkAccountConsistency(hedge, allPositions));
    
    // タイムスタンプ検証
    issues.push(...this.checkTimestamp(hedge, allPositions));

    // 推奨事項の生成
    recommendations.push(...this.generateRecommendations(hedge, issues));

    const result: HedgeValidationResult = {
      isValid: issues.filter(issue => issue.severity === 'error').length === 0,
      issues,
      recommendations
    };

    // ログ記録とアラート送信
    await this.logValidationResult(hedge, result);
    
    if (this.ENABLE_ALERTS) {
      await this.sendValidationAlerts(hedge, result);
    }

    // 自動修正の試行（設定で有効な場合のみ）
    if (this.ENABLE_AUTO_CORRECTION && !result.isValid) {
      await this.attemptAutoCorrection(hedge, result);
    }

    return result;
  }

  /**
   * 複数の両建てポジションの不整合検出
   */
  static async detectInconsistencies(hedges: HedgePosition[], allPositions: Position[]): Promise<HedgeValidationIssue[]> {
    const allIssues: HedgeValidationIssue[] = [];

    // 各両建てポジションの個別検証
    for (const hedge of hedges) {
      const validation = await this.validateHedgePosition(hedge, allPositions);
      allIssues.push(...validation.issues);
    }

    // クロス両建て間の整合性チェック
    allIssues.push(...this.checkCrossHedgeConsistency(hedges, allPositions));

    // 重複ポジション検出
    allIssues.push(...this.detectOrphanedPositions(hedges, allPositions));

    // 批量検証結果のログ
    await this.logBatchValidationResult(hedges, allIssues);

    return allIssues;
  }

  /**
   * 不整合に対する修正提案
   */
  static suggestCorrections(inconsistency: HedgeValidationIssue, hedge: HedgePosition, allPositions: Position[]): string[] {
    const corrections: string[] = [];

    switch (inconsistency.type) {
      case 'lot_imbalance':
        corrections.push(
          `ロット差を修正するため、追加エントリーまたは部分決済を検討してください`,
          `現在の差: ${this.calculateLotImbalance(hedge).toFixed(2)}%`,
          `目標バランス: 買い${hedge.totalLots.buy}ロット、売り${hedge.totalLots.sell}ロット`
        );
        break;

      case 'account_mismatch':
        corrections.push(
          `両建てポジションを異なる口座に分散配置することを強く推奨します`,
          `現在の口座配置を確認し、リスク分散を検討してください`
        );
        break;

      case 'timing_issue':
        corrections.push(
          `エントリータイミングの時間差を最小化するため、同時エントリー設定を使用してください`,
          `既存ポジションの整理を検討し、新しい両建てを構築することも選択肢です`
        );
        break;

      case 'orphaned_position':
        corrections.push(
          `孤立したポジションを既存の両建てグループに統合するか、新しい両建てを構築してください`,
          `ポジションの関連付けを手動で設定することも可能です`
        );
        break;

      default:
        corrections.push(`この問題に対する自動修正案はありません。手動での確認が必要です`);
    }

    return corrections;
  }

  /**
   * 基本的な整合性チェック
   */
  private static checkBasicConsistency(hedge: HedgePosition): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];

    // 必要最小ポジション数チェック
    if (hedge.positionIds.length < 2) {
      issues.push({
        type: 'orphaned_position',
        severity: 'error',
        description: `両建てには最低2つのポジションが必要です（現在: ${hedge.positionIds.length}）`,
        affectedPositions: hedge.positionIds
      });
    }

    // 口座数チェック
    if (hedge.hedgeType === 'cross_account' && hedge.accounts.length < 2) {
      issues.push({
        type: 'account_mismatch',
        severity: 'error',
        description: `クロスアカウント両建てには複数の口座が必要です`,
        affectedPositions: hedge.positionIds
      });
    }

    // ロット数ゼロチェック
    if (hedge.totalLots.buy === 0 || hedge.totalLots.sell === 0) {
      issues.push({
        type: 'lot_imbalance',
        severity: 'error',
        description: `買いまたは売りポジションが存在しません`,
        affectedPositions: hedge.positionIds
      });
    }

    return issues;
  }

  /**
   * ロットバランス整合性チェック
   */
  private static checkBalanceConsistency(hedge: HedgePosition): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];
    const imbalancePercentage = this.calculateLotImbalance(hedge);

    if (imbalancePercentage > this.LOT_BALANCE_THRESHOLD) {
      const severity = imbalancePercentage > this.LOT_BALANCE_THRESHOLD * 2 ? 'error' : 'warning';
      
      issues.push({
        type: 'lot_imbalance',
        severity,
        description: `ロットバランスに${imbalancePercentage.toFixed(1)}%の偏りがあります（許容値: ${this.LOT_BALANCE_THRESHOLD}%）`,
        affectedPositions: hedge.positionIds
      });
    }

    // バランス状態の不整合チェック
    if (hedge.isBalanced && imbalancePercentage > this.LOT_BALANCE_THRESHOLD) {
      issues.push({
        type: 'lot_imbalance',
        severity: 'warning',
        description: `バランス状態がfalseですが、実際にはバランスが取れていません`,
        affectedPositions: hedge.positionIds
      });
    }

    return issues;
  }

  /**
   * ポジション存在確認
   */
  private static checkPositionExistence(hedge: HedgePosition, allPositions: Position[]): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];
    const existingPositionIds = new Set(allPositions.map(p => p.id));
    const missingPositions: string[] = [];

    // 参照されているポジションの存在確認
    for (const positionId of hedge.positionIds) {
      if (!existingPositionIds.has(positionId)) {
        missingPositions.push(positionId);
      }
    }

    if (missingPositions.length > 0) {
      issues.push({
        type: 'orphaned_position',
        severity: 'error',
        description: `存在しないポジションが参照されています: ${missingPositions.join(', ')}`,
        affectedPositions: missingPositions
      });
    }

    // 通貨ペア整合性チェック
    const hedgePositions = allPositions.filter(p => hedge.positionIds.includes(p.id));
    const symbols = new Set(hedgePositions.map(p => p.symbol));
    
    if (symbols.size > 1) {
      issues.push({
        type: 'account_mismatch',
        severity: 'warning',
        description: `異なる通貨ペアが混在しています: ${Array.from(symbols).join(', ')}`,
        affectedPositions: hedge.positionIds
      });
    }

    return issues;
  }

  /**
   * 口座間整合性確認
   */
  private static checkAccountConsistency(hedge: HedgePosition, allPositions: Position[]): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];
    const hedgePositions = allPositions.filter(p => hedge.positionIds.includes(p.id));
    const accountIds = hedgePositions.map(p => p.accountId);
    const uniqueAccounts = new Set(accountIds);

    // 同一口座内両建てチェック
    if (hedge.hedgeType !== 'cross_account' && uniqueAccounts.size === 1) {
      issues.push({
        type: 'account_mismatch',
        severity: 'error',
        description: `同一口座内で両建てが行われています（口座: ${Array.from(uniqueAccounts).join(', ')}）`,
        affectedPositions: hedge.positionIds
      });
    }

    // クロスアカウント両建ての口座数チェック
    if (hedge.hedgeType === 'cross_account' && uniqueAccounts.size < 2) {
      issues.push({
        type: 'account_mismatch',
        severity: 'error',
        description: `クロスアカウント両建てなのに単一口座のみです`,
        affectedPositions: hedge.positionIds
      });
    }

    // 記録されている口座との整合性
    const recordedAccounts = new Set(hedge.accounts);
    const actualAccounts = uniqueAccounts;
    
    if (recordedAccounts.size !== actualAccounts.size || 
        !Array.from(recordedAccounts).every(acc => actualAccounts.has(acc))) {
      issues.push({
        type: 'account_mismatch',
        severity: 'warning',
        description: `記録されている口座情報と実際のポジションの口座が一致しません`,
        affectedPositions: hedge.positionIds
      });
    }

    return issues;
  }

  /**
   * タイムスタンプ検証
   */
  private static checkTimestamp(hedge: HedgePosition, allPositions: Position[]): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];
    const hedgePositions = allPositions.filter(p => hedge.positionIds.includes(p.id));
    
    if (hedgePositions.length < 2) return issues;

    // エントリー時間の差をチェック
    const timestamps = hedgePositions.map(p => new Date(p.openedAt).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeDiffMinutes = (maxTime - minTime) / (1000 * 60);

    if (timeDiffMinutes > this.MAX_TIMING_DIFF_MINUTES) {
      issues.push({
        type: 'timing_issue',
        severity: 'warning',
        description: `両建てポジション間のエントリー時間差が${timeDiffMinutes.toFixed(1)}分あります（許容値: ${this.MAX_TIMING_DIFF_MINUTES}分）`,
        affectedPositions: hedge.positionIds
      });
    }

    // 作成日時の整合性
    const hedgeCreatedAt = new Date(hedge.createdAt).getTime();
    const oldestPosition = Math.min(...timestamps);
    
    if (hedgeCreatedAt < oldestPosition - (5 * 60 * 1000)) { // 5分のマージン
      issues.push({
        type: 'timing_issue',
        severity: 'warning',
        description: `両建て作成日時がポジション開設日時より古すぎます`,
        affectedPositions: hedge.positionIds
      });
    }

    return issues;
  }

  /**
   * クロス両建て間の整合性チェック
   */
  private static checkCrossHedgeConsistency(hedges: HedgePosition[], allPositions: Position[]): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];
    const usedPositionIds = new Set<string>();

    // ポジション重複チェック
    for (const hedge of hedges) {
      for (const positionId of hedge.positionIds) {
        if (usedPositionIds.has(positionId)) {
          issues.push({
            type: 'orphaned_position',
            severity: 'error',
            description: `ポジション ${positionId} が複数の両建てグループで使用されています`,
            affectedPositions: [positionId]
          });
        }
        usedPositionIds.add(positionId);
      }
    }

    return issues;
  }

  /**
   * 孤立ポジション検出
   */
  private static detectOrphanedPositions(hedges: HedgePosition[], allPositions: Position[]): HedgeValidationIssue[] {
    const issues: HedgeValidationIssue[] = [];
    const managedPositionIds = new Set(hedges.flatMap(h => h.positionIds));
    const orphanedPositions = allPositions.filter(p => !managedPositionIds.has(p.id));

    for (const orphan of orphanedPositions) {
      // 同一通貨ペアで反対方向のポジションがある場合は警告
      const samePairOppositePositions = allPositions.filter(p => 
        p.symbol === orphan.symbol && 
        p.type !== orphan.type && 
        !managedPositionIds.has(p.id)
      );

      if (samePairOppositePositions.length > 0) {
        issues.push({
          type: 'orphaned_position',
          severity: 'warning',
          description: `${orphan.symbol}に両建て可能なポジションがありますが、管理されていません`,
          affectedPositions: [orphan.id, ...samePairOppositePositions.map(p => p.id)]
        });
      }
    }

    return issues;
  }

  /**
   * 推奨事項生成
   */
  private static generateRecommendations(hedge: HedgePosition, issues: HedgeValidationIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'lot_imbalance')) {
      recommendations.push('ロットバランスの調整を検討してください');
    }

    if (issues.some(i => i.type === 'account_mismatch' && i.severity === 'error')) {
      recommendations.push('リスク軽減のため、両建てポジションを異なる口座に配置してください');
    }

    if (issues.some(i => i.type === 'timing_issue')) {
      recommendations.push('同時エントリー機能の使用を検討してください');
    }

    if (hedge.settings.autoRebalance && issues.some(i => i.type === 'lot_imbalance')) {
      recommendations.push('自動リバランス機能が有効になっていますが、手動での確認も推奨します');
    }

    return recommendations;
  }

  /**
   * ロット不均衡の計算
   */
  private static calculateLotImbalance(hedge: HedgePosition): number {
    const totalLots = hedge.totalLots.buy + hedge.totalLots.sell;
    if (totalLots === 0) return 0;
    
    const imbalance = Math.abs(hedge.totalLots.buy - hedge.totalLots.sell);
    return (imbalance / totalLots) * 100;
  }

  /**
   * 検証結果のログ記録
   */
  private static async logValidationResult(hedge: HedgePosition, result: HedgeValidationResult): Promise<void> {
    const logEntry = {
      timestamp: new Date(),
      hedgeId: hedge.id,
      symbol: hedge.symbol,
      hedgeType: hedge.hedgeType,
      isValid: result.isValid,
      issueCount: result.issues.length,
      errorCount: result.issues.filter(i => i.severity === 'error').length,
      warningCount: result.issues.filter(i => i.severity === 'warning').length,
      issues: result.issues,
      recommendations: result.recommendations
    };

    try {
      // LocalStorage にログを保存（実装では外部ログサービスも検討）
      const existingLogs = JSON.parse(localStorage.getItem('hedge_validation_logs') || '[]');
      existingLogs.unshift(logEntry);

      // 古いログをクリーンアップ
      const cutoffTime = Date.now() - (this.LOG_RETENTION_HOURS * 60 * 60 * 1000);
      const filteredLogs = existingLogs.filter((log: any) => 
        new Date(log.timestamp).getTime() > cutoffTime
      );

      localStorage.setItem('hedge_validation_logs', JSON.stringify(filteredLogs.slice(0, 1000)));
      
      // コンソールログ
      if (!result.isValid) {
        console.warn(`[HedgeValidator] 両建てポジション ${hedge.id} に問題が検出されました:`, {
          symbol: hedge.symbol,
          errors: result.issues.filter(i => i.severity === 'error').length,
          warnings: result.issues.filter(i => i.severity === 'warning').length
        });
      }
    } catch (error) {
      console.error('Failed to log validation result:', error);
    }
  }

  /**
   * 批量検証結果のログ記録
   */
  private static async logBatchValidationResult(hedges: HedgePosition[], issues: HedgeValidationIssue[]): Promise<void> {
    const logEntry = {
      timestamp: new Date(),
      type: 'batch_validation',
      hedgeCount: hedges.length,
      totalIssues: issues.length,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      symbols: [...new Set(hedges.map(h => h.symbol))],
      hedgeTypes: [...new Set(hedges.map(h => h.hedgeType))]
    };

    try {
      const existingLogs = JSON.parse(localStorage.getItem('hedge_batch_validation_logs') || '[]');
      existingLogs.unshift(logEntry);
      localStorage.setItem('hedge_batch_validation_logs', JSON.stringify(existingLogs.slice(0, 100)));

      if (issues.length > 0) {
        console.warn(`[HedgeValidator] 批量検証で ${issues.length} 件の問題を検出:`, logEntry);
      }
    } catch (error) {
      console.error('Failed to log batch validation result:', error);
    }
  }

  /**
   * 検証結果に基づくアラート送信
   */
  private static async sendValidationAlerts(hedge: HedgePosition, result: HedgeValidationResult): Promise<void> {
    if (result.isValid) return; // 問題がない場合はアラートしない

    const errorIssues = result.issues.filter(i => i.severity === 'error');
    const warningIssues = result.issues.filter(i => i.severity === 'warning');

    try {
      // エラーレベルの問題がある場合は緊急アラート
      if (errorIssues.length > 0) {
        await notificationService.critical(
          '両建て整合性エラー',
          `${hedge.symbol} (ID: ${hedge.id.slice(-8)}) に重大な問題が ${errorIssues.length} 件検出されました`,
          {
            tag: `hedge-validation-${hedge.id}`,
            persistent: true
          }
        );

        // CLAUDE.md準拠のosascript通知
        await this.sendOSAScriptNotification(
          'エラー発生',
          `両建て検証エラー: ${hedge.symbol}`,
          'Basso'
        );
      }
      // 警告レベルの問題がある場合は通常アラート
      else if (warningIssues.length > 0) {
        await notificationService.warning(
          '両建て整合性警告',
          `${hedge.symbol} (ID: ${hedge.id.slice(-8)}) に警告レベルの問題が ${warningIssues.length} 件検出されました`,
          {
            tag: `hedge-validation-${hedge.id}`
          }
        );
      }

      // 特定の重要な問題に対する個別アラート
      const criticalIssues = errorIssues.filter(i => 
        i.type === 'account_mismatch' || i.type === 'orphaned_position'
      );

      for (const issue of criticalIssues) {
        await notificationService.error(
          `両建て${this.getIssueTypeDisplayName(issue.type)}`,
          issue.description,
          {
            tag: `hedge-issue-${issue.type}-${hedge.id}`
          }
        );
      }
    } catch (error) {
      console.error('Failed to send validation alerts:', error);
    }
  }

  /**
   * 自動修正の試行
   */
  private static async attemptAutoCorrection(hedge: HedgePosition, result: HedgeValidationResult): Promise<void> {
    // 注意: 自動修正は慎重に実装する必要があります
    // 現在の実装では推奨事項の生成のみを行い、実際の修正は手動で行うことを推奨

    const autoCorrectableIssues = result.issues.filter(issue => 
      issue.type === 'lot_imbalance' && issue.severity === 'warning'
    );

    if (autoCorrectableIssues.length === 0) return;

    try {
      await notificationService.info(
        '自動修正提案',
        `${hedge.symbol} の両建てポジションに自動修正可能な問題があります。修正提案: ${result.recommendations.slice(0, 2).join(', ')}`,
        {
          tag: `hedge-auto-correction-${hedge.id}`,
          persistent: true
        }
      );

      // 自動修正ログ
      const correctionLog = {
        timestamp: new Date(),
        hedgeId: hedge.id,
        symbol: hedge.symbol,
        autoCorrectableIssues: autoCorrectableIssues.length,
        recommendations: result.recommendations,
        status: 'proposed' // 'executed' would be for actual corrections
      };

      const existingLogs = JSON.parse(localStorage.getItem('hedge_auto_correction_logs') || '[]');
      existingLogs.unshift(correctionLog);
      localStorage.setItem('hedge_auto_correction_logs', JSON.stringify(existingLogs.slice(0, 100)));

    } catch (error) {
      console.error('Failed to attempt auto correction:', error);
    }
  }

  /**
   * osascript通知送信（CLAUDE.md準拠）
   */
  private static async sendOSAScriptNotification(title: string, message: string, sound: string = 'Glass'): Promise<void> {
    try {
      await invoke('run_osascript', {
        script: `display notification "${message}" with title "${title}" sound name "${sound}"`
      });
    } catch (error) {
      console.warn('Failed to send osascript notification:', error);
    }
  }

  /**
   * 問題タイプの表示名取得
   */
  private static getIssueTypeDisplayName(type: HedgeValidationIssue['type']): string {
    const displayNames: Record<HedgeValidationIssue['type'], string> = {
      'lot_imbalance': 'ロット不均衡',
      'account_mismatch': '口座不整合',
      'timing_issue': 'タイミング問題',
      'orphaned_position': '孤立ポジション'
    };
    return displayNames[type] || type;
  }
}
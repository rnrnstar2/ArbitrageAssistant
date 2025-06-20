import { v4 as uuidv4 } from 'uuid';
import { HedgePosition, HedgeValidationResult } from './types';
import { Position } from '../close/types';
import { PositionRelationManager } from './PositionRelationManager';
import { HedgePositionValidator } from './HedgePositionValidator';
import { HedgeExecutor, HedgeExecutionCriteria } from './HedgeExecutor';
import { WebSocketClient } from '../../../../lib/websocket/message-types';

/**
 * 維持管理結果
 */
export interface MaintenanceResult {
  maintenanceId: string;
  hedgeId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  operations: MaintenanceOperation[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  rollbackRequired: boolean;
}

/**
 * 維持管理操作
 */
export interface MaintenanceOperation {
  id: string;
  type: 'close' | 'reopen' | 'adjust' | 'validate';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  positionId?: string;
  details: any;
  executedAt?: Date;
  error?: string;
}

/**
 * 維持管理設定
 */
export interface MaintenanceSettings {
  enabled: boolean;
  scheduleType: 'daily' | 'weekly' | 'manual';
  executionTime?: string; // HH:MM format
  weekday?: number; // 0-6 (Sunday-Saturday)
  swapAvoidanceThreshold: number; // hours
  maxRetries: number;
  retryDelay: number; // milliseconds
  emergencyMaintenance: boolean;
}

/**
 * スケジュール情報
 */
export interface MaintenanceSchedule {
  id: string;
  hedgeId: string;
  scheduledAt: Date;
  type: 'daily' | 'weekly' | 'emergency';
  status: 'scheduled' | 'executing' | 'completed' | 'failed' | 'cancelled';
  settings: MaintenanceSettings;
  createdAt: Date;
  attempts: number;
}

/**
 * 履歴保存項目
 */
export interface HedgeHistory {
  id: string;
  hedgeId: string;
  type: 'maintenance' | 'creation' | 'modification' | 'deletion';
  snapshot: HedgePosition;
  operations: MaintenanceOperation[];
  timestamp: Date;
  metadata: {
    trigger: string;
    reason: string;
    userInitiated: boolean;
  };
}

/**
 * 両建て維持管理システム
 */
export class HedgeMaintenanceManager {
  private relationManager: PositionRelationManager;
  private validator: HedgePositionValidator;
  private executor: HedgeExecutor;
  private wsClient: WebSocketClient;
  
  private activeMaintenances = new Map<string, MaintenanceResult>();
  private schedules = new Map<string, MaintenanceSchedule>();
  private history = new Map<string, HedgeHistory[]>();
  private settings: MaintenanceSettings;
  
  private schedulerInterval?: NodeJS.Timeout;
  private maintenanceTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    relationManager: PositionRelationManager,
    validator: HedgePositionValidator,
    executor: HedgeExecutor,
    wsClient: WebSocketClient,
    settings?: Partial<MaintenanceSettings>
  ) {
    this.relationManager = relationManager;
    this.validator = validator;
    this.executor = executor;
    this.wsClient = wsClient;
    
    this.settings = {
      enabled: true,
      scheduleType: 'daily',
      executionTime: '23:00',
      swapAvoidanceThreshold: 22, // 22時間後にスワップ発生
      maxRetries: 3,
      retryDelay: 5000,
      emergencyMaintenance: true,
      ...settings
    };

    if (this.settings.enabled) {
      this.startScheduler();
    }
  }

  /**
   * 日次整理時の両建て維持
   */
  async maintainHedgeDuringCleanup(hedge: HedgePosition): Promise<MaintenanceResult> {
    const maintenanceId = this.generateMaintenanceId();
    
    const result: MaintenanceResult = {
      maintenanceId,
      hedgeId: hedge.id,
      status: 'executing',
      operations: [],
      startedAt: new Date(),
      rollbackRequired: false
    };

    this.activeMaintenances.set(maintenanceId, result);

    try {
      // 履歴の保存
      await this.preserveHedgeHistory(hedge, 'maintenance', 'Daily cleanup maintenance');

      // 事前バリデーション
      const validation = await this.validateMaintenanceConditions(hedge);
      if (!validation.isValid) {
        throw new Error(`Maintenance validation failed: ${validation.issues.map(i => i.description).join(', ')}`);
      }

      // 同時決済・再エントリー実行
      await this.executeSimultaneousCloseReopen(hedge, result);

      // 事後バリデーション
      const updatedHedge = this.relationManager.getAllHedgePositions()
        .find(h => h.id === hedge.id);
      
      if (updatedHedge) {
        const integrityCheck = this.validateMaintenanceIntegrity(hedge, updatedHedge);
        if (!integrityCheck) {
          throw new Error('Maintenance integrity check failed');
        }
      }

      result.status = 'completed';
      result.completedAt = new Date();

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.rollbackRequired = this.shouldRollbackMaintenance(result);
      
      // エラー時の復旧処理
      if (result.rollbackRequired) {
        await this.rollbackMaintenance(result);
      }
    }

    return result;
  }

  /**
   * 同時決済・再エントリー実行
   */
  async executeSimultaneousCloseReopen(
    hedge: HedgePosition, 
    result?: MaintenanceResult
  ): Promise<void> {
    const closeOperation: MaintenanceOperation = {
      id: uuidv4(),
      type: 'close',
      status: 'executing',
      details: { hedgeId: hedge.id, reason: 'maintenance_cleanup' }
    };

    const reopenOperation: MaintenanceOperation = {
      id: uuidv4(),
      type: 'reopen',
      status: 'pending',
      details: { hedgeId: hedge.id, reason: 'maintenance_restore' }
    };

    if (result) {
      result.operations.push(closeOperation, reopenOperation);
    }

    try {
      // 1. 現在のポジション情報を記録
      const currentPositions = await this.getCurrentPositions(hedge.positionIds);
      
      // 2. 決済の実行
      closeOperation.status = 'executing';
      await this.closeAllPositions(hedge.positionIds);
      closeOperation.status = 'completed';
      closeOperation.executedAt = new Date();

      // 3. 短時間待機（価格安定化のため）
      await this.delay(1000);

      // 4. 再エントリーの実行
      reopenOperation.status = 'executing';
      await this.reopenPositions(hedge, currentPositions);
      reopenOperation.status = 'completed';
      reopenOperation.executedAt = new Date();

    } catch (error) {
      closeOperation.status = 'failed';
      closeOperation.error = error instanceof Error ? error.message : 'Close operation failed';
      
      reopenOperation.status = 'failed';
      reopenOperation.error = 'Failed due to close operation failure';
      
      throw error;
    }
  }

  /**
   * 履歴の保存
   */
  async preserveHedgeHistory(
    hedge: HedgePosition,
    type: HedgeHistory['type'] = 'maintenance',
    reason: string = 'Maintenance operation'
  ): Promise<void> {
    const historyEntry: HedgeHistory = {
      id: uuidv4(),
      hedgeId: hedge.id,
      type,
      snapshot: { ...hedge },
      operations: [],
      timestamp: new Date(),
      metadata: {
        trigger: 'system',
        reason,
        userInitiated: false
      }
    };

    const hedgeHistory = this.history.get(hedge.id) || [];
    hedgeHistory.push(historyEntry);
    
    // 履歴の上限管理（最新30件まで保持）
    if (hedgeHistory.length > 30) {
      hedgeHistory.splice(0, hedgeHistory.length - 30);
    }
    
    this.history.set(hedge.id, hedgeHistory);
  }

  /**
   * 維持管理整合性チェック
   */
  validateMaintenanceIntegrity(before: HedgePosition, after: HedgePosition): boolean {
    // 基本的なフィールドの一致チェック
    if (before.symbol !== after.symbol) return false;
    if (before.hedgeType !== after.hedgeType) return false;
    if (before.accounts.length !== after.accounts.length) return false;
    
    // ロット数の一致チェック（多少の誤差は許容）
    const buyLotDiff = Math.abs(before.totalLots.buy - after.totalLots.buy);
    const sellLotDiff = Math.abs(before.totalLots.sell - after.totalLots.sell);
    
    if (buyLotDiff > 0.01 || sellLotDiff > 0.01) {
      return false;
    }

    // バランス状態の確認
    if (before.isBalanced !== after.isBalanced) {
      return false;
    }

    return true;
  }

  /**
   * 緊急維持管理の実行
   */
  async executeEmergencyMaintenance(hedgeId: string, reason: string): Promise<MaintenanceResult> {
    if (!this.settings.emergencyMaintenance) {
      throw new Error('Emergency maintenance is disabled');
    }

    const hedge = this.relationManager.getAllHedgePositions()
      .find(h => h.id === hedgeId);
    
    if (!hedge) {
      throw new Error(`Hedge position ${hedgeId} not found`);
    }

    // 緊急維持管理の履歴記録
    await this.preserveHedgeHistory(hedge, 'maintenance', `Emergency: ${reason}`);

    return this.maintainHedgeDuringCleanup(hedge);
  }

  /**
   * 維持管理スケジュールの作成
   */
  scheduleMaintenanceTask(hedgeId: string, scheduledAt: Date, type: 'daily' | 'weekly' | 'emergency' = 'daily'): MaintenanceSchedule {
    const schedule: MaintenanceSchedule = {
      id: uuidv4(),
      hedgeId,
      scheduledAt,
      type,
      status: 'scheduled',
      settings: { ...this.settings },
      createdAt: new Date(),
      attempts: 0
    };

    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  /**
   * スケジュールされた維持管理の実行
   */
  async executeScheduledMaintenance(scheduleId: string): Promise<MaintenanceResult> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    if (schedule.status !== 'scheduled') {
      throw new Error(`Schedule ${scheduleId} is not in scheduled status`);
    }

    const hedge = this.relationManager.getAllHedgePositions()
      .find(h => h.id === schedule.hedgeId);
    
    if (!hedge) {
      throw new Error(`Hedge position ${schedule.hedgeId} not found`);
    }

    schedule.status = 'executing';
    schedule.attempts++;

    try {
      const result = await this.maintainHedgeDuringCleanup(hedge);
      schedule.status = result.status === 'completed' ? 'completed' : 'failed';
      return result;
    } catch (error) {
      schedule.status = 'failed';
      throw error;
    }
  }

  /**
   * 維持管理のキャンセル
   */
  async cancelMaintenance(maintenanceId: string): Promise<void> {
    const maintenance = this.activeMaintenances.get(maintenanceId);
    if (!maintenance) {
      throw new Error(`Maintenance ${maintenanceId} not found`);
    }

    if (maintenance.status === 'completed' || maintenance.status === 'failed') {
      throw new Error(`Cannot cancel maintenance in status: ${maintenance.status}`);
    }

    // タイムアウトクリア
    const timeout = this.maintenanceTimeouts.get(maintenanceId);
    if (timeout) {
      clearTimeout(timeout);
      this.maintenanceTimeouts.delete(maintenanceId);
    }

    maintenance.status = 'failed';
    maintenance.error = 'Cancelled by user';
    maintenance.completedAt = new Date();
  }

  /**
   * 維持管理統計の取得
   */
  getMaintenanceStatistics(): {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    averageExecutionTime: number;
  } {
    const maintenances = Array.from(this.activeMaintenances.values());
    
    const completed = maintenances.filter(m => m.status === 'completed').length;
    const failed = maintenances.filter(m => m.status === 'failed').length;
    const pending = maintenances.filter(m => m.status === 'pending' || m.status === 'executing').length;
    
    const completedMaintenances = maintenances.filter(m => m.status === 'completed' && m.completedAt);
    const averageExecutionTime = completedMaintenances.length > 0
      ? completedMaintenances.reduce((sum, m) => 
          sum + (m.completedAt!.getTime() - m.startedAt.getTime()), 0) / completedMaintenances.length
      : 0;

    return {
      total: maintenances.length,
      completed,
      failed,
      pending,
      averageExecutionTime: Math.round(averageExecutionTime)
    };
  }

  /**
   * スケジューラーの開始
   */
  private startScheduler(): void {
    // 1分間隔でスケジュールをチェック
    this.schedulerInterval = setInterval(() => {
      this.checkScheduledTasks();
    }, 60000);
  }

  /**
   * スケジューラーの停止
   */
  private stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
  }

  /**
   * スケジュールされたタスクのチェック
   */
  private async checkScheduledTasks(): Promise<void> {
    const now = new Date();
    
    for (const [scheduleId, schedule] of this.schedules) {
      if (schedule.status === 'scheduled' && schedule.scheduledAt <= now) {
        try {
          await this.executeScheduledMaintenance(scheduleId);
        } catch (error) {
          console.error(`Failed to execute scheduled maintenance ${scheduleId}:`, error);
          
          // リトライ可能な場合は再スケジュール
          if (schedule.attempts < this.settings.maxRetries) {
            schedule.scheduledAt = new Date(now.getTime() + this.settings.retryDelay);
            schedule.status = 'scheduled';
          }
        }
      }
    }
  }

  /**
   * 維持管理条件のバリデーション
   */
  private async validateMaintenanceConditions(hedge: HedgePosition): Promise<HedgeValidationResult> {
    // 基本的なバリデーション
    const validation = this.validator.validateHedgePosition(hedge, []);
    
    // スワップ回避の必要性チェック
    const swapThreshold = new Date();
    swapThreshold.setHours(swapThreshold.getHours() - this.settings.swapAvoidanceThreshold);
    
    if (hedge.createdAt < swapThreshold) {
      validation.recommendations.push('Swap avoidance maintenance recommended');
    }

    return validation;
  }

  /**
   * 現在のポジション取得
   */
  private async getCurrentPositions(positionIds: string[]): Promise<Position[]> {
    // WebSocketクライアント経由でポジション情報を取得
    // 実装は具体的なWebSocketプロトコルに依存
    return []; // プレースホルダー
  }

  /**
   * 全ポジションの決済
   */
  private async closeAllPositions(positionIds: string[]): Promise<void> {
    // WebSocketクライアント経由でポジション決済を実行
    // 実装は具体的なWebSocketプロトコルに依存
  }

  /**
   * ポジションの再オープン
   */
  private async reopenPositions(hedge: HedgePosition, originalPositions: Position[]): Promise<void> {
    // 元のポジション情報を基に再エントリーを実行
    const criteria: HedgeExecutionCriteria = {
      symbol: hedge.symbol,
      hedgeType: hedge.hedgeType,
      accounts: hedge.accounts,
      lotSizes: hedge.totalLots,
      executionMode: 'simultaneous',
      timing: {
        maxDelay: 5000
      },
      priceSettings: {
        orderType: 'market'
      },
      riskManagement: {}
    };

    await this.executor.executeHedge(criteria);
  }

  /**
   * ロールバック必要性の判定
   */
  private shouldRollbackMaintenance(result: MaintenanceResult): boolean {
    const failedOperations = result.operations.filter(op => op.status === 'failed');
    const criticalFailures = failedOperations.filter(op => op.type === 'close' || op.type === 'reopen');
    
    return criticalFailures.length > 0;
  }

  /**
   * 維持管理のロールバック
   */
  private async rollbackMaintenance(result: MaintenanceResult): Promise<void> {
    // ロールバック操作の実装
    // 失敗した操作を逆順で実行
    console.warn(`Rolling back maintenance ${result.maintenanceId}`);
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 維持管理IDの生成
   */
  private generateMaintenanceId(): string {
    return `maintenance_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.stopScheduler();
    
    // タイムアウトをクリア
    this.maintenanceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.maintenanceTimeouts.clear();

    // データをクリア
    this.activeMaintenances.clear();
    this.schedules.clear();
    this.history.clear();
  }
}
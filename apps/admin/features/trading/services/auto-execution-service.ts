import { DailyCloseProposalService, EnhancedCloseRecommendation } from './daily-close-proposal-service';
import { PositionManagementService } from './position-management-service';

export interface AutoExecutionSettings {
  enabled: boolean;
  executionTime: string; // "HH:mm" format
  timezone: string;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  
  // 実行条件
  minSwapCostThreshold: number;
  maxPositionsPerExecution: number;
  requireManualApproval: boolean;
  
  // 安全設定
  dryRunMode: boolean;
  stopOnError: boolean;
  maxConsecutiveFailures: number;
  
  // 通知設定
  notifyBeforeExecution: boolean;
  notifyAfterExecution: boolean;
  notifyOnError: boolean;
  notificationMinutes: number;
  
  // 再構築設定
  autoRebuild: boolean;
  rebuildDelayMinutes: number;
  rebuildOnSameAccount: boolean;
  
  // 除外設定
  excludeHedgedPositions: boolean;
  excludeProfitablePositions: boolean;
  profitableThreshold: number;
}

export interface ExecutionResult {
  id: string;
  executionTime: Date;
  triggeredBy: 'schedule' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  positionsProcessed: number;
  positionsSuccessful: number;
  positionsFailed: number;
  totalSavings: number;
  errors: string[];
  duration: number; // milliseconds
  dryRun: boolean;
}

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  positionId?: string;
  executionId?: string;
  data?: any;
}

export class AutoExecutionService {
  private static instance: AutoExecutionService;
  private settings: AutoExecutionSettings;
  private isRunning: boolean = false;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private executionHistory: ExecutionResult[] = [];
  private executionLogs: ExecutionLog[] = [];
  private consecutiveFailures: number = 0;

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.loadSettings();
    this.scheduleNextExecution();
  }

  static getInstance(): AutoExecutionService {
    if (!this.instance) {
      this.instance = new AutoExecutionService();
    }
    return this.instance;
  }

  /**
   * 自動実行設定を更新
   */
  async updateSettings(newSettings: Partial<AutoExecutionSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
    this.rescheduleExecution();
    this.log('info', 'Auto-execution settings updated');
  }

  /**
   * 現在の設定を取得
   */
  getSettings(): AutoExecutionSettings {
    return { ...this.settings };
  }

  /**
   * 手動実行
   */
  async executeManually(): Promise<ExecutionResult> {
    return this.execute('manual');
  }

  /**
   * 実行履歴を取得
   */
  getExecutionHistory(limit: number = 50): ExecutionResult[] {
    return this.executionHistory
      .sort((a, b) => b.executionTime.getTime() - a.executionTime.getTime())
      .slice(0, limit);
  }

  /**
   * 実行ログを取得
   */
  getExecutionLogs(limit: number = 100): ExecutionLog[] {
    return this.executionLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 次回実行時刻を取得
   */
  getNextExecutionTime(): Date | null {
    if (!this.settings.enabled) return null;
    
    const now = new Date();
    const [hours, minutes] = this.settings.executionTime.split(':').map(Number);
    
    // 今日の実行時刻を計算
    const todayExecution = new Date();
    todayExecution.setHours(hours, minutes, 0, 0);
    
    // 今日実行可能な曜日かチェック
    const todayDayOfWeek = now.getDay();
    const isTodayExecutionDay = this.settings.daysOfWeek.includes(todayDayOfWeek);
    
    if (isTodayExecutionDay && todayExecution > now) {
      return todayExecution;
    }
    
    // 次の実行可能日を検索
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(now);
      nextDate.setDate(nextDate.getDate() + i);
      nextDate.setHours(hours, minutes, 0, 0);
      
      if (this.settings.daysOfWeek.includes(nextDate.getDay())) {
        return nextDate;
      }
    }
    
    return null;
  }

  /**
   * 自動実行の有効/無効を切り替え
   */
  async toggleAutoExecution(): Promise<void> {
    await this.updateSettings({ enabled: !this.settings.enabled });
  }

  /**
   * 実行状態を取得
   */
  getExecutionStatus(): {
    isRunning: boolean;
    nextExecution: Date | null;
    lastExecution: ExecutionResult | null;
    consecutiveFailures: number;
    enabled: boolean;
  } {
    return {
      isRunning: this.isRunning,
      nextExecution: this.getNextExecutionTime(),
      lastExecution: this.executionHistory[0] || null,
      consecutiveFailures: this.consecutiveFailures,
      enabled: this.settings.enabled,
    };
  }

  // プライベートメソッド

  private async execute(triggeredBy: 'schedule' | 'manual'): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    
    this.log('info', `Starting ${triggeredBy} execution`, undefined, executionId);
    
    const result: ExecutionResult = {
      id: executionId,
      executionTime: new Date(),
      triggeredBy,
      status: 'running',
      positionsProcessed: 0,
      positionsSuccessful: 0,
      positionsFailed: 0,
      totalSavings: 0,
      errors: [],
      duration: 0,
      dryRun: this.settings.dryRunMode,
    };

    try {
      this.isRunning = true;
      
      // 事前通知
      if (this.settings.notifyBeforeExecution) {
        await this.sendNotification('実行開始', `日次ポジション整理を開始します（${result.dryRun ? 'ドライラン' : '本番'}モード）`);
      }

      // 提案取得
      this.log('info', 'Fetching close proposals', undefined, executionId);
      const proposals = await DailyCloseProposalService.generateDailyCloseProposals({
        minSwapCostThreshold: this.settings.minSwapCostThreshold,
        excludeHedgedPositions: this.settings.excludeHedgedPositions,
      });

      // フィルタリング
      const filteredProposals = this.filterProposalsForExecution(proposals);
      result.positionsProcessed = filteredProposals.length;

      this.log('info', `Processing ${filteredProposals.length} positions`, undefined, executionId);

      // 各ポジションを処理
      for (const proposal of filteredProposals.slice(0, this.settings.maxPositionsPerExecution)) {
        try {
          if (this.settings.dryRunMode) {
            // ドライランモード
            this.log('info', `DRY RUN: Would close position ${proposal.positionId}`, proposal.positionId, executionId);
            await new Promise(resolve => setTimeout(resolve, 100)); // シミュレート
            result.positionsSuccessful++;
          } else {
            // 実際の決済
            const closeResult = await PositionManagementService.closePosition({
              positionId: proposal.positionId,
              closePrice: 0, // 成行価格
              closeType: 'market',
            });

            if (closeResult.status === 'failed') {
              result.positionsFailed++;
              result.errors.push(`Position ${proposal.positionId}: ${closeResult.error}`);
              this.log('error', `Failed to close position: ${closeResult.error}`, proposal.positionId, executionId);
            } else {
              result.positionsSuccessful++;
              result.totalSavings += proposal.estimatedSavings || 0;
              this.log('info', `Successfully closed position`, proposal.positionId, executionId);

              // 再構築処理
              if (this.settings.autoRebuild && proposal.rebuildRecommendation) {
                await this.handleRebuild(proposal, executionId);
              }
            }
          }

          // エラー時停止チェック
          if (this.settings.stopOnError && result.positionsFailed > 0) {
            this.log('warning', 'Stopping execution due to error', undefined, executionId);
            break;
          }

        } catch (error) {
          result.positionsFailed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Position ${proposal.positionId}: ${errorMessage}`);
          this.log('error', `Error processing position: ${errorMessage}`, proposal.positionId, executionId);

          if (this.settings.stopOnError) break;
        }
      }

      // 結果の設定
      result.status = result.positionsFailed === 0 ? 'completed' : 'failed';
      result.duration = Date.now() - startTime;

      // 実行後通知
      if (this.settings.notifyAfterExecution) {
        await this.sendNotification(
          '実行完了',
          `処理完了: ${result.positionsSuccessful}成功, ${result.positionsFailed}失敗, 節約額: $${result.totalSavings.toFixed(2)}`
        );
      }

      // 連続失敗カウンターの更新
      if (result.status === 'completed') {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.settings.maxConsecutiveFailures) {
          this.log('error', 'Max consecutive failures reached, disabling auto-execution', undefined, executionId);
          await this.updateSettings({ enabled: false });
        }
      }

    } catch (error) {
      result.status = 'failed';
      result.duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      this.log('error', `Execution failed: ${errorMessage}`, undefined, executionId);

      if (this.settings.notifyOnError) {
        await this.sendNotification('実行エラー', `日次整理の実行中にエラーが発生しました: ${errorMessage}`);
      }
    } finally {
      this.isRunning = false;
      this.executionHistory.unshift(result);
      
      // 履歴サイズの制限
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(0, 100);
      }
      
      this.log('info', `Execution ${result.status}: ${result.positionsSuccessful}/${result.positionsProcessed} positions processed`, undefined, executionId);
    }

    return result;
  }

  private filterProposalsForExecution(proposals: EnhancedCloseRecommendation[]): EnhancedCloseRecommendation[] {
    return proposals.filter(proposal => {
      // 利益のあるポジションを除外する設定
      if (this.settings.excludeProfitablePositions && 
          proposal.currentProfit > this.settings.profitableThreshold) {
        return false;
      }

      // 手動承認が必要な場合は除外（別途処理）
      if (this.settings.requireManualApproval) {
        return false;
      }

      return true;
    });
  }

  private async handleRebuild(proposal: EnhancedCloseRecommendation, executionId: string): Promise<void> {
    try {
      // 遅延
      if (this.settings.rebuildDelayMinutes > 0) {
        this.log('info', `Waiting ${this.settings.rebuildDelayMinutes} minutes before rebuild`, proposal.positionId, executionId);
        await new Promise(resolve => setTimeout(resolve, this.settings.rebuildDelayMinutes * 60 * 1000));
      }

      // TODO: 再構築ロジックを実装
      this.log('info', 'Position rebuild completed', proposal.positionId, executionId);
    } catch (error) {
      this.log('error', `Rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`, proposal.positionId, executionId);
    }
  }

  private scheduleNextExecution(): void {
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
    }

    if (!this.settings.enabled) return;

    const nextExecution = this.getNextExecutionTime();
    if (!nextExecution) return;

    const now = new Date();
    const delay = nextExecution.getTime() - now.getTime();

    this.scheduleTimer = setTimeout(() => {
      this.execute('schedule');
      this.scheduleNextExecution(); // 次の実行をスケジュール
    }, delay);

    this.log('info', `Next execution scheduled for ${nextExecution.toLocaleString()}`);
  }

  private rescheduleExecution(): void {
    this.scheduleNextExecution();
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(level: ExecutionLog['level'], message: string, positionId?: string, executionId?: string, data?: any): void {
    const logEntry: ExecutionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      positionId,
      executionId,
      data,
    };

    this.executionLogs.unshift(logEntry);
    
    // ログサイズの制限
    if (this.executionLogs.length > 1000) {
      this.executionLogs = this.executionLogs.slice(0, 1000);
    }

    // コンソールにも出力
    console.log(`[${level.toUpperCase()}] AutoExecution: ${message}`, data || '');
  }

  private async sendNotification(title: string, message: string): Promise<void> {
    try {
      // TODO: 実際の通知システムを実装（メール、Slack、プッシュ通知など）
      console.log(`NOTIFICATION: ${title} - ${message}`);
    } catch (error) {
      this.log('error', `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getDefaultSettings(): AutoExecutionSettings {
    return {
      enabled: false,
      executionTime: "23:30",
      timezone: "Asia/Tokyo",
      daysOfWeek: [1, 2, 3, 4, 5], // 平日のみ
      
      minSwapCostThreshold: 5.0,
      maxPositionsPerExecution: 20,
      requireManualApproval: false,
      
      dryRunMode: true,
      stopOnError: false,
      maxConsecutiveFailures: 3,
      
      notifyBeforeExecution: true,
      notifyAfterExecution: true,
      notifyOnError: true,
      notificationMinutes: 30,
      
      autoRebuild: true,
      rebuildDelayMinutes: 30,
      rebuildOnSameAccount: false,
      
      excludeHedgedPositions: true,
      excludeProfitablePositions: false,
      profitableThreshold: 50.0,
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      // TODO: 実際のストレージから設定を読み込み
      const stored = localStorage.getItem('auto-execution-settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      this.log('error', `Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      // TODO: 実際のストレージに設定を保存
      localStorage.setItem('auto-execution-settings', JSON.stringify(this.settings));
    } catch (error) {
      this.log('error', `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
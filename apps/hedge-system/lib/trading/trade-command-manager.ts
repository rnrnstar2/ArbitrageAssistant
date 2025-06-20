import {
  OpenPositionCommand,
  ClosePositionCommand,
  UpdateTrailCommand,
  TestConnectionCommand,
  SystemConfigCommand,
  AccountInfo,
} from '../websocket/message-types';
import { TradeCommandSender, type CommandResult } from './trade-command-sender';
import { TradeSafetyValidator } from './trade-safety-validator';

export interface PendingCommand {
  commandId: string;
  commandType: string;
  accountId: string;
  command: any;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  retryCount: number;
}

export interface CommandHistory {
  commandId: string;
  commandType: string;
  accountId: string;
  command: any;
  result: CommandResult;
  executedAt: Date;
}

export interface TradeCommandManagerOptions {
  commandSender: TradeCommandSender;
  safetyValidator: TradeSafetyValidator;
  maxPendingCommands?: number;
  commandHistoryLimit?: number;
}

export class TradeCommandManager {
  private commandSender: TradeCommandSender;
  private safetyValidator: TradeSafetyValidator;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private commandHistory: CommandHistory[] = [];
  private maxPendingCommands: number;
  private commandHistoryLimit: number;

  constructor(options: TradeCommandManagerOptions) {
    this.commandSender = options.commandSender;
    this.safetyValidator = options.safetyValidator;
    this.maxPendingCommands = options.maxPendingCommands || 50;
    this.commandHistoryLimit = options.commandHistoryLimit || 1000;
  }

  /**
   * ポジションオープンコマンドの実行
   */
  async executeOpenPositionCommand(
    accountId: string,
    command: OpenPositionCommand,
    accountInfo?: AccountInfo
  ): Promise<CommandResult> {
    return this.executeCommand(
      'open_position',
      accountId,
      command,
      async () => {
        if (accountInfo) {
          await this.validateCommand(command, accountInfo);
        }
        return this.commandSender.sendOpenPositionCommand(accountId, command);
      }
    );
  }

  /**
   * ポジションクローズコマンドの実行
   */
  async executeClosePositionCommand(
    accountId: string,
    command: ClosePositionCommand
  ): Promise<CommandResult> {
    return this.executeCommand(
      'close_position',
      accountId,
      command,
      async () => {
        await this.validateCloseCommand(command);
        return this.commandSender.sendClosePositionCommand(accountId, command);
      }
    );
  }

  /**
   * ポジション修正コマンドの実行
   */
  async executeModifyPositionCommand(
    accountId: string,
    command: UpdateTrailCommand
  ): Promise<CommandResult> {
    return this.executeCommand(
      'modify_position',
      accountId,
      command,
      async () => {
        await this.validateModifyCommand(command);
        return this.commandSender.sendModifyPositionCommand(accountId, command);
      }
    );
  }

  /**
   * トレール設定コマンドの実行
   */
  async executeTrailCommand(
    accountId: string,
    command: UpdateTrailCommand
  ): Promise<CommandResult> {
    return this.executeCommand(
      'update_trail',
      accountId,
      command,
      async () => {
        await this.validateTrailCommand(command);
        return this.commandSender.sendTrailCommand(accountId, command);
      }
    );
  }

  /**
   * 接続テストコマンドの実行
   */
  async executeTestConnectionCommand(
    accountId: string,
    command: TestConnectionCommand
  ): Promise<CommandResult> {
    return this.executeCommand(
      'test_connection',
      accountId,
      command,
      async () => {
        return this.commandSender.sendTestConnectionCommand(accountId, command);
      }
    );
  }

  /**
   * システム設定コマンドの実行
   */
  async executeSystemConfigCommand(
    accountId: string,
    command: SystemConfigCommand
  ): Promise<CommandResult> {
    return this.executeCommand(
      'system_config',
      accountId,
      command,
      async () => {
        return this.commandSender.sendSystemConfigCommand(accountId, command);
      }
    );
  }

  /**
   * 汎用コマンド実行
   */
  private async executeCommand(
    commandType: string,
    accountId: string,
    command: any,
    executor: () => Promise<CommandResult>
  ): Promise<CommandResult> {
    // ペンディングコマンド数チェック
    if (this.pendingCommands.size >= this.maxPendingCommands) {
      throw new Error(`Maximum pending commands limit reached (${this.maxPendingCommands})`);
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // ペンディングコマンドとして登録
    const pendingCommand: PendingCommand = {
      commandId,
      commandType,
      accountId,
      command,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
    };

    this.pendingCommands.set(commandId, pendingCommand);

    try {
      // ステータス更新: 実行中
      pendingCommand.status = 'executing';
      pendingCommand.executedAt = new Date();

      // コマンド実行
      const result = await executor();

      // ステータス更新: 完了
      pendingCommand.status = result.status;
      pendingCommand.completedAt = new Date();
      pendingCommand.result = result;

      // 履歴に追加
      this.addToHistory({
        commandId,
        commandType,
        accountId,
        command,
        result,
        executedAt: pendingCommand.executedAt,
      });

      // ペンディングリストから削除
      this.pendingCommands.delete(commandId);

      return result;

    } catch (error) {
      // エラー処理
      pendingCommand.status = 'failed';
      pendingCommand.error = error instanceof Error ? error.message : 'Unknown error';
      pendingCommand.completedAt = new Date();

      const errorResult: CommandResult = {
        commandId,
        status: 'failed',
        error: pendingCommand.error,
        timestamp: new Date(),
      };

      // 履歴に追加
      this.addToHistory({
        commandId,
        commandType,
        accountId,
        command,
        result: errorResult,
        executedAt: pendingCommand.executedAt || new Date(),
      });

      // ペンディングリストから削除
      this.pendingCommands.delete(commandId);

      throw error;
    }
  }

  /**
   * オープンポジションコマンドの検証
   */
  private async validateCommand(command: OpenPositionCommand, accountInfo: AccountInfo): Promise<void> {
    // 残高チェック
    if (!this.safetyValidator.validateBalance(command, accountInfo)) {
      throw new Error('Insufficient balance for the trade');
    }

    // 証拠金チェック
    if (!this.safetyValidator.validateMargin(command, accountInfo)) {
      throw new Error('Insufficient margin for the trade');
    }

    // ロットサイズチェック
    if (!this.safetyValidator.validateLotSize(command)) {
      throw new Error('Invalid lot size');
    }

    // 市場時間チェック
    if (!this.safetyValidator.validateMarketHours(command.symbol)) {
      throw new Error('Market is closed');
    }

    // 価格範囲チェック（現在価格が必要な場合）
    // この部分は現在価格を取得するロジックが必要
  }

  /**
   * クローズコマンドの検証
   */
  private async validateCloseCommand(command: ClosePositionCommand): Promise<void> {
    if (!command.positionId) {
      throw new Error('Position ID is required');
    }

    if (command.lots && command.lots <= 0) {
      throw new Error('Invalid lot size for partial close');
    }
  }

  /**
   * 修正コマンドの検証
   */
  private async validateModifyCommand(command: UpdateTrailCommand): Promise<void> {
    if (!command.positionId) {
      throw new Error('Position ID is required');
    }

    if (command.trailAmount <= 0) {
      throw new Error('Trail amount must be positive');
    }
  }

  /**
   * トレールコマンドの検証
   */
  private async validateTrailCommand(command: UpdateTrailCommand): Promise<void> {
    await this.validateModifyCommand(command);
  }

  /**
   * 重複オーダーのチェック
   */
  private async checkDuplicateOrder(command: any): Promise<void> {
    // 同じ通貨ペア、同じロット数、同じタイプの注文が既にペンディング中かチェック
    const duplicates = Array.from(this.pendingCommands.values()).filter(pending => {
      if (pending.status !== 'pending' && pending.status !== 'executing') {
        return false;
      }

      const pendingCmd = pending.command;
      return (
        pendingCmd.symbol === command.symbol &&
        pendingCmd.type === command.type &&
        pendingCmd.lots === command.lots
      );
    });

    if (duplicates.length > 0) {
      throw new Error('Duplicate order detected');
    }
  }

  /**
   * 履歴に追加
   */
  private addToHistory(historyEntry: CommandHistory): void {
    this.commandHistory.unshift(historyEntry);

    // 履歴数制限
    if (this.commandHistory.length > this.commandHistoryLimit) {
      this.commandHistory = this.commandHistory.slice(0, this.commandHistoryLimit);
    }
  }

  /**
   * ペンディングコマンドの取得
   */
  getPendingCommands(): PendingCommand[] {
    return Array.from(this.pendingCommands.values());
  }

  /**
   * 特定アカウントのペンディングコマンドの取得
   */
  getPendingCommandsByAccount(accountId: string): PendingCommand[] {
    return Array.from(this.pendingCommands.values()).filter(
      cmd => cmd.accountId === accountId
    );
  }

  /**
   * コマンド履歴の取得
   */
  getCommandHistory(limit?: number): CommandHistory[] {
    return limit ? this.commandHistory.slice(0, limit) : [...this.commandHistory];
  }

  /**
   * 特定アカウントのコマンド履歴の取得
   */
  getCommandHistoryByAccount(accountId: string, limit?: number): CommandHistory[] {
    const accountHistory = this.commandHistory.filter(
      history => history.accountId === accountId
    );
    return limit ? accountHistory.slice(0, limit) : accountHistory;
  }

  /**
   * 特定のコマンドをキャンセル
   */
  cancelCommand(commandId: string): boolean {
    const pendingCommand = this.pendingCommands.get(commandId);
    if (pendingCommand && (pendingCommand.status === 'pending' || pendingCommand.status === 'executing')) {
      // コマンドセンダーでもキャンセル
      this.commandSender.cancelCommand(commandId);
      
      pendingCommand.status = 'failed';
      pendingCommand.error = 'Cancelled by user';
      pendingCommand.completedAt = new Date();

      // 履歴に追加
      const cancelResult: CommandResult = {
        commandId,
        status: 'failed',
        error: 'Cancelled by user',
        timestamp: new Date(),
      };

      this.addToHistory({
        commandId: pendingCommand.commandId,
        commandType: pendingCommand.commandType,
        accountId: pendingCommand.accountId,
        command: pendingCommand.command,
        result: cancelResult,
        executedAt: pendingCommand.executedAt || new Date(),
      });

      this.pendingCommands.delete(commandId);
      return true;
    }
    return false;
  }

  /**
   * 特定アカウントの全コマンドをキャンセル
   */
  cancelCommandsByAccount(accountId: string): number {
    const accountCommands = this.getPendingCommandsByAccount(accountId);
    let cancelledCount = 0;

    for (const cmd of accountCommands) {
      if (this.cancelCommand(cmd.commandId)) {
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * 統計情報の取得
   */
  getStatistics() {
    const pending = this.getPendingCommands();
    const history = this.getCommandHistory(100); // 直近100件

    const stats = {
      pendingCount: pending.length,
      executingCount: pending.filter(cmd => cmd.status === 'executing').length,
      totalHistoryCount: this.commandHistory.length,
      recentSuccessRate: 0,
      averageExecutionTime: 0,
    };

    if (history.length > 0) {
      const successCount = history.filter(h => h.result.status === 'completed').length;
      stats.recentSuccessRate = (successCount / history.length) * 100;

      const executionTimes = history
        .filter(h => h.result.executionTime)
        .map(h => h.result.executionTime!);
      
      if (executionTimes.length > 0) {
        stats.averageExecutionTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
      }
    }

    return stats;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    // 全てのペンディングコマンドをキャンセル
    for (const commandId of this.pendingCommands.keys()) {
      this.cancelCommand(commandId);
    }

    // コマンドセンダーのクリーンアップ
    this.commandSender.dispose();
  }
}
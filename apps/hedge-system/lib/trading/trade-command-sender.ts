import {
  WebSocketClient,
  SystemCommand,
  OpenPositionCommand,
  ClosePositionCommand,
  UpdateTrailCommand,
  TestConnectionCommand,
  SystemConfigCommand,
  createOpenPositionCommand,
  createClosePositionCommand,
  createUpdateTrailCommand,
  createTestConnectionCommand,
  createSystemConfigCommand,
  createMessageId,
} from '../websocket/message-types';

export interface CommandResult {
  commandId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';
  result?: any;
  error?: string;
  executionTime?: number;
  timestamp: Date;
}

export interface TradeCommandSenderOptions {
  websocketClient: WebSocketClient;
  commandTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class TradeCommandSender {
  private websocketClient: WebSocketClient;
  private commandTimeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private pendingCommands: Map<string, {
    resolve: (result: CommandResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    retryCount: number;
    command: SystemCommand;
  }> = new Map();

  constructor(options: TradeCommandSenderOptions) {
    this.websocketClient = options.websocketClient;
    this.commandTimeout = options.commandTimeout || 30000; // 30秒
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;

    this.setupEventHandlers();
  }

  /**
   * ポジションオープン指示を送信
   */
  async sendOpenPositionCommand(
    accountId: string,
    command: OpenPositionCommand
  ): Promise<CommandResult> {
    const systemCommand = createOpenPositionCommand(accountId, command);
    return this.sendCommand(systemCommand);
  }

  /**
   * ポジションクローズ指示を送信
   */
  async sendClosePositionCommand(
    accountId: string,
    command: ClosePositionCommand
  ): Promise<CommandResult> {
    const systemCommand = createClosePositionCommand(accountId, command);
    return this.sendCommand(systemCommand);
  }

  /**
   * ポジション修正指示を送信
   */
  async sendModifyPositionCommand(
    accountId: string,
    command: UpdateTrailCommand
  ): Promise<CommandResult> {
    const systemCommand = createUpdateTrailCommand(accountId, command);
    return this.sendCommand(systemCommand);
  }

  /**
   * トレール設定指示を送信
   */
  async sendTrailCommand(
    accountId: string,
    command: UpdateTrailCommand
  ): Promise<CommandResult> {
    const systemCommand = createUpdateTrailCommand(accountId, command);
    return this.sendCommand(systemCommand);
  }

  /**
   * 接続テスト指示を送信
   */
  async sendTestConnectionCommand(
    accountId: string,
    command: TestConnectionCommand
  ): Promise<CommandResult> {
    const systemCommand = createTestConnectionCommand(accountId, command);
    return this.sendCommand(systemCommand);
  }

  /**
   * システム設定指示を送信
   */
  async sendSystemConfigCommand(
    accountId: string,
    command: SystemConfigCommand
  ): Promise<CommandResult> {
    const systemCommand = createSystemConfigCommand(accountId, command);
    return this.sendCommand(systemCommand);
  }

  /**
   * 汎用コマンド送信
   */
  private async sendCommand(command: SystemCommand): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const commandId = command.commandId;
      
      // タイムアウト設定
      const timeout = setTimeout(() => {
        this.handleCommandTimeout(commandId);
      }, this.commandTimeout);

      // コマンドをペンディングリストに追加
      this.pendingCommands.set(commandId, {
        resolve,
        reject,
        timeout,
        retryCount: 0,
        command,
      });

      try {
        // WebSocketでコマンド送信
        this.websocketClient.send({
          type: 'command',
          payload: {
            commandId,
            action: command.type as any,
            params: command.data,
          },
          timestamp: Date.now(),
        });

        console.log(`Command sent: ${command.type} (${commandId})`);
      } catch (error) {
        // 送信エラー時の処理
        this.cleanupPendingCommand(commandId);
        const result: CommandResult = {
          commandId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        };
        reject(new Error(`Failed to send command: ${error}`));
      }
    });
  }

  /**
   * コマンド応答の処理
   */
  private handleCommandResponse(response: any): void {
    const commandId = response.commandId;
    const pendingCommand = this.pendingCommands.get(commandId);

    if (!pendingCommand) {
      console.warn(`Unknown command response: ${commandId}`);
      return;
    }

    clearTimeout(pendingCommand.timeout);

    const result: CommandResult = {
      commandId,
      status: response.success ? 'completed' : 'failed',
      result: response.result,
      error: response.error,
      executionTime: response.executionTime,
      timestamp: new Date(),
    };

    if (response.success) {
      pendingCommand.resolve(result);
    } else {
      // 失敗時のリトライ処理
      if (pendingCommand.retryCount < this.maxRetries) {
        this.retryCommand(commandId);
        return;
      }

      pendingCommand.reject(new Error(response.error || 'Command failed'));
    }

    this.pendingCommands.delete(commandId);
  }

  /**
   * コマンドタイムアウト処理
   */
  private handleCommandTimeout(commandId: string): void {
    const pendingCommand = this.pendingCommands.get(commandId);

    if (!pendingCommand) {
      return;
    }

    // リトライ処理
    if (pendingCommand.retryCount < this.maxRetries) {
      this.retryCommand(commandId);
      return;
    }

    // 最大リトライ回数に達した場合
    const result: CommandResult = {
      commandId,
      status: 'timeout',
      error: 'Command timeout after retries',
      timestamp: new Date(),
    };

    pendingCommand.reject(new Error('Command timeout'));
    this.pendingCommands.delete(commandId);
  }

  /**
   * コマンドリトライ処理
   */
  private retryCommand(commandId: string): void {
    const pendingCommand = this.pendingCommands.get(commandId);

    if (!pendingCommand) {
      return;
    }

    pendingCommand.retryCount++;
    console.log(`Retrying command ${commandId} (attempt ${pendingCommand.retryCount}/${this.maxRetries})`);

    // リトライ遅延後に再送信
    setTimeout(() => {
      if (this.pendingCommands.has(commandId)) {
        // 新しいタイムアウトを設定
        clearTimeout(pendingCommand.timeout);
        pendingCommand.timeout = setTimeout(() => {
          this.handleCommandTimeout(commandId);
        }, this.commandTimeout);

        try {
          // コマンド再送信
          this.websocketClient.send({
            type: 'command',
            payload: {
              commandId,
              action: pendingCommand.command.type as any,
              params: pendingCommand.command.data,
            },
            timestamp: Date.now(),
          });
        } catch (error) {
          this.handleCommandTimeout(commandId);
        }
      }
    }, this.retryDelay);
  }

  /**
   * ペンディングコマンドのクリーンアップ
   */
  private cleanupPendingCommand(commandId: string): void {
    const pendingCommand = this.pendingCommands.get(commandId);
    if (pendingCommand) {
      clearTimeout(pendingCommand.timeout);
      this.pendingCommands.delete(commandId);
    }
  }

  /**
   * WebSocketイベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    this.websocketClient.on('message_received', (event, message) => {
      // コマンド応答メッセージの処理
      if (message.type === 'entry_result' || message.type === 'close_result') {
        this.handleCommandResponse(message.payload);
      } else if (message.type === 'ack') {
        this.handleCommandResponse(message.payload);
      }
    });

    this.websocketClient.on('connection_state_changed', (event, state) => {
      if (state === 'disconnected' || state === 'error') {
        // 接続断時は全てのペンディングコマンドをタイムアウト扱い
        this.handleConnectionLost();
      }
    });
  }

  /**
   * 接続断時の処理
   */
  private handleConnectionLost(): void {
    console.warn('WebSocket connection lost, timing out pending commands');
    
    for (const [commandId] of this.pendingCommands) {
      this.handleCommandTimeout(commandId);
    }
  }

  /**
   * ペンディングコマンドの状態を取得
   */
  getPendingCommands(): { commandId: string; retryCount: number; command: SystemCommand }[] {
    return Array.from(this.pendingCommands.entries()).map(([commandId, pending]) => ({
      commandId,
      retryCount: pending.retryCount,
      command: pending.command,
    }));
  }

  /**
   * 特定のコマンドをキャンセル
   */
  cancelCommand(commandId: string): boolean {
    const pendingCommand = this.pendingCommands.get(commandId);
    if (pendingCommand) {
      clearTimeout(pendingCommand.timeout);
      pendingCommand.reject(new Error('Command cancelled'));
      this.pendingCommands.delete(commandId);
      return true;
    }
    return false;
  }

  /**
   * 全てのペンディングコマンドをキャンセル
   */
  cancelAllCommands(): void {
    for (const [commandId] of this.pendingCommands) {
      this.cancelCommand(commandId);
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.cancelAllCommands();
  }
}
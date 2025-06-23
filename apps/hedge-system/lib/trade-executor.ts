import { Position } from '@repo/shared-types';

// Trade execution interfaces for hedge-system
interface TradeCommand {
  type: 'OPEN' | 'CLOSE';
  positionId: string;
  accountId: string;
}

interface EntryParams {
  symbol: string;
  volume: number;
  side: 'BUY' | 'SELL';
  price?: number;
}

export interface TradeResult {
  success: boolean;
  positionId?: string;
  error?: string;
  executedAt: Date;
  executedPrice?: number;
  slippage?: number;
}

export interface ExecutionOptions {
  maxSlippage?: number;
  timeout?: number;
  retryAttempts?: number;
  fillOrKill?: boolean;
}

export interface TradeExecutorConfig {
  defaultTimeout: number;
  maxRetryAttempts: number;
  defaultMaxSlippage: number;
  enableRetries: boolean;
  logExecutions: boolean;
}

export class TradeExecutor {
  private config: TradeExecutorConfig;
  private executionHistory: Map<string, TradeResult[]> = new Map();
  private pendingOrders: Map<string, {
    command: TradeCommand;
    options: ExecutionOptions;
    attempts: number;
    createdAt: Date;
  }> = new Map();
  
  constructor(config: Partial<TradeExecutorConfig> = {}) {
    this.config = {
      defaultTimeout: 30000,        // 30秒
      maxRetryAttempts: 3,
      defaultMaxSlippage: 0.0005,   // 0.05%
      enableRetries: true,
      logExecutions: true,
      ...config
    };
  }
  
  async executeEntry(entryParams: EntryParams, options: ExecutionOptions = {}): Promise<TradeResult> {
    const command: TradeCommand = {
      id: crypto.randomUUID(),
      action: 'open',
      symbol: entryParams.symbol,
      volume: entryParams.volume,
      price: entryParams.price,
      stopLoss: entryParams.stopLoss,
      takeProfit: entryParams.takeProfit,
      accountId: '' // 実装要：適切なアカウントIDを設定
    };
    
    return await this.executeTradeCommand(command, options);
  }
  
  async executeClose(position: Position, options: ExecutionOptions = {}): Promise<TradeResult> {
    const command: TradeCommand = {
      id: crypto.randomUUID(),
      action: 'close',
      symbol: position.symbol,
      volume: position.volume,
      accountId: '' // 実装要：適切なアカウントIDを設定
    };
    
    return await this.executeTradeCommand(command, options);
  }
  
  async executeModifyStop(position: Position, newStopLoss: number, options: ExecutionOptions = {}): Promise<TradeResult> {
    const command: TradeCommand = {
      id: crypto.randomUUID(),
      action: 'modify',
      symbol: position.symbol,
      volume: position.volume,
      stopLoss: newStopLoss,
      accountId: '' // 実装要：適切なアカウントIDを設定
    };
    
    return await this.executeTradeCommand(command, options);
  }
  
  private async executeTradeCommand(command: TradeCommand, options: ExecutionOptions): Promise<TradeResult> {
    const executionOptions: ExecutionOptions = {
      maxSlippage: this.config.defaultMaxSlippage,
      timeout: this.config.defaultTimeout,
      retryAttempts: this.config.maxRetryAttempts,
      fillOrKill: false,
      ...options
    };
    
    const startTime = Date.now();
    let lastError: string | undefined;
    
    // 実行試行
    for (let attempt = 1; attempt <= (executionOptions.retryAttempts || 1); attempt++) {
      try {
        // 注文を保留リストに追加
        this.pendingOrders.set(command.id, {
          command,
          options: executionOptions,
          attempts: attempt,
          createdAt: new Date()
        });
        
        const result = await this.sendTradeCommand(command, executionOptions);
        
        // 成功時の処理
        this.pendingOrders.delete(command.id);
        this.recordExecution(command.accountId, result);
        
        if (this.config.logExecutions) {
          this.logExecution(command, result, attempt);
        }
        
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (this.config.logExecutions) {
          console.error(`Trade execution attempt ${attempt} failed:`, lastError);
        }
        
        // 最後の試行でない場合、少し待機
        if (attempt < (executionOptions.retryAttempts || 1) && this.config.enableRetries) {
          await this.delay(1000 * attempt); // 指数バックオフ
        }
      }
    }
    
    // すべての試行が失敗した場合
    this.pendingOrders.delete(command.id);
    const failureResult: TradeResult = {
      success: false,
      error: lastError,
      executedAt: new Date()
    };
    
    this.recordExecution(command.accountId, failureResult);
    return failureResult;
  }
  
  private async sendTradeCommand(command: TradeCommand, options: ExecutionOptions): Promise<TradeResult> {
    // 実際の取引実行処理（MT4/MT5、ブローカーAPIとの連携）
    // ここでは模擬実装
    
    return new Promise((resolve, reject) => {
      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        reject(new Error('Trade execution timeout'));
      }, options.timeout || this.config.defaultTimeout);
      
      // 模擬的な取引実行（実際の実装では WebSocket やAPI呼び出し）
      setTimeout(() => {
        clearTimeout(timeoutId);
        
        // 成功の模擬（実際の実装では外部システムからの応答を処理）
        const executedPrice = command.price ? 
          this.calculateExecutedPrice(command.price, options.maxSlippage) : 
          undefined;
        
        const slippage = command.price && executedPrice ? 
          Math.abs(executedPrice - command.price) / command.price : 
          undefined;
        
        resolve({
          success: true,
          positionId: command.action === 'open' ? crypto.randomUUID() : undefined,
          executedAt: new Date(),
          executedPrice,
          slippage
        });
      }, Math.random() * 2000 + 500); // 0.5-2.5秒のランダムな遅延
    });
  }
  
  private calculateExecutedPrice(requestedPrice: number, maxSlippage?: number): number {
    if (!maxSlippage) return requestedPrice;
    
    // ランダムなスリッページを追加（実際の実装では市場状況に基づく）
    const slippageAmount = (Math.random() - 0.5) * maxSlippage * requestedPrice;
    return requestedPrice + slippageAmount;
  }
  
  private recordExecution(accountId: string, result: TradeResult): void {
    const history = this.executionHistory.get(accountId) || [];
    history.push(result);
    
    // 履歴のサイズ制限（直近1000件まで）
    if (history.length > 1000) {
      history.shift();
    }
    
    this.executionHistory.set(accountId, history);
  }
  
  private logExecution(command: TradeCommand, result: TradeResult, attempt: number): void {
    const logMessage = result.success ?
      `Trade executed successfully: ${command.action} ${command.volume} ${command.symbol} (attempt ${attempt})` :
      `Trade execution failed: ${command.action} ${command.volume} ${command.symbol} - ${result.error} (attempt ${attempt})`;
    
    console.log(logMessage);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 公開メソッド
  getExecutionHistory(accountId: string, limit?: number): TradeResult[] {
    const history = this.executionHistory.get(accountId) || [];
    return limit ? history.slice(-limit) : [...history];
  }
  
  getPendingOrders(): Array<{
    commandId: string;
    command: TradeCommand;
    attempts: number;
    waitTime: number;
  }> {
    const now = Date.now();
    return Array.from(this.pendingOrders.entries()).map(([commandId, order]) => ({
      commandId,
      command: order.command,
      attempts: order.attempts,
      waitTime: now - order.createdAt.getTime()
    }));
  }
  
  cancelPendingOrder(commandId: string): boolean {
    return this.pendingOrders.delete(commandId);
  }
  
  getExecutionStatistics(accountId: string): {
    totalExecutions: number;
    successRate: number;
    averageSlippage: number;
    averageExecutionTime: number;
    lastExecution: Date | null;
  } {
    const history = this.executionHistory.get(accountId) || [];
    
    if (history.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageSlippage: 0,
        averageExecutionTime: 0,
        lastExecution: null
      };
    }
    
    const successfulExecutions = history.filter(r => r.success);
    const slippages = history.filter(r => r.slippage !== undefined).map(r => r.slippage!);
    const averageSlippage = slippages.length > 0 ? 
      slippages.reduce((sum, s) => sum + s, 0) / slippages.length : 0;
    
    return {
      totalExecutions: history.length,
      successRate: successfulExecutions.length / history.length,
      averageSlippage,
      averageExecutionTime: 0, // 実装要：実行時間の追跡
      lastExecution: history[history.length - 1]?.executedAt || null
    };
  }
  
  updateConfig(newConfig: Partial<TradeExecutorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  getConfig(): TradeExecutorConfig {
    return { ...this.config };
  }
  
  // デバッグ・監視用メソッド
  getSystemStatus(): {
    pendingOrderCount: number;
    totalAccountsTracked: number;
    config: TradeExecutorConfig;
    oldestPendingOrder?: Date;
  } {
    const pendingTimes = Array.from(this.pendingOrders.values()).map(order => order.createdAt.getTime());
    const oldestPendingOrder = pendingTimes.length > 0 ? new Date(Math.min(...pendingTimes)) : undefined;
    
    return {
      pendingOrderCount: this.pendingOrders.size,
      totalAccountsTracked: this.executionHistory.size,
      config: this.config,
      oldestPendingOrder
    };
  }
  
  clearHistory(accountId?: string): void {
    if (accountId) {
      this.executionHistory.delete(accountId);
    } else {
      this.executionHistory.clear();
    }
  }
}
import { v4 as uuidv4 } from 'uuid';
import { WebSocketEntryService, EntryCommandResult } from '../websocket-entry';
import { HedgeExecutor, HedgeExecutionCriteria, HedgeResult } from './HedgeExecutor';
import { HedgeBalanceCalculator, HedgeBalance, RebalanceAction } from './HedgeBalanceCalculator';
import { HedgePositionValidator } from './HedgePositionValidator';
import { HedgePosition } from './types';
import { 
  EntryCommand,
  WebSocketClient 
} from '../../../../lib/websocket/message-types';

/**
 * 口座実行設定
 */
export interface AccountExecution {
  accountId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  price?: number;
  orderType: 'MARKET' | 'LIMIT';
  priority: number;
  executionDelay?: number; // ミリ秒
  riskManagement: {
    stopLoss?: number;
    takeProfit?: number;
    maxSlippage?: number;
  };
}

/**
 * 口座残高検証結果
 */
export interface BalanceValidation {
  isValid: boolean;
  accountResults: Array<{
    accountId: string;
    isValid: boolean;
    availableMargin: number;
    requiredMargin: number;
    marginUtilization: number;
    warnings: string[];
    recommendations: string[];
  }>;
  totalRequiredMargin: number;
  totalAvailableMargin: number;
  overallMarginUtilization: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 同期実行結果
 */
export interface SyncResult {
  executionId: string;
  synchronizationAccuracy: number; // 0-1 (1が完全同期)
  maxTimeDifference: number; // ミリ秒
  averageTimeDifference: number; // ミリ秒
  successfulExecutions: number;
  failedExecutions: number;
  partialExecutions: number;
  results: Array<{
    accountId: string;
    success: boolean;
    executionTime: Date;
    timeDifferenceFromFirst: number;
    result?: EntryCommandResult;
    error?: string;
  }>;
}

/**
 * クロスアカウント両建て結果
 */
export interface CrossHedgeResult {
  crossHedgeId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'partial';
  accounts: string[];
  symbol: string;
  totalLots: {
    buy: number;
    sell: number;
  };
  executionResults: Map<string, EntryCommandResult>;
  syncResult?: SyncResult;
  balanceValidation?: BalanceValidation;
  hedgePosition?: HedgePosition;
  error?: string;
  startTime: Date;
  completionTime?: Date;
  compensationRequired: boolean;
  compensationActions: AccountExecution[];
}

/**
 * クロスアカウント調整設定
 */
export interface CrossAccountSettings {
  maxTimeDifference: number; // 最大許容タイムラグ（ミリ秒）
  maxAccountFailures: number; // 許容する最大失敗アカウント数
  compensationMode: 'automatic' | 'manual' | 'disabled';
  balanceThreshold: number; // バランス調整の閾値（0-1）
  riskLimits: {
    maxMarginUtilization: number;
    maxExposurePerAccount: number;
    maxTotalExposure: number;
  };
  executionStrategy: {
    priorityBased: boolean;
    staggeredExecution: boolean;
    rollbackOnFailure: boolean;
  };
}

const DEFAULT_CROSS_ACCOUNT_SETTINGS: CrossAccountSettings = {
  maxTimeDifference: 2000, // 2秒
  maxAccountFailures: 1,
  compensationMode: 'automatic',
  balanceThreshold: 0.1, // 10%
  riskLimits: {
    maxMarginUtilization: 0.8, // 80%
    maxExposurePerAccount: 100000, // $100,000
    maxTotalExposure: 500000 // $500,000
  },
  executionStrategy: {
    priorityBased: true,
    staggeredExecution: false,
    rollbackOnFailure: true
  }
};

/**
 * クロスアカウント両建て実行クラス
 */
export class CrossAccountHedge {
  private wsClient: WebSocketClient;
  private entryService: WebSocketEntryService;
  private balanceCalculator: HedgeBalanceCalculator;
  private validator: HedgePositionValidator;
  private settings: CrossAccountSettings;
  
  private activeExecutions = new Map<string, CrossHedgeResult>();
  private executionTimeouts = new Map<string, NodeJS.Timeout>();
  private compensationQueue: AccountExecution[] = [];
  
  private readonly maxConcurrentExecutions = 5;
  private currentExecutions = 0;

  constructor(
    wsClient: WebSocketClient,
    balanceCalculator: HedgeBalanceCalculator,
    validator: HedgePositionValidator,
    settings?: Partial<CrossAccountSettings>
  ) {
    this.wsClient = wsClient;
    this.entryService = new WebSocketEntryService(wsClient);
    this.balanceCalculator = balanceCalculator;
    this.validator = validator;
    this.settings = { ...DEFAULT_CROSS_ACCOUNT_SETTINGS, ...settings };
  }

  /**
   * クロスアカウント両建てを実行
   */
  async executeCrossAccountHedge(
    accounts: string[], 
    symbol: string, 
    lots: number,
    hedgeRatio = 1.0
  ): Promise<CrossHedgeResult> {
    if (accounts.length < 2) {
      throw new Error('At least 2 accounts are required for cross-account hedge');
    }

    const crossHedgeId = this.generateCrossHedgeId();
    const buyLots = lots;
    const sellLots = lots * hedgeRatio;

    // 口座実行設定の準備
    const executions = this.prepareAccountExecutions(
      accounts, 
      symbol, 
      buyLots, 
      sellLots
    );

    // 結果オブジェクトの初期化
    const result: CrossHedgeResult = {
      crossHedgeId,
      status: 'pending',
      accounts,
      symbol,
      totalLots: { buy: buyLots, sell: sellLots },
      executionResults: new Map(),
      startTime: new Date(),
      compensationRequired: false,
      compensationActions: []
    };

    this.activeExecutions.set(crossHedgeId, result);

    try {
      // 実行前検証
      result.balanceValidation = await this.validateAccountBalance(accounts);
      if (!result.balanceValidation.isValid) {
        result.status = 'failed';
        result.error = 'Account balance validation failed';
        return result;
      }

      // 同期実行
      result.status = 'executing';
      result.syncResult = await this.synchronizeExecution(executions);

      // 実行結果の処理
      this.processExecutionResults(result);

      // 失敗した実行の補正
      if (result.compensationRequired && this.settings.compensationMode === 'automatic') {
        await this.handleExecutionFailure(result);
      }

      // 両建てポジションの作成
      if (result.status === 'completed') {
        result.hedgePosition = this.createCrossAccountHedgePosition(result);
      }

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      result.completionTime = new Date();
      this.currentExecutions = Math.max(0, this.currentExecutions - 1);
    }

    return result;
  }

  /**
   * 口座残高の検証
   */
  async validateAccountBalance(accounts: string[]): Promise<BalanceValidation> {
    const accountResults = await Promise.all(
      accounts.map(accountId => this.validateSingleAccount(accountId))
    );

    const totalRequiredMargin = accountResults.reduce(
      (sum, result) => sum + result.requiredMargin, 0
    );
    const totalAvailableMargin = accountResults.reduce(
      (sum, result) => sum + result.availableMargin, 0
    );
    
    const overallMarginUtilization = totalAvailableMargin > 0 
      ? totalRequiredMargin / totalAvailableMargin 
      : 1;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (overallMarginUtilization > 0.9) riskLevel = 'critical';
    else if (overallMarginUtilization > 0.8) riskLevel = 'high';
    else if (overallMarginUtilization > 0.6) riskLevel = 'medium';

    return {
      isValid: accountResults.every(r => r.isValid) && riskLevel !== 'critical',
      accountResults,
      totalRequiredMargin,
      totalAvailableMargin,
      overallMarginUtilization,
      riskLevel
    };
  }

  /**
   * 実行の同期化
   */
  async synchronizeExecution(executions: AccountExecution[]): Promise<SyncResult> {
    const executionId = uuidv4();
    const sortedExecutions = this.sortExecutionsByPriority(executions);
    
    let firstExecutionTime: Date | null = null;
    const results: SyncResult['results'] = [];

    // 実行モードによる分岐
    if (this.settings.executionStrategy.staggeredExecution) {
      // 段階的実行
      await this.executeStaggered(sortedExecutions, results);
    } else {
      // 同時実行
      await this.executeSimultaneous(sortedExecutions, results);
    }

    // 同期精度の計算
    if (results.length > 0) {
      firstExecutionTime = results[0].executionTime;
    }

    const timeDifferences = results
      .filter(r => r.success)
      .map(r => r.timeDifferenceFromFirst);

    const maxTimeDifference = Math.max(...timeDifferences, 0);
    const averageTimeDifference = timeDifferences.length > 0 
      ? timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length 
      : 0;

    const synchronizationAccuracy = maxTimeDifference > 0 
      ? Math.max(0, 1 - (maxTimeDifference / this.settings.maxTimeDifference))
      : 1;

    return {
      executionId,
      synchronizationAccuracy,
      maxTimeDifference,
      averageTimeDifference,
      successfulExecutions: results.filter(r => r.success).length,
      failedExecutions: results.filter(r => !r.success).length,
      partialExecutions: 0, // 現在の実装では部分実行なし
      results
    };
  }

  /**
   * 実行失敗時の補正処理
   */
  async handleExecutionFailure(result: CrossHedgeResult): Promise<void> {
    if (!result.compensationRequired || result.compensationActions.length === 0) {
      return;
    }

    console.log(`Handling execution failure for ${result.crossHedgeId}`);

    // 補正アクションの実行
    for (const action of result.compensationActions) {
      try {
        const entryCommand: EntryCommand = {
          symbol: action.symbol,
          direction: action.direction,
          lotSize: action.lotSize,
          orderType: action.orderType,
          price: action.price,
          accountId: action.accountId,
          stopLoss: action.riskManagement.stopLoss,
          takeProfit: action.riskManagement.takeProfit
        };

        const compensationResult = await this.entryService.sendEntryCommand(entryCommand);
        
        if (compensationResult.success) {
          result.executionResults.set(action.accountId, compensationResult);
          console.log(`Compensation successful for account ${action.accountId}`);
        } else {
          console.error(`Compensation failed for account ${action.accountId}:`, compensationResult.error);
        }

        // 補正実行間の遅延
        if (action.executionDelay) {
          await this.delay(action.executionDelay);
        }

      } catch (error) {
        console.error(`Exception during compensation for account ${action.accountId}:`, error);
      }
    }

    // 実行結果の再評価
    this.processExecutionResults(result);
  }

  /**
   * 口座実行設定の準備
   */
  private prepareAccountExecutions(
    accounts: string[], 
    symbol: string, 
    buyLots: number, 
    sellLots: number
  ): AccountExecution[] {
    const executions: AccountExecution[] = [];
    const accountsPerSide = Math.ceil(accounts.length / 2);

    // 買いポジション用アカウント
    for (let i = 0; i < accountsPerSide && i < accounts.length; i++) {
      executions.push({
        accountId: accounts[i],
        symbol,
        direction: 'BUY',
        lotSize: buyLots / accountsPerSide,
        orderType: 'MARKET',
        priority: i + 1,
        riskManagement: {}
      });
    }

    // 売りポジション用アカウント
    for (let i = accountsPerSide; i < accounts.length; i++) {
      executions.push({
        accountId: accounts[i],
        symbol,
        direction: 'SELL',
        lotSize: sellLots / (accounts.length - accountsPerSide),
        orderType: 'MARKET',
        priority: i - accountsPerSide + 1,
        riskManagement: {}
      });
    }

    return executions;
  }

  /**
   * 単一口座の検証
   */
  private async validateSingleAccount(accountId: string): Promise<BalanceValidation['accountResults'][0]> {
    // 簡易実装：実際の実装では口座情報を取得
    const mockAccountInfo = {
      availableMargin: 10000,
      requiredMargin: 1000,
      marginUtilization: 0.1
    };

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (mockAccountInfo.marginUtilization > 0.8) {
      warnings.push('High margin utilization detected');
      recommendations.push('Consider reducing position size');
    }

    return {
      accountId,
      isValid: mockAccountInfo.marginUtilization < this.settings.riskLimits.maxMarginUtilization,
      availableMargin: mockAccountInfo.availableMargin,
      requiredMargin: mockAccountInfo.requiredMargin,
      marginUtilization: mockAccountInfo.marginUtilization,
      warnings,
      recommendations
    };
  }

  /**
   * 優先度による実行順序のソート
   */
  private sortExecutionsByPriority(executions: AccountExecution[]): AccountExecution[] {
    if (!this.settings.executionStrategy.priorityBased) {
      return [...executions];
    }

    return [...executions].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 段階的実行
   */
  private async executeStaggered(
    executions: AccountExecution[], 
    results: SyncResult['results']
  ): Promise<void> {
    const startTime = Date.now();

    for (const execution of executions) {
      const executionTime = new Date();
      
      try {
        const entryCommand: EntryCommand = {
          symbol: execution.symbol,
          direction: execution.direction,
          lotSize: execution.lotSize,
          orderType: execution.orderType,
          price: execution.price,
          accountId: execution.accountId,
          stopLoss: execution.riskManagement.stopLoss,
          takeProfit: execution.riskManagement.takeProfit
        };

        const result = await this.entryService.sendEntryCommand(entryCommand);
        
        results.push({
          accountId: execution.accountId,
          success: result.success,
          executionTime,
          timeDifferenceFromFirst: executionTime.getTime() - startTime,
          result
        });

        // 実行遅延の適用
        if (execution.executionDelay) {
          await this.delay(execution.executionDelay);
        }

      } catch (error) {
        results.push({
          accountId: execution.accountId,
          success: false,
          executionTime,
          timeDifferenceFromFirst: executionTime.getTime() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * 同時実行
   */
  private async executeSimultaneous(
    executions: AccountExecution[], 
    results: SyncResult['results']
  ): Promise<void> {
    const startTime = Date.now();

    const promises = executions.map(async (execution) => {
      const executionTime = new Date();
      
      try {
        const entryCommand: EntryCommand = {
          symbol: execution.symbol,
          direction: execution.direction,
          lotSize: execution.lotSize,
          orderType: execution.orderType,
          price: execution.price,
          accountId: execution.accountId,
          stopLoss: execution.riskManagement.stopLoss,
          takeProfit: execution.riskManagement.takeProfit
        };

        const result = await this.entryService.sendEntryCommand(entryCommand);
        
        return {
          accountId: execution.accountId,
          success: result.success,
          executionTime,
          timeDifferenceFromFirst: executionTime.getTime() - startTime,
          result
        };

      } catch (error) {
        return {
          accountId: execution.accountId,
          success: false,
          executionTime,
          timeDifferenceFromFirst: executionTime.getTime() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const settledResults = await Promise.allSettled(promises);
    
    settledResults.forEach((settledResult) => {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value);
      }
    });
  }

  /**
   * 実行結果の処理
   */
  private processExecutionResults(result: CrossHedgeResult): void {
    const successful = Array.from(result.executionResults.values())
      .filter(r => r.success);
    const failed = Array.from(result.executionResults.values())
      .filter(r => !r.success);

    // ステータスの判定
    if (failed.length === 0) {
      result.status = 'completed';
    } else if (successful.length > 0) {
      result.status = 'partial';
      result.compensationRequired = true;
      
      // 補正アクションの生成
      result.compensationActions = this.generateCompensationActions(result, failed);
    } else {
      result.status = 'failed';
    }
  }

  /**
   * 補正アクションの生成
   */
  private generateCompensationActions(
    result: CrossHedgeResult, 
    failedResults: EntryCommandResult[]
  ): AccountExecution[] {
    const actions: AccountExecution[] = [];

    // 失敗した実行の分析
    failedResults.forEach((failedResult) => {
      if (failedResult.accountId && failedResult.symbol && failedResult.direction && failedResult.lotSize) {
        actions.push({
          accountId: failedResult.accountId,
          symbol: failedResult.symbol,
          direction: failedResult.direction,
          lotSize: failedResult.lotSize,
          orderType: 'MARKET',
          priority: 1,
          executionDelay: 1000, // 1秒遅延
          riskManagement: {}
        });
      }
    });

    return actions;
  }

  /**
   * クロスアカウント両建てポジションの作成
   */
  private createCrossAccountHedgePosition(result: CrossHedgeResult): HedgePosition {
    const positionIds = Array.from(result.executionResults.values())
      .filter(r => r.success && r.positionId)
      .map(r => r.positionId!);

    return {
      id: `cross_hedge_${result.crossHedgeId}`,
      positionIds,
      symbol: result.symbol,
      hedgeType: 'cross_account',
      accounts: result.accounts,
      totalLots: result.totalLots,
      totalProfit: 0,
      isBalanced: Math.abs(result.totalLots.buy - result.totalLots.sell) < 0.01,
      createdAt: result.startTime,
      settings: {
        autoRebalance: true,
        maxImbalance: this.settings.balanceThreshold,
        maintainOnClose: true
      }
    };
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * クロス両建てIDの生成
   */
  private generateCrossHedgeId(): string {
    return `cross_hedge_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * アクティブな実行一覧を取得
   */
  getActiveExecutions(): CrossHedgeResult[] {
    return Array.from(this.activeExecutions.values())
      .filter(e => e.status === 'pending' || e.status === 'executing');
  }

  /**
   * 実行結果を取得
   */
  getExecutionResult(crossHedgeId: string): CrossHedgeResult | undefined {
    return this.activeExecutions.get(crossHedgeId);
  }

  /**
   * 設定の更新
   */
  updateSettings(settings: Partial<CrossAccountSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * 設定の取得
   */
  getSettings(): CrossAccountSettings {
    return { ...this.settings };
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.executionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.executionTimeouts.clear();
    this.activeExecutions.clear();
    this.compensationQueue.length = 0;
  }
}
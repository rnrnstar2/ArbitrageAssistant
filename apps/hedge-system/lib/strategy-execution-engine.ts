import { AmplifyGraphQLClient } from './amplify-client';
import { 
  Strategy, 
  EntryStrategy, 
  ExitStrategy, 
  Position, 
  PositionStatus,
  StrategyStatus 
} from '@repo/shared-types';
import { 
  CREATE_ENTRY_ACTION, 
  CREATE_CLOSE_ACTION, 
  UPDATE_POSITION_STATUS, 
  UPDATE_STRATEGY_STATUS 
} from './graphql/mutations';

/**
 * 戦略実行エンジン
 * MVPデザイン仕様3-1、3-2に基づく戦略実行
 */
export class StrategyExecutionEngine {
  private amplifyClient: AmplifyGraphQLClient;
  
  constructor(amplifyClient: AmplifyGraphQLClient) {
    this.amplifyClient = amplifyClient;
  }

  /**
   * エントリー戦略実行（設計書3-1準拠）
   * 複数口座・複数ポジション同時エントリー
   */
  async executeEntryStrategy(strategy: EntryStrategy): Promise<void> {
    console.log(`🚀 Executing Entry Strategy: ${strategy.name} (${strategy.strategyId})`);
    
    try {
      // 1. Strategy状態をEXECUTINGに更新
      await this.updateStrategyStatus(strategy.strategyId, StrategyStatus.EXECUTING);
      
      // 2. 各口座・ポジション仕様に基づいてAction作成
      const actionPromises: Promise<void>[] = [];
      
      for (const account of strategy.targetAccounts) {
        for (const positionSpec of strategy.positions) {
          const actionPromise = this.createEntryPositionAction(
            strategy, 
            account, 
            positionSpec
          );
          actionPromises.push(actionPromise);
        }
      }
      
      // 3. 全Actionを並列実行
      await Promise.all(actionPromises);
      
      // 4. Strategy状態をCOMPLETEDに更新
      await this.updateStrategyStatus(strategy.strategyId, StrategyStatus.COMPLETED);
      
      console.log(`✅ Entry Strategy ${strategy.name} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Entry Strategy ${strategy.name} failed:`, error);
      await this.updateStrategyStatus(strategy.strategyId, StrategyStatus.ERROR);
      throw error;
    }
  }

  /**
   * 個別エントリーポジション・アクション作成
   */
  private async createEntryPositionAction(
    strategy: EntryStrategy,
    accountId: string,
    positionSpec: any
  ): Promise<void> {
    try {
      // 1. Positionレコード作成
      const position = await this.amplifyClient.createPosition({
        strategyId: strategy.strategyId,
        status: PositionStatus.PENDING,
        symbol: positionSpec.symbol,
        volume: positionSpec.volume,
        trailWidth: positionSpec.trailWidth || strategy.defaultTrailWidth,
        primary: false, // エントリー戦略では基本的にfalse
        owner: strategy.owner
      });

      // 2. ポジション状態をOPENINGに更新
      await this.updatePositionStatus(position.positionId, PositionStatus.OPENING);

      // 3. ENTRY Action作成
      await this.createEntryAction(position, accountId, positionSpec);

      console.log(`📝 Entry action created for position: ${position.positionId} on account: ${accountId}`);

    } catch (error) {
      console.error(`Failed to create entry action for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * 決済戦略実行（設計書3-2準拠）
   * 既存ポジション選択・一括決済・トレール設定
   */
  async executeExitStrategy(strategy: ExitStrategy): Promise<void> {
    console.log(`🚀 Executing Exit Strategy: ${strategy.name} (${strategy.strategyId})`);
    
    try {
      // 1. Strategy状態をEXECUTINGに更新
      await this.updateStrategyStatus(strategy.strategyId, StrategyStatus.EXECUTING);
      
      // 2. 選択されたポジション取得
      const positions = await this.getSelectedPositions(strategy.selectedPositions);
      
      if (positions.length === 0) {
        throw new Error('No positions found for exit strategy');
      }
      
      // 3. primaryPosition特定
      const primaryPosition = positions.find(p => p.positionId === strategy.primaryPositionId);
      
      if (!primaryPosition) {
        throw new Error(`Primary position ${strategy.primaryPositionId} not found`);
      }
      
      // 4. 全ポジション状態をCLOSINGに更新
      const closePromises = positions.map(async (position) => {
        await this.updatePositionStatus(position.positionId, PositionStatus.CLOSING);
        return this.createCloseAction(position, strategy);
      });
      
      await Promise.all(closePromises);
      
      // 5. Strategy状態をCOMPLETEDに更新
      await this.updateStrategyStatus(strategy.strategyId, StrategyStatus.COMPLETED);
      
      console.log(`✅ Exit Strategy ${strategy.name} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Exit Strategy ${strategy.name} failed:`, error);
      await this.updateStrategyStatus(strategy.strategyId, StrategyStatus.ERROR);
      throw error;
    }
  }

  /**
   * 選択されたポジション取得
   */
  private async getSelectedPositions(positionIds: string[]): Promise<Position[]> {
    const positions: Position[] = [];
    
    for (const positionId of positionIds) {
      const position = await this.amplifyClient.getPosition(positionId);
      if (position) {
        positions.push(position);
      }
    }
    
    return positions;
  }

  /**
   * ENTRY Action作成
   */
  private async createEntryAction(
    position: Position, 
    accountId: string, 
    positionSpec: any
  ): Promise<void> {
    const actionInput = {
      strategyId: position.strategyId,
      type: 'ENTRY',
      positionId: position.positionId,
      params: {
        accountId,
        symbol: positionSpec.symbol,
        volume: positionSpec.volume,
        direction: positionSpec.direction,
        trailWidth: position.trailWidth,
        comment: `Entry for strategy ${position.strategyId}`
      }
    };

    await this.amplifyClient.client.graphql({
      query: CREATE_ENTRY_ACTION,
      variables: { input: actionInput }
    });
  }

  /**
   * CLOSE Action作成
   */
  private async createCloseAction(position: Position, strategy: ExitStrategy): Promise<void> {
    const actionInput = {
      strategyId: strategy.strategyId,
      type: 'CLOSE',
      positionId: position.positionId,
      params: {
        accountId: position.accountId || 'unknown', // Positionからaccount情報取得
        positionId: position.positionId,
        reason: 'strategy_exit',
        trailWidth: strategy.trailWidth,
        comment: `Exit for strategy ${strategy.strategyId}`
      }
    };

    await this.amplifyClient.client.graphql({
      query: CREATE_CLOSE_ACTION,
      variables: { input: actionInput }
    });
  }

  /**
   * ポジション状態更新
   */
  private async updatePositionStatus(
    positionId: string, 
    status: PositionStatus
  ): Promise<void> {
    try {
      await this.amplifyClient.client.graphql({
        query: UPDATE_POSITION_STATUS,
        variables: { positionId, status }
      });
    } catch (error) {
      console.error(`Failed to update position status for ${positionId}:`, error);
      throw error;
    }
  }

  /**
   * 戦略状態更新
   */
  private async updateStrategyStatus(
    strategyId: string, 
    status: StrategyStatus
  ): Promise<void> {
    try {
      await this.amplifyClient.client.graphql({
        query: UPDATE_STRATEGY_STATUS,
        variables: { strategyId, status: status.toString() }
      });
    } catch (error) {
      console.error(`Failed to update strategy status for ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * 戦略別ポジション取得
   */
  async getStrategyPositions(strategyId: string): Promise<Position[]> {
    try {
      return await this.amplifyClient.listPositions({
        strategyId: { eq: strategyId }
      });
    } catch (error) {
      console.error(`Failed to get positions for strategy ${strategyId}:`, error);
      return [];
    }
  }

  /**
   * アクティブな戦略一覧取得
   */
  async getActiveStrategies(): Promise<Strategy[]> {
    try {
      const strategies = await this.amplifyClient.listStrategies();
      // Note: 実際の実装ではstatusフィルターを使用
      return strategies.filter((s: any) => s.status === StrategyStatus.ACTIVE);
    } catch (error) {
      console.error('Failed to get active strategies:', error);
      return [];
    }
  }

  /**
   * 戦略実行統計
   */
  getExecutionStats() {
    return {
      // 実行統計の実装は後で追加
      totalExecuted: 0,
      totalFailed: 0,
      lastExecution: new Date()
    };
  }
}
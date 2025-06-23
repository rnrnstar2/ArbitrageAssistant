import { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { 
  Strategy, 
  EntryStrategy, 
  ExitStrategy, 
  StrategyStatus,
  PositionSpec
} from '@repo/shared-types';

export interface StrategyExecutionResult {
  success: boolean;
  strategyId: string;
  message: string;
  executedPositions?: string[];
  errors?: string[];
}

export interface UseStrategyExecutionReturn {
  executeStrategy: (strategyId: string) => Promise<StrategyExecutionResult>;
  executeEntryStrategy: (strategy: EntryStrategy) => Promise<StrategyExecutionResult>;
  executeExitStrategy: (strategy: ExitStrategy) => Promise<StrategyExecutionResult>;
  loading: boolean;
  error: Error | null;
}

export function useStrategyExecution(): UseStrategyExecutionReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const client = generateClient();

  const updateStrategyStatus = async (
    strategyId: string, 
    status: StrategyStatus,
    executedAt?: Date
  ) => {
    const mutation = /* GraphQL */ `
      mutation UpdateStrategyStatus($input: UpdateStrategyStatusInput!) {
        updateStrategyStatus(input: $input) {
          strategyId
          status
          executedAt
        }
      }
    `;

    await client.graphql({
      query: mutation,
      variables: {
        input: {
          strategyId,
          status,
          executedAt: executedAt?.toISOString()
        }
      }
    });
  };

  const createPositionActions = async (
    strategyId: string,
    accountId: string,
    positions: PositionSpec[]
  ): Promise<string[]> => {
    const actionIds: string[] = [];

    for (const position of positions) {
      const mutation = /* GraphQL */ `
        mutation CreatePositionAction($input: CreateActionInput!) {
          createAction(input: $input) {
            id
            strategyId
            type
            status
            accountId
            parameters
          }
        }
      `;

      const result = await client.graphql({
        query: mutation,
        variables: {
          input: {
            strategyId,
            type: 'ENTRY',
            accountId,
            parameters: {
              symbol: position.symbol,
              volume: position.volume,
              direction: position.direction,
              trailWidth: position.trailWidth
            }
          }
        }
      });

      actionIds.push(result.data.createAction.id);
    }

    return actionIds;
  };

  const createCloseActions = async (
    strategyId: string,
    positionIds: string[],
    trailWidth: number
  ): Promise<string[]> => {
    const actionIds: string[] = [];

    for (const positionId of positionIds) {
      const mutation = /* GraphQL */ `
        mutation CreateCloseAction($input: CreateActionInput!) {
          createAction(input: $input) {
            id
            strategyId
            type
            status
            positionId
            parameters
          }
        }
      `;

      const result = await client.graphql({
        query: mutation,
        variables: {
          input: {
            strategyId,
            type: 'CLOSE',
            positionId,
            parameters: {
              trailWidth
            }
          }
        }
      });

      actionIds.push(result.data.createAction.id);
    }

    return actionIds;
  };

  const executeEntryStrategy = async (strategy: EntryStrategy): Promise<StrategyExecutionResult> => {
    try {
      setLoading(true);
      setError(null);

      // 1. 戦略ステータスをEXECUTINGに更新
      await updateStrategyStatus(strategy.strategyId, 'EXECUTING', new Date());

      const executedPositions: string[] = [];
      const errors: string[] = [];

      // 2. 各対象口座に対してアクションを作成
      for (const accountId of strategy.targetAccounts) {
        try {
          const actionIds = await createPositionActions(
            strategy.strategyId,
            accountId,
            strategy.positions
          );
          executedPositions.push(...actionIds);
        } catch (err) {
          errors.push(`口座 ${accountId} でのアクション作成に失敗: ${err}`);
        }
      }

      // 3. 実行結果に基づいてステータス更新
      const finalStatus = errors.length > 0 ? 'ERROR' : 'COMPLETED';
      await updateStrategyStatus(strategy.strategyId, finalStatus);

      // 4. AppSync Subscriptionで実行通知
      const notificationMutation = /* GraphQL */ `
        mutation PublishStrategyExecution($input: StrategyExecutionNotificationInput!) {
          publishStrategyExecution(input: $input) {
            strategyId
            status
            message
          }
        }
      `;

      await client.graphql({
        query: notificationMutation,
        variables: {
          input: {
            strategyId: strategy.strategyId,
            status: finalStatus,
            message: errors.length > 0 ? `部分的に実行されました: ${errors.join(', ')}` : '正常に実行されました',
            executedPositions
          }
        }
      });

      return {
        success: errors.length === 0,
        strategyId: strategy.strategyId,
        message: errors.length > 0 ? `部分的に実行されました` : '正常に実行されました',
        executedPositions,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (err) {
      setError(err as Error);
      await updateStrategyStatus(strategy.strategyId, 'ERROR');
      return {
        success: false,
        strategyId: strategy.strategyId,
        message: `実行中にエラーが発生しました: ${err}`,
        errors: [err as string]
      };
    } finally {
      setLoading(false);
    }
  };

  const executeExitStrategy = async (strategy: ExitStrategy): Promise<StrategyExecutionResult> => {
    try {
      setLoading(true);
      setError(null);

      // 1. 戦略ステータスをEXECUTINGに更新
      await updateStrategyStatus(strategy.strategyId, 'EXECUTING', new Date());

      // 2. 選択されたポジションに対してクローズアクションを作成
      const actionIds = await createCloseActions(
        strategy.strategyId,
        strategy.selectedPositions,
        strategy.trailWidth
      );

      // 3. 実行完了
      await updateStrategyStatus(strategy.strategyId, 'COMPLETED');

      // 4. 実行通知
      const notificationMutation = /* GraphQL */ `
        mutation PublishStrategyExecution($input: StrategyExecutionNotificationInput!) {
          publishStrategyExecution(input: $input) {
            strategyId
            status
            message
          }
        }
      `;

      await client.graphql({
        query: notificationMutation,
        variables: {
          input: {
            strategyId: strategy.strategyId,
            status: 'COMPLETED',
            message: '決済戦略が正常に実行されました',
            executedPositions: actionIds
          }
        }
      });

      return {
        success: true,
        strategyId: strategy.strategyId,
        message: '決済戦略が正常に実行されました',
        executedPositions: actionIds
      };

    } catch (err) {
      setError(err as Error);
      await updateStrategyStatus(strategy.strategyId, 'ERROR');
      return {
        success: false,
        strategyId: strategy.strategyId,
        message: `実行中にエラーが発生しました: ${err}`,
        errors: [err as string]
      };
    } finally {
      setLoading(false);
    }
  };

  const executeStrategy = async (strategyId: string): Promise<StrategyExecutionResult> => {
    try {
      setLoading(true);
      setError(null);

      // 戦略情報を取得
      const query = /* GraphQL */ `
        query GetStrategy($strategyId: String!) {
          getStrategy(strategyId: $strategyId) {
            strategyId
            name
            type
            status
            ... on EntryStrategy {
              targetAccounts
              positions {
                symbol
                volume
                direction
                trailWidth
              }
              defaultTrailWidth
            }
            ... on ExitStrategy {
              selectedPositions
              primaryPositionId
              trailWidth
            }
          }
        }
      `;

      const result = await client.graphql({
        query,
        variables: { strategyId }
      });

      const strategy = result.data.getStrategy as Strategy;

      if (!strategy) {
        throw new Error('戦略が見つかりません');
      }

      // 戦略タイプに応じて実行
      if (strategy.type === 'ENTRY') {
        return await executeEntryStrategy(strategy as EntryStrategy);
      } else if (strategy.type === 'EXIT') {
        return await executeExitStrategy(strategy as ExitStrategy);
      } else {
        throw new Error('サポートされていない戦略タイプです');
      }

    } catch (err) {
      setError(err as Error);
      return {
        success: false,
        strategyId,
        message: `戦略実行中にエラーが発生しました: ${err}`,
        errors: [err as string]
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    executeStrategy,
    executeEntryStrategy,
    executeExitStrategy,
    loading,
    error
  };
}
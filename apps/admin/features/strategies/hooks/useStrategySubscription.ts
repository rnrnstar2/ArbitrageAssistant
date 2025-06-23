import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';

interface StrategyExecutionUpdate {
  strategyId: string;
  strategyName?: string;
  status: string;
  message: string;
  executedPositions?: string[];
  errors?: string[];
  timestamp: Date;
}

export interface UseStrategySubscriptionReturn {
  executionUpdates: StrategyExecutionUpdate[];
  errors: string[];
  isConnected: boolean;
}

export function useStrategySubscription(): UseStrategySubscriptionReturn {
  const [executionUpdates, setExecutionUpdates] = useState<StrategyExecutionUpdate[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const client = generateClient();

  useEffect(() => {
    // Strategy execution subscription
    const executionSubscription = /* GraphQL */ `
      subscription OnStrategyExecution($userId: String!) {
        onStrategyExecution(userId: $userId) {
          strategyId
          status
          message
          executedPositions
          errors
          createdAt
          strategy {
            name
            type
          }
        }
      }
    `;

    // Strategy status update subscription
    const statusSubscription = /* GraphQL */ `
      subscription OnStrategyStatusUpdate {
        onUpdateStrategy {
          strategyId
          name
          status
          updatedAt
        }
      }
    `;

    // Action execution subscription
    const actionSubscription = /* GraphQL */ `
      subscription OnActionExecution {
        onActionExecution {
          id
          strategyId
          type
          status
          result
          executedAt
          strategy {
            name
          }
        }
      }
    `;

    const subscriptions: any[] = [];

    try {
      // Subscribe to strategy execution events
      const executionSub = client.graphql({ 
        query: executionSubscription,
        variables: { userId: 'current-user' } // This should be actual user ID
      }).subscribe({
        next: ({ data }) => {
          const update = data.onStrategyExecution;
          setExecutionUpdates(prev => [{
            strategyId: update.strategyId,
            strategyName: update.strategy?.name,
            status: update.status,
            message: update.message,
            executedPositions: update.executedPositions,
            errors: update.errors,
            timestamp: new Date(update.createdAt),
          }, ...prev.slice(0, 49)]); // Keep last 50 updates
        },
        error: (err) => {
          console.error('Strategy execution subscription error:', err);
          setErrors(prev => [...prev, `実行更新エラー: ${err.message}`]);
          setIsConnected(false);
        }
      });

      subscriptions.push(executionSub);

      // Subscribe to strategy status changes
      const statusSub = client.graphql({ query: statusSubscription }).subscribe({
        next: ({ data }) => {
          const strategy = data.onUpdateStrategy;
          setExecutionUpdates(prev => [{
            strategyId: strategy.strategyId,
            strategyName: strategy.name,
            status: strategy.status,
            message: `戦略ステータスが${strategy.status}に変更されました`,
            timestamp: new Date(strategy.updatedAt),
          }, ...prev.slice(0, 49)]);
        },
        error: (err) => {
          console.error('Strategy status subscription error:', err);
          setErrors(prev => [...prev, `ステータス更新エラー: ${err.message}`]);
        }
      });

      subscriptions.push(statusSub);

      // Subscribe to action execution events
      const actionSub = client.graphql({ query: actionSubscription }).subscribe({
        next: ({ data }) => {
          const action = data.onActionExecution;
          let message = '';
          
          switch (action.status) {
            case 'COMPLETED':
              message = `アクション${action.type}が正常に完了しました`;
              break;
            case 'FAILED':
              message = `アクション${action.type}が失敗しました: ${action.result || '不明なエラー'}`;
              break;
            case 'EXECUTING':
              message = `アクション${action.type}を実行中です`;
              break;
            default:
              message = `アクション${action.type}のステータス: ${action.status}`;
          }

          setExecutionUpdates(prev => [{
            strategyId: action.strategyId,
            strategyName: action.strategy?.name,
            status: action.status,
            message,
            timestamp: new Date(action.executedAt || new Date()),
          }, ...prev.slice(0, 49)]);
        },
        error: (err) => {
          console.error('Action execution subscription error:', err);
          setErrors(prev => [...prev, `アクション実行エラー: ${err.message}`]);
        }
      });

      subscriptions.push(actionSub);

      setIsConnected(true);

    } catch (err) {
      console.error('Subscription setup error:', err);
      setErrors(prev => [...prev, `サブスクリプション接続エラー: ${err}`]);
      setIsConnected(false);
    }

    // Cleanup function
    return () => {
      subscriptions.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (err) {
          console.error('Subscription cleanup error:', err);
        }
      });
      setIsConnected(false);
    };
  }, [client]);

  // Periodic connection health check
  useEffect(() => {
    const healthCheck = setInterval(() => {
      if (!isConnected) {
        setErrors(prev => [...prev, 'リアルタイム接続が切断されました']);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheck);
  }, [isConnected]);

  // Clear old errors
  useEffect(() => {
    const cleanup = setInterval(() => {
      setErrors(prev => prev.slice(0, 5)); // Keep only last 5 errors
    }, 60000); // Cleanup every minute

    return () => clearInterval(cleanup);
  }, []);

  return {
    executionUpdates,
    errors,
    isConnected
  };
}
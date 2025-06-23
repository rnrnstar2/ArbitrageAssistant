import { useState, useEffect } from 'react';
import { Strategy } from '@repo/shared-types';
import { generateClient } from 'aws-amplify/api';

export interface UseStrategiesReturn {
  strategies: Strategy[];
  loading: boolean;
  error: Error | null;
  refreshStrategies: () => Promise<void>;
}

export function useStrategies(): UseStrategiesReturn {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = generateClient();

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = /* GraphQL */ `
        query ListStrategies {
          listStrategies {
            items {
              strategyId
              name
              type
              status
              createdAt
              updatedAt
              executedAt
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
              # Legacy fields for backward compatibility
              trailWidth
              symbol
              maxRisk
            }
          }
        }
      `;

      const result = await client.graphql({ query });
      setStrategies(result.data.listStrategies.items);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // 戦略更新のサブスクリプション
    const updateSubscription = /* GraphQL */ `
      subscription OnUpdateStrategy {
        onUpdateStrategy {
          strategyId
          name
          type
          status
          createdAt
          updatedAt
          executedAt
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
          # Legacy fields
          trailWidth
          symbol
          maxRisk
        }
      }
    `;

    const updateSub = client.graphql({ query: updateSubscription }).subscribe({
      next: ({ data }) => {
        const updatedStrategy = data.onUpdateStrategy;
        setStrategies(prev => prev.map(s => 
          s.strategyId === updatedStrategy.strategyId ? updatedStrategy : s
        ));
      },
      error: (err) => console.error('Subscription error:', err)
    });

    // 新規戦略作成のサブスクリプション
    const createSubscription = /* GraphQL */ `
      subscription OnCreateStrategy {
        onCreateStrategy {
          strategyId
          name
          type
          status
          createdAt
          updatedAt
          executedAt
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
          # Legacy fields
          trailWidth
          symbol
          maxRisk
        }
      }
    `;

    const createSub = client.graphql({ query: createSubscription }).subscribe({
      next: ({ data }) => {
        const newStrategy = data.onCreateStrategy;
        setStrategies(prev => [newStrategy, ...prev]);
      },
      error: (err) => console.error('Subscription error:', err)
    });

    // 戦略削除のサブスクリプション
    const deleteSubscription = /* GraphQL */ `
      subscription OnDeleteStrategy {
        onDeleteStrategy {
          strategyId
        }
      }
    `;

    const deleteSub = client.graphql({ query: deleteSubscription }).subscribe({
      next: ({ data }) => {
        const deletedStrategy = data.onDeleteStrategy;
        setStrategies(prev => prev.filter(s => s.strategyId !== deletedStrategy.strategyId));
      },
      error: (err) => console.error('Subscription error:', err)
    });

    // 戦略実行サブスクリプション
    const executionSubscription = /* GraphQL */ `
      subscription OnStrategyExecution($userId: String!) {
        onStrategyExecution(userId: $userId) {
          id
          status
          executedAt
          positions {
            id
            status
            mtTicket
          }
          actions {
            id
            status
            result
          }
        }
      }
    `;

    const executionSub = client.graphql({ 
      query: executionSubscription,
      variables: { userId: 'current-user' } // This should be actual user ID from auth
    }).subscribe({
      next: ({ data }) => {
        const execution = data.onStrategyExecution;
        // Update strategy status based on execution results
        setStrategies(prev => prev.map(strategy => {
          if (strategy.strategyId === execution.id) {
            return {
              ...strategy,
              status: execution.status,
              executedAt: execution.executedAt ? new Date(execution.executedAt) : strategy.executedAt,
            };
          }
          return strategy;
        }));
      },
      error: (err) => console.error('Strategy execution subscription error:', err)
    });

    return () => {
      updateSub.unsubscribe();
      createSub.unsubscribe();
      deleteSub.unsubscribe();
      executionSub.unsubscribe();
    };
  };

  useEffect(() => {
    fetchStrategies();
    const unsubscribe = setupRealtimeSubscriptions();
    
    return unsubscribe;
  }, []);

  return {
    strategies,
    loading,
    error,
    refreshStrategies: fetchStrategies
  };
}
import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  listPositions,
  listAccounts,
  type Position,
  type Account,
  type ListPositionsResponse,
  type ListAccountsResponse,
} from '../graphql/queries';
import {
  onPositionCreated,
  onPositionUpdated,
  onPositionDeleted,
  onAccountUpdated,
  type OnPositionCreatedSubscription,
  type OnPositionUpdatedSubscription,
  type OnPositionDeletedSubscription,
  type OnAccountUpdatedSubscription,
} from '../graphql/subscriptions';

const client = generateClient();

export interface UseRealtimePositionsReturn {
  positions: Position[];
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function useRealtimePositions(): UseRealtimePositionsReturn {
  const [positions, setPositions] = useState<Position[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  // Initial data fetch
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('connecting');

      // Fetch positions and accounts concurrently
      const [positionsResult, accountsResult] = await Promise.all([
        client.graphql({
          query: listPositions,
          variables: {
            filter: {
              status: { eq: 'open' } // Only fetch open positions
            },
            limit: 1000
          }
        }) as Promise<GraphQLResult<ListPositionsResponse>>,
        client.graphql({
          query: listAccounts,
          variables: {
            limit: 100
          }
        }) as Promise<GraphQLResult<ListAccountsResponse>>
      ]);

      if (positionsResult.data?.listPositions.items) {
        setPositions(positionsResult.data.listPositions.items);
      }

      if (accountsResult.data?.listAccounts.items) {
        setAccounts(accountsResult.data.listAccounts.items);
      }

      setConnectionStatus('connected');
    } catch (err) {
      console.error('Error fetching positions and accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up subscriptions
  useEffect(() => {
    fetchData();

    // Position created subscription
    const createdSub = client.graphql({
      query: onPositionCreated
    }).subscribe({
      next: ({ data }: { data: OnPositionCreatedSubscription }) => {
        if (data?.onPositionCreated) {
          setPositions(prev => {
            // Check if position already exists to prevent duplicates
            const exists = prev.some(p => p.id === data.onPositionCreated.id);
            if (!exists) {
              return [...prev, data.onPositionCreated];
            }
            return prev;
          });
          setConnectionStatus('connected');
        }
      },
      error: (err) => {
        console.error('Position created subscription error:', err);
        setError('Subscription error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setConnectionStatus('error');
      }
    });

    // Position updated subscription
    const updatedSub = client.graphql({
      query: onPositionUpdated
    }).subscribe({
      next: ({ data }: { data: OnPositionUpdatedSubscription }) => {
        if (data?.onPositionUpdated) {
          setPositions(prev => 
            prev.map(position => 
              position.id === data.onPositionUpdated.id 
              ? { ...position, ...data.onPositionUpdated }
              : position
            )
          );
          setConnectionStatus('connected');
        }
      },
      error: (err) => {
        console.error('Position updated subscription error:', err);
        setError('Subscription error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setConnectionStatus('error');
      }
    });

    // Position deleted subscription
    const deletedSub = client.graphql({
      query: onPositionDeleted
    }).subscribe({
      next: ({ data }: { data: OnPositionDeletedSubscription }) => {
        if (data?.onPositionDeleted) {
          setPositions(prev => 
            prev.filter(position => position.id !== data.onPositionDeleted.id)
          );
          setConnectionStatus('connected');
        }
      },
      error: (err) => {
        console.error('Position deleted subscription error:', err);
        setError('Subscription error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setConnectionStatus('error');
      }
    });

    // Account updated subscription
    const accountUpdatedSub = client.graphql({
      query: onAccountUpdated
    }).subscribe({
      next: ({ data }: { data: OnAccountUpdatedSubscription }) => {
        if (data?.onAccountUpdated) {
          setAccounts(prev => 
            prev.map(account => 
              account.id === data.onAccountUpdated.id 
              ? { ...account, ...data.onAccountUpdated }
              : account
            )
          );
          setConnectionStatus('connected');
        }
      },
      error: (err) => {
        console.error('Account updated subscription error:', err);
        setError('Subscription error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setConnectionStatus('error');
      }
    });

    // Cleanup subscriptions on unmount
    return () => {
      createdSub.unsubscribe();
      updatedSub.unsubscribe();
      deletedSub.unsubscribe();
      accountUpdatedSub.unsubscribe();
      setConnectionStatus('disconnected');
    };
  }, [fetchData]);

  // Auto-retry connection on error
  useEffect(() => {
    if (connectionStatus === 'error') {
      const retryTimer = setTimeout(() => {
        console.log('Retrying connection...');
        fetchData();
      }, 5000); // Retry after 5 seconds

      return () => clearTimeout(retryTimer);
    }
  }, [connectionStatus, fetchData]);

  return {
    positions,
    accounts,
    loading,
    error,
    refetch: fetchData,
    connectionStatus
  };
}
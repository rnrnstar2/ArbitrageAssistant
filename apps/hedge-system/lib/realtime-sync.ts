import { Observable } from 'rxjs';
import { Position, Strategy, Action } from '@repo/shared-types';
import { AmplifyGraphQLClient } from './amplify-client.js';

export class RealtimeSync {
  private subscriptions: Map<string, any> = new Map();
  private client: AmplifyGraphQLClient;
  
  constructor(client: AmplifyGraphQLClient) {
    this.client = client;
  }
  
  // Position subscriptions
  subscribeToPositionUpdates(): Observable<Position> {
    const subscription = /* GraphQL */ `
      subscription OnUpdatePosition {
        onUpdatePosition {
          positionId
          strategyId
          status
          symbol
          volume
          entryPrice
          entryTime
          exitPrice
          exitTime
          exitReason
          stopLoss
          takeProfit
          trailWidth
          primary
          owner
          updatedAt
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onUpdatePosition) {
            observer.next(this.normalizePosition(data.onUpdatePosition));
          }
        },
        error: (err: any) => {
          console.error('Position update subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('positionUpdates', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('positionUpdates');
      };
    });
  }
  
  subscribeToNewPositions(): Observable<Position> {
    const subscription = /* GraphQL */ `
      subscription OnCreatePosition {
        onCreatePosition {
          positionId
          strategyId
          status
          symbol
          volume
          trailWidth
          primary
          owner
          createdAt
          updatedAt
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onCreatePosition) {
            observer.next(this.normalizePosition(data.onCreatePosition));
          }
        },
        error: (err: any) => {
          console.error('New position subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('newPositions', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('newPositions');
      };
    });
  }
  
  subscribeToPositionDeletes(): Observable<{ positionId: string }> {
    const subscription = /* GraphQL */ `
      subscription OnDeletePosition {
        onDeletePosition {
          positionId
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onDeletePosition) {
            observer.next({ positionId: data.onDeletePosition.positionId });
          }
        },
        error: (err: any) => {
          console.error('Position delete subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('positionDeletes', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('positionDeletes');
      };
    });
  }
  
  // Strategy subscriptions
  subscribeToStrategyUpdates(): Observable<Strategy> {
    const subscription = /* GraphQL */ `
      subscription OnUpdateStrategy {
        onUpdateStrategy {
          strategyId
          name
          trailWidth
          symbol
          maxRisk
          owner
          updatedAt
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onUpdateStrategy) {
            observer.next(this.normalizeStrategy(data.onUpdateStrategy));
          }
        },
        error: (err: any) => {
          console.error('Strategy update subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('strategyUpdates', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('strategyUpdates');
      };
    });
  }
  
  subscribeToNewStrategies(): Observable<Strategy> {
    const subscription = /* GraphQL */ `
      subscription OnCreateStrategy {
        onCreateStrategy {
          strategyId
          name
          trailWidth
          symbol
          maxRisk
          owner
          createdAt
          updatedAt
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onCreateStrategy) {
            observer.next(this.normalizeStrategy(data.onCreateStrategy));
          }
        },
        error: (err: any) => {
          console.error('New strategy subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('newStrategies', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('newStrategies');
      };
    });
  }
  
  // Action subscriptions
  subscribeToNewActions(): Observable<Action> {
    const subscription = /* GraphQL */ `
      subscription OnCreateAction {
        onCreateAction {
          actionId
          strategyId
          type
          positionId
          params
          status
          owner
          createdAt
          updatedAt
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onCreateAction) {
            observer.next(this.normalizeAction(data.onCreateAction));
          }
        },
        error: (err: any) => {
          console.error('New action subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('newActions', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('newActions');
      };
    });
  }
  
  subscribeToActionUpdates(): Observable<Action> {
    const subscription = /* GraphQL */ `
      subscription OnUpdateAction {
        onUpdateAction {
          actionId
          strategyId
          type
          positionId
          params
          status
          owner
          updatedAt
        }
      }
    `;
    
    return new Observable(observer => {
      const sub = this.client['client'].graphql({
        query: subscription
      }).subscribe({
        next: ({ data }: any) => {
          if (data.onUpdateAction) {
            observer.next(this.normalizeAction(data.onUpdateAction));
          }
        },
        error: (err: any) => {
          console.error('Action update subscription error:', err);
          observer.error(err);
        }
      });
      
      this.subscriptions.set('actionUpdates', sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete('actionUpdates');
      };
    });
  }
  
  // Filtered subscriptions for specific strategies
  subscribeToStrategyPositions(strategyId: string): Observable<Position> {
    return new Observable(observer => {
      // Listen to all position updates but filter by strategy
      const subscription = this.subscribeToPositionUpdates();
      
      const sub = subscription.subscribe({
        next: (position) => {
          if (position.strategyId === strategyId) {
            observer.next(position);
          }
        },
        error: (err) => observer.error(err)
      });
      
      this.subscriptions.set(`strategyPositions_${strategyId}`, sub);
      
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete(`strategyPositions_${strategyId}`);
      };
    });
  }
  
  // Connection management
  unsubscribeAll(): void {
    this.subscriptions.forEach((sub, key) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.warn(`Failed to unsubscribe from ${key}:`, error);
      }
    });
    this.subscriptions.clear();
  }
  
  unsubscribe(subscriptionName: string): void {
    const sub = this.subscriptions.get(subscriptionName);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subscriptionName);
    }
  }
  
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }
  
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
  
  // Data normalization helpers
  private normalizePosition(data: any): Position {
    return {
      ...data,
      entryTime: data.entryTime ? new Date(data.entryTime) : undefined,
      exitTime: data.exitTime ? new Date(data.exitTime) : undefined,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }
  
  private normalizeStrategy(data: any): Strategy {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }
  
  private normalizeAction(data: any): Action {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }
  
  // Health check
  async testConnection(): Promise<boolean> {
    try {
      // Try to create a simple subscription and immediately unsubscribe
      const testSub = this.subscribeToNewPositions();
      const subscription = testSub.subscribe({
        next: () => {},
        error: () => {}
      });
      
      // Clean up immediately
      subscription.unsubscribe();
      return true;
    } catch (error) {
      console.error('Realtime sync connection test failed:', error);
      return false;
    }
  }
}
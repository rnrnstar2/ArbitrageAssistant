import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import { 
  Position, 
  Strategy, 
  Action,
  CreatePositionInput,
  UpdatePositionInput,
  CreateStrategyInput,
  UpdateStrategyInput,
  PositionStatus
} from '@repo/shared-types';

interface CreateActionInput {
  strategyId: string;
  type: string;
  positionId?: string;
  params: Record<string, any>;
}

interface UpdateActionInput {
  actionId: string;
  status?: string;
  params?: Record<string, any>;
}

export class AmplifyGraphQLClient {
  public client: any;
  private connected: boolean = false;
  
  constructor() {
    this.client = generateClient();
  }
  
  async initialize(config: any): Promise<void> {
    Amplify.configure(config);
    this.connected = true;
  }
  
  // Position operations
  async createPosition(input: CreatePositionInput): Promise<Position> {
    const mutation = /* GraphQL */ `
      mutation CreatePosition($input: CreatePositionInput!) {
        createPosition(input: $input) {
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
    
    const result = await this.client.graphql({
      query: mutation,
      variables: { input }
    });
    
    return result.data.createPosition;
  }
  
  async updatePosition(input: UpdatePositionInput): Promise<Position> {
    const mutation = /* GraphQL */ `
      mutation UpdatePosition($input: UpdatePositionInput!) {
        updatePosition(input: $input) {
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
    
    const result = await this.client.graphql({
      query: mutation,
      variables: { input }
    });
    
    return result.data.updatePosition;
  }
  
  async getPosition(positionId: string): Promise<Position | null> {
    const query = /* GraphQL */ `
      query GetPosition($positionId: ID!) {
        getPosition(positionId: $positionId) {
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
          createdAt
          updatedAt
        }
      }
    `;
    
    const result = await this.client.graphql({
      query: query,
      variables: { positionId }
    });
    
    return result.data.getPosition;
  }
  
  async listPositions(filter?: any): Promise<Position[]> {
    const query = /* GraphQL */ `
      query ListPositions($filter: ModelPositionFilterInput) {
        listPositions(filter: $filter) {
          items {
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
            createdAt
            updatedAt
          }
        }
      }
    `;
    
    const result = await this.client.graphql({
      query: query,
      variables: { filter }
    });
    
    return result.data.listPositions.items;
  }
  
  async listActivePositions(): Promise<Position[]> {
    return this.listPositions({
      status: { eq: PositionStatus.OPEN }
    });
  }
  
  async listPendingPositions(): Promise<Position[]> {
    return this.listPositions({
      status: { eq: PositionStatus.PENDING }
    });
  }
  
  // Strategy operations
  async createStrategy(input: CreateStrategyInput): Promise<Strategy> {
    const mutation = /* GraphQL */ `
      mutation CreateStrategy($input: CreateStrategyInput!) {
        createStrategy(input: $input) {
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
    
    const result = await this.client.graphql({
      query: mutation,
      variables: { input }
    });
    
    return result.data.createStrategy;
  }
  
  async getStrategy(strategyId: string): Promise<Strategy | null> {
    const query = /* GraphQL */ `
      query GetStrategy($strategyId: ID!) {
        getStrategy(strategyId: $strategyId) {
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
    
    const result = await this.client.graphql({
      query: query,
      variables: { strategyId }
    });
    
    return result.data.getStrategy;
  }
  
  async listStrategies(): Promise<Strategy[]> {
    const query = /* GraphQL */ `
      query ListStrategies {
        listStrategies {
          items {
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
      }
    `;
    
    const result = await this.client.graphql({
      query: query
    });
    
    return result.data.listStrategies.items;
  }
  
  async updateStrategy(input: UpdateStrategyInput): Promise<Strategy> {
    const mutation = /* GraphQL */ `
      mutation UpdateStrategy($input: UpdateStrategyInput!) {
        updateStrategy(input: $input) {
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
    
    const result = await this.client.graphql({
      query: mutation,
      variables: { input }
    });
    
    return result.data.updateStrategy;
  }
  
  // Action operations
  async createAction(input: CreateActionInput): Promise<Action> {
    const mutation = /* GraphQL */ `
      mutation CreateAction($input: CreateActionInput!) {
        createAction(input: $input) {
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
    
    const result = await this.client.graphql({
      query: mutation,
      variables: { input }
    });
    
    return result.data.createAction;
  }
  
  async updateAction(input: UpdateActionInput): Promise<Action> {
    const mutation = /* GraphQL */ `
      mutation UpdateAction($input: UpdateActionInput!) {
        updateAction(input: $input) {
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
    
    const result = await this.client.graphql({
      query: mutation,
      variables: { input }
    });
    
    return result.data.updateAction;
  }
  
  async listActions(filter?: any): Promise<Action[]> {
    const query = /* GraphQL */ `
      query ListActions($filter: ModelActionFilterInput) {
        listActions(filter: $filter) {
          items {
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
      }
    `;
    
    const result = await this.client.graphql({
      query: query,
      variables: { filter }
    });
    
    return result.data.listActions.items;
  }
  
  // Connection status
  isConnected(): boolean {
    return this.connected;
  }
  
  // Error handling
  private handleError(error: any): never {
    console.error('AmplifyGraphQLClient Error:', error);
    throw new Error(`GraphQL operation failed: ${error.message}`);
  }
}
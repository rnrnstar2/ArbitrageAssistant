import { CreatePositionInput, Position, PositionStatus } from '@repo/shared-types';
import { amplifyClient } from './amplify-client';

/**
 * Position Service - Lambda関数を直接呼び出すサービスクラス
 * AWS Amplify Lambda Functions統合版
 */
export class PositionService {
  private amplifyClient: any;
  
  constructor(amplifyClient: any) {
    this.amplifyClient = amplifyClient;
  }
  
  /**
   * Position作成 - createPositionRecord Lambda関数呼び出し
   */
  async createPosition(input: CreatePositionInput): Promise<Position> {
    try {
      // Lambda関数直接呼び出し
      const result = await this.amplifyClient.functions.createPositionRecord.invoke({
        body: JSON.stringify(input)
      });
      
      if (result.statusCode !== 200) {
        throw new Error(`Position creation failed: ${result.body}`);
      }
      
      const response = JSON.parse(result.body);
      return response.position;
    } catch (error) {
      console.error('Create position error:', error);
      throw error;
    }
  }
  
  /**
   * Position更新 - updatePositionRecord Lambda関数呼び出し
   */
  async updatePosition(positionId: string, updates: Partial<Position>): Promise<void> {
    try {
      const result = await this.amplifyClient.functions.updatePositionRecord.invoke({
        body: JSON.stringify({ positionId, ...updates })
      });
      
      if (result.statusCode !== 200) {
        throw new Error(`Position update failed: ${result.body}`);
      }
    } catch (error) {
      console.error('Update position error:', error);
      throw error;
    }
  }
  
  /**
   * Position決済 - closePosition Lambda関数呼び出し
   */
  async closePosition(positionId: string, exitPrice: number, exitReason: string, forceClose?: boolean): Promise<{ position: Position; profit: number }> {
    try {
      const result = await this.amplifyClient.functions.closePosition.invoke({
        body: JSON.stringify({
          positionId,
          exitPrice,
          exitReason,
          forceClose
        })
      });
      
      if (result.statusCode !== 200) {
        throw new Error(`Position close failed: ${result.body}`);
      }
      
      const response = JSON.parse(result.body);
      return {
        position: response.position,
        profit: response.profit
      };
    } catch (error) {
      console.error('Close position error:', error);
      throw error;
    }
  }
  
  /**
   * 複数Position一括決済 - batchClosePositions Lambda関数呼び出し
   */
  async batchClosePositions(
    positions: Array<{
      positionId: string;
      exitPrice: number;
      exitReason: string;
    }>,
    options?: {
      forceClose?: boolean;
      userId?: string;
      accountId?: string;
    }
  ): Promise<{
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalProfit: number;
    };
    results: Array<{
      positionId: string;
      success: boolean;
      profit?: number;
      error?: string;
    }>;
  }> {
    try {
      const result = await this.amplifyClient.functions.batchClosePositions.invoke({
        body: JSON.stringify({
          positions,
          ...options
        })
      });
      
      if (result.statusCode !== 200) {
        throw new Error(`Batch close failed: ${result.body}`);
      }
      
      const response = JSON.parse(result.body);
      return {
        summary: response.summary,
        results: response.results
      };
    } catch (error) {
      console.error('Batch close positions error:', error);
      throw error;
    }
  }
  
  /**
   * Position状態変更
   */
  async updatePositionStatus(
    positionId: string, 
    status: PositionStatus,
    additionalData?: {
      mtTicket?: string;
      entryPrice?: number;
      entryTime?: string;
      exitPrice?: number;
      exitTime?: string;
      exitReason?: string;
    }
  ): Promise<void> {
    await this.updatePosition(positionId, { status, ...additionalData });
  }
  
  /**
   * Position詳細取得 (GraphQL経由)
   */
  async getPosition(positionId: string): Promise<Position | null> {
    try {
      // GraphQLクエリでPosition詳細を取得
      const result = await this.amplifyClient.graphql({
        query: `
          query GetPosition($id: ID!) {
            getPosition(id: $id) {
              id
              userId
              accountId
              symbol
              volume
              executionType
              status
              entryPrice
              exitPrice
              profit
              trailWidth
              triggerActionIds
              memo
              createdAt
              updatedAt
            }
          }
        `,
        variables: { id: positionId }
      });
      
      return result.data?.getPosition || null;
    } catch (error) {
      console.error('Get position error:', error);
      return null;
    }
  }
  
  /**
   * Position一覧取得 (GraphQL経由)
   */
  async listPositions(filters?: {
    userId?: string;
    accountId?: string;
    status?: string;
    limit?: number;
  }): Promise<Position[]> {
    try {
      const result = await this.amplifyClient.graphql({
        query: `
          query ListPositions($filter: ModelPositionFilterInput, $limit: Int) {
            listPositions(filter: $filter, limit: $limit) {
              items {
                id
                userId
                accountId
                symbol
                volume
                executionType
                status
                entryPrice
                exitPrice
                profit
                trailWidth
                triggerActionIds
                memo
                createdAt
                updatedAt
              }
            }
          }
        `,
        variables: {
          filter: filters ? {
            userId: filters.userId ? { eq: filters.userId } : undefined,
            accountId: filters.accountId ? { eq: filters.accountId } : undefined,
            status: filters.status ? { eq: filters.status } : undefined
          } : undefined,
          limit: filters?.limit || 100
        }
      });
      
      return result.data?.listPositions?.items || [];
    } catch (error) {
      console.error('List positions error:', error);
      return [];
    }
  }
}

// シングルトンインスタンス
export const positionService = new PositionService(amplifyClient);

// 便利関数エクスポート
export const createPosition = (input: CreatePositionInput) => positionService.createPosition(input);
export const updatePosition = (positionId: string, updates: Partial<Position>) => positionService.updatePosition(positionId, updates);
export const closePosition = (positionId: string, exitPrice: number, exitReason: string, forceClose?: boolean) => positionService.closePosition(positionId, exitPrice, exitReason, forceClose);
export const batchClosePositions = (positions: Array<{ positionId: string; exitPrice: number; exitReason: string; }>, options?: { forceClose?: boolean; userId?: string; accountId?: string; }) => positionService.batchClosePositions(positions, options);
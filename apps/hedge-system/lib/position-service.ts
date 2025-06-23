import { CreatePositionInput, PositionStatus } from '@repo/shared-types';
import { amplifyClient, getCurrentUserId } from './amplify-client.js';
import { createPosition, updatePosition } from './graphql/mutations.js';
import { listOpenPositions, listTrailPositions } from './graphql/queries.js';

/**
 * Position Service - GraphQL操作のヘルパークラス
 * MVP core機能に特化したPosition操作を提供
 */
export class PositionService {
  
  /**
   * ポジション作成
   */
  static async create(input: CreatePositionInput): Promise<any> {
    const userId = await getCurrentUserId();
    return amplifyClient.graphql({
      query: createPosition,
      variables: { input: { ...input, userId } }
    });
  }

  /**
   * ポジション状態更新
   */
  static async updateStatus(id: string, status?: PositionStatus, additionalFields?: any): Promise<any> {
    const updateInput = { id, ...additionalFields };
    if (status) updateInput.status = status;
    
    return amplifyClient.graphql({
      query: updatePosition,
      variables: { input: updateInput }
    });
  }

  /**
   * オープンポジション一覧取得
   */
  static async listOpen(): Promise<any> {
    const userId = await getCurrentUserId();
    return amplifyClient.graphql({
      query: listOpenPositions,
      variables: { userId }
    });
  }

  /**
   * トレール設定済みポジション一覧取得
   */
  static async listTrailPositions(): Promise<any> {
    const userId = await getCurrentUserId();
    return amplifyClient.graphql({
      query: listTrailPositions,
      variables: { userId }
    });
  }
}
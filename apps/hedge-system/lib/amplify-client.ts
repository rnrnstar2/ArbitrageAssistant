import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import { Position, PositionStatus, Action, ActionStatus } from './types';

export const amplifyClient = generateClient();

export const getCurrentUserId = async (): Promise<string> => {
  try {
    const user = await getCurrentUser();
    return user.userId;
  } catch (error) {
    throw new Error('User not authenticated');
  }
};

/**
 * AmplifyClient - userIdベースの高速操作
 * MVPシステム設計書に基づく実装
 */
export class AmplifyClient {
  private client = amplifyClient;
  private currentUserId?: string;
  
  constructor() {
    this.initializeUserId();
  }

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
    } catch (error) {
      console.error('Failed to initialize user ID:', error);
    }
  }

  /**
   * 自分担当のポジション取得
   */
  async listMyPositions(status?: PositionStatus): Promise<Position[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    const filter: any = {
      userId: { eq: this.currentUserId }
    };
    
    if (status) {
      filter.status = { eq: status };
    }
    
    const result = await this.client.models.Position.list({
      filter
    });
    
    return result.data as Position[];
  }

  /**
   * 自分担当のアクション取得
   */
  async listMyActions(status?: ActionStatus): Promise<Action[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    const filter: any = {
      userId: { eq: this.currentUserId }
    };
    
    if (status) {
      filter.status = { eq: status };
    }
    
    const result = await this.client.models.Action.list({
      filter
    });
    
    return result.data as Action[];
  }

  /**
   * Position Subscription（userIdベース）
   */
  subscribeToMyPositions(callback: (position: Position) => void) {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    return this.client.models.Position.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    }).subscribe({
      next: (data) => {
        data.items.forEach(position => {
          callback(position as Position);
        });
      },
      error: (error) => {
        console.error('Position subscription error:', error);
      }
    });
  }

  /**
   * Action Subscription（userIdベース）
   */
  subscribeToMyActions(callback: (action: Action) => void) {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    return this.client.models.Action.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    }).subscribe({
      next: (data) => {
        data.items.forEach(action => {
          callback(action as Action);
        });
      },
      error: (error) => {
        console.error('Action subscription error:', error);
      }
    });
  }

  /**
   * Position作成
   */
  async createPosition(input: any): Promise<Position> {
    const result = await this.client.models.Position.create({
      ...input,
      userId: this.currentUserId
    });
    
    return result.data as Position;
  }

  /**
   * Action作成
   */
  async createAction(input: any): Promise<Action> {
    const result = await this.client.models.Action.create({
      ...input,
      userId: this.currentUserId
    });
    
    return result.data as Action;
  }

  /**
   * Position更新
   */
  async updatePosition(id: string, updates: any): Promise<Position> {
    const result = await this.client.models.Position.update({
      id,
      ...updates
    });
    
    return result.data as Position;
  }

  /**
   * Action更新
   */
  async updateAction(id: string, updates: any): Promise<Action> {
    const result = await this.client.models.Action.update({
      id,
      ...updates
    });
    
    return result.data as Action;
  }

  /**
   * 現在のuserId取得
   */
  getCurrentUserId(): string | undefined {
    return this.currentUserId;
  }
}

// シングルトンインスタンス
export const amplifyClientInstance = new AmplifyClient();
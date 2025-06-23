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
    // 認証状態を確認してから初期化
    this.initializeUserId().catch(error => {
      console.log('User not authenticated, will initialize after login');
    });
  }

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
      console.log('✅ User ID initialized:', this.currentUserId);
    } catch (error) {
      // 認証されていない場合は静かに処理
      this.currentUserId = undefined;
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
    
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Position?.list({
      filter
    });
    
    return (result?.data || []) as Position[];
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
    
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Action?.list({
      filter
    });
    
    return (result?.data || []) as Action[];
  }

  /**
   * Position Subscription（userIdベース）
   */
  subscribeToMyPositions(callback: (position: Position) => void) {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    return (this.client as any).models?.Position?.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    })?.subscribe({
      next: (data: any) => {
        data?.items?.forEach((position: any) => {
          callback(position as Position);
        });
      },
      error: (error: any) => {
        console.error('Position subscription error:', error);
      }
    }) || { unsubscribe: () => {} };
  }

  /**
   * Action Subscription（userIdベース）
   */
  subscribeToMyActions(callback: (action: Action) => void) {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    return (this.client as any).models?.Action?.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    })?.subscribe({
      next: (data: any) => {
        data?.items?.forEach((action: any) => {
          callback(action as Action);
        });
      },
      error: (error: any) => {
        console.error('Action subscription error:', error);
      }
    }) || { unsubscribe: () => {} };
  }

  /**
   * Position作成
   */
  async createPosition(input: any): Promise<Position> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Position?.create({
      ...input,
      userId: this.currentUserId
    });
    
    return result?.data as Position;
  }

  /**
   * Action作成
   */
  async createAction(input: any): Promise<Action> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Action?.create({
      ...input,
      userId: this.currentUserId
    });
    
    return result?.data as Action;
  }

  /**
   * Position更新
   */
  async updatePosition(id: string, updates: any): Promise<Position> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Position?.update({
      id,
      ...updates
    });
    
    return result?.data as Position;
  }

  /**
   * Action更新
   */
  async updateAction(id: string, updates: any): Promise<Action> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Action?.update({
      id,
      ...updates
    });
    
    return result?.data as Action;
  }

  /**
   * Account更新
   */
  async updateAccount(id: string, updates: any): Promise<any> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const result = await (this.client as any).models?.Account?.update({
      id,
      ...updates
    });
    
    return result?.data;
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

// AmplifyGraphQLClient として AmplifyClient をエクスポート
export { AmplifyClient as AmplifyGraphQLClient };
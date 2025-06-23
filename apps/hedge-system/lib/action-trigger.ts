import { AmplifyGraphQLClient } from './amplify-client';
import { ActionStatus } from './types';

export interface TriggerResult {
  actionId: string;
  success: boolean;
  error?: string;
}

export class ActionTrigger {
  private amplifyClient: AmplifyGraphQLClient;

  constructor(amplifyClient: AmplifyGraphQLClient) {
    this.amplifyClient = amplifyClient;
  }

  /**
   * triggerActionIds実行（MVPシステム設計 3.1, 4.1準拠）
   * @param positionId 対象ポジションID
   * @param triggerActionIds トリガーするActionIDsの配列（JSON文字列）
   */
  async executeTriggerActions(
    positionId: string, 
    triggerActionIds: string
  ): Promise<TriggerResult[]> {
    
    if (!triggerActionIds || triggerActionIds.trim() === '') {
      console.log(`No trigger actions for position ${positionId}`);
      return [];
    }

    try {
      // JSON配列をパース
      const actionIds: string[] = JSON.parse(triggerActionIds);
      
      if (!Array.isArray(actionIds) || actionIds.length === 0) {
        console.log(`No valid action IDs found for position ${positionId}`);
        return [];
      }

      console.log(`🚀 Executing ${actionIds.length} trigger actions for position ${positionId}:`, actionIds);

      // 各Actionをsequentialに実行
      const results: TriggerResult[] = [];
      
      for (const actionId of actionIds) {
        const result = await this.triggerSingleAction(positionId, actionId);
        results.push(result);
        
        // 実行間隔を少し設ける（DynamoDB throttling回避）
        if (actionIds.length > 1) {
          await this.delay(100);
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`✅ Trigger actions completed: ${successCount}/${results.length} succeeded for position ${positionId}`);

      return results;
      
    } catch (error) {
      console.error(`❌ Failed to parse or execute trigger actions for position ${positionId}:`, error);
      return [{ 
        actionId: 'parse_error', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }];
    }
  }

  /**
   * 単一Action実行
   * @param positionId 対象ポジションID
   * @param actionId 実行するActionID
   */
  private async triggerSingleAction(positionId: string, actionId: string): Promise<TriggerResult> {
    try {
      // TODO: Fix schema mismatch - regenerate amplify_outputs.json
      // Action状態を PENDING → EXECUTING に変更
      await (this.amplifyClient as any).models?.Action?.update({
        id: actionId,
        status: ActionStatus.EXECUTING
      });
      
      console.log(`✅ Triggered action: ${actionId} for position: ${positionId}`);
      
      return {
        actionId,
        success: true
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to trigger action ${actionId} for position ${positionId}:`, errorMessage);
      
      return {
        actionId,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 複数Actions並列実行（高速処理用）
   * @param positionId 対象ポジションID
   * @param triggerActionIds トリガーするActionIDsの配列（JSON文字列）
   */
  async executeTriggerActionsParallel(
    positionId: string, 
    triggerActionIds: string
  ): Promise<TriggerResult[]> {
    
    if (!triggerActionIds || triggerActionIds.trim() === '') {
      return [];
    }

    try {
      const actionIds: string[] = JSON.parse(triggerActionIds);
      
      if (!Array.isArray(actionIds) || actionIds.length === 0) {
        return [];
      }

      console.log(`🚀 Executing ${actionIds.length} trigger actions in parallel for position ${positionId}:`, actionIds);

      // 並列実行
      const promises = actionIds.map(actionId => this.triggerSingleAction(positionId, actionId));
      const results = await Promise.allSettled(promises);

      const triggerResults: TriggerResult[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            actionId: actionIds[index],
            success: false,
            error: result.reason
          };
        }
      });

      const successCount = triggerResults.filter(r => r.success).length;
      console.log(`✅ Parallel trigger actions completed: ${successCount}/${triggerResults.length} succeeded for position ${positionId}`);

      return triggerResults;
      
    } catch (error) {
      console.error(`❌ Failed to execute parallel trigger actions for position ${positionId}:`, error);
      return [{ 
        actionId: 'parse_error', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }];
    }
  }

  /**
   * ロスカット時のトリガー実行
   * @param positionId ロスカットされたポジションID
   * @param triggerActionIds トリガーするActionIDsの配列（JSON文字列）
   * @param lossCutPrice ロスカット価格
   */
  async executeLossCutTriggers(
    positionId: string,
    triggerActionIds: string,
    lossCutPrice?: number
  ): Promise<TriggerResult[]> {
    
    console.log(`💥 Executing loss cut triggers for position ${positionId}${lossCutPrice ? ` at price ${lossCutPrice}` : ''}`);
    
    // ロスカット時は並列実行で高速処理
    return await this.executeTriggerActionsParallel(positionId, triggerActionIds);
  }

  /**
   * Action実行状況取得
   * @param actionIds 確認するActionIDsの配列
   */
  async getActionStatuses(actionIds: string[]): Promise<{ actionId: string; status: ActionStatus }[]> {
    const results = await Promise.allSettled(
      actionIds.map(async (actionId) => {
        try {
          // TODO: Fix schema mismatch - regenerate amplify_outputs.json
          const action = await (this.amplifyClient as any).models?.Action?.get({ id: actionId });
          return {
            actionId,
            status: action?.data?.status || ActionStatus.PENDING
          };
        } catch (error) {
          return {
            actionId,
            status: ActionStatus.FAILED
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          actionId: actionIds[index],
          status: ActionStatus.FAILED
        };
      }
    });
  }

  /**
   * 実行統計取得
   * @param results トリガー結果配列
   */
  getExecutionStats(results: TriggerResult[]): {
    total: number;
    succeeded: number;
    failed: number;
    successRate: number;
    failedActions: string[];
  } {
    const total = results.length;
    const succeeded = results.filter(r => r.success).length;
    const failed = total - succeeded;
    const successRate = total > 0 ? (succeeded / total) * 100 : 0;
    const failedActions = results.filter(r => !r.success).map(r => r.actionId);

    return {
      total,
      succeeded,
      failed,
      successRate,
      failedActions
    };
  }

  /**
   * 遅延処理（スロットリング対策）
   * @param ms 遅延時間（ミリ秒）
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
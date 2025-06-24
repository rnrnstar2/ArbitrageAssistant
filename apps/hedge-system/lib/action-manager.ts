/**
 * Action Manager - shared-amplifyブリッジ
 */
import { ActionService } from '@repo/shared-amplify/services';

const actionService = new ActionService();

export class ActionManager {
  async executeActions(actionIds: string[]) {
    return actionService.triggerMultipleActions(actionIds);
  }
  
  async getActionStats() {
    // ActionServiceにgetActionStatsメソッドがない場合の代替実装
    const actions = await actionService.listUserActions();
    return {
      totalExecuted: actions.filter((a: any) => a.status === 'EXECUTED').length,
      totalFailed: actions.filter((a: any) => a.status === 'FAILED').length,
      executingActions: actions.filter((a: any) => a.status === 'EXECUTING')
    };
  }
}

export const actionManager = new ActionManager();
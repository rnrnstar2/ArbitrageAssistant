/**
 * Action Manager - shared-amplifyブリッジ
 */
import { ActionService } from '@repo/shared-amplify/services';
import { Action, ActionStatus } from '@repo/shared-types';

const actionService = new ActionService();

export class ActionManager {
  async executeActions(actionIds: string[]) {
    return actionService.triggerMultipleActions(actionIds);
  }
  
  async getActionStats() {
    // ActionServiceにgetActionStatsメソッドがない場合の代替実装
    const actions = await actionService.listUserActions();
    return {
      totalExecuted: actions.filter((a: Action) => a.status === ActionStatus.EXECUTED).length,
      totalFailed: actions.filter((a: Action) => a.status === ActionStatus.FAILED).length,
      executingActions: actions.filter((a: Action) => a.status === ActionStatus.EXECUTING)
    };
  }
}

export const actionManager = new ActionManager();
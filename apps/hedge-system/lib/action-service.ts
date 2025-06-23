import { amplifyClient, getCurrentUserId } from './amplify-client';
import { CreateActionInput, ActionStatus } from '@repo/shared-types';
import {
  createAction,
  updateAction
} from './graphql/mutations';
import {
  listActionsByUserId,
  listExecutingActions,
  listPendingActions
} from './graphql/queries';

export class ActionService {
  static async create(input: CreateActionInput): Promise<any> {
    const userId = await getCurrentUserId();
    return amplifyClient.graphql({
      query: createAction,
      variables: { input: { ...input, userId } }
    });
  }

  static async updateStatus(id: string, status: ActionStatus): Promise<any> {
    return amplifyClient.graphql({
      query: updateAction,
      variables: { input: { id, status } }
    });
  }

  static async listByUserId(userId?: string, filter?: any): Promise<any> {
    const targetUserId = userId || await getCurrentUserId();
    return amplifyClient.graphql({
      query: listActionsByUserId,
      variables: { userId: targetUserId, filter }
    });
  }

  static async listExecuting(): Promise<any> {
    const userId = await getCurrentUserId();
    return amplifyClient.graphql({
      query: listExecutingActions,
      variables: { userId }
    });
  }

  static async listPending(): Promise<any> {
    const userId = await getCurrentUserId();
    return amplifyClient.graphql({
      query: listPendingActions,
      variables: { userId }
    });
  }
}
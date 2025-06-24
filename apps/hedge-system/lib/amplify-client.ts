/**
 * Hedge System - 統一Amplifyクライアント
 * 
 * MVPシステム設計書準拠の統一されたAmplifyサービスを使用
 * shared-amplifyパッケージからエクスポート
 */

// 統一されたAmplifyクライアントとサービスを使用
export { 
  // 基本クライアント
  amplifyClient, 
  getCurrentUserId, 
  getCurrentUser,
  // TODO: isAuthenticatedがshared-amplifyからexportされていない
  // isAuthenticated,
  
  // MVPシステム設計書準拠のサービス
  PositionService,
  ActionService,
  AccountService,
  UserService,
  SubscriptionService,
  
  // Position操作
  createPosition,
  updatePosition,
  listUserPositions,
  listOpenPositions,
  listTrailPositions,
  executePosition,
  closePosition,
  calculateNetPositions,
  
  // Action操作
  createAction,
  updateAction,
  listUserActions,
  listExecutingActions,
  listPendingActions,
  triggerAction,
  triggerMultipleActions,
  completeAction,
  failAction,
  createEntryAction,
  createCloseAction,
  
  // Account操作
  updateAccount,
  listUserAccounts,
  getAccount,
  updateAccountBalance,
  calculateCreditUtilization,
  
  // Subscription操作
  subscribeToPositions,
  subscribeToActions,
  subscribeToAccounts,
  subscribeToSystemCoordination,
  unsubscribe,
  unsubscribeAll,
  
} from '@repo/shared-amplify';

// 型定義（isolatedModules対応）
export type {
  Position,
  Action,
  Account,
  User,
  PositionStatus,
  ActionStatus,
  ActionType,
  ExecutionType,
  Symbol,
  UserRole,
  PCStatus
} from '@repo/shared-amplify';
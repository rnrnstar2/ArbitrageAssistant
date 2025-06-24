/**
 * Services Index - shared-amplify統一エクスポート
 * 
 * MVPシステム設計書準拠のサービス統合
 * shared-amplifyパッケージからの一元化されたサービス利用
 */

// ✅ shared-amplifyサービスのre-export
export {
  // サービスクラス
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
  
  // User操作
  createUser,
  updateUser,
  getUser,
  updateUserStatus,
  
  // Subscription操作
  subscribeToPositions,
  subscribeToActions,
  subscribeToAccounts,
  subscribeToSystemCoordination,
  unsubscribe,
  unsubscribeAll
} from '@repo/shared-amplify/services';

// SubscriptionService のローカル実装は継続
export { 
  SubscriptionService as LocalSubscriptionService,
  subscriptionService 
} from './subscription-service';
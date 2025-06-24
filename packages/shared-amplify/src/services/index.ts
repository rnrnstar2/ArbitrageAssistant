/**
 * Services Index - MVP システム設計書準拠の統一CRUDサービス
 * 
 * 設計原則：
 * - userIdベースの高速クエリ（GSI使用）
 * - 型安全なGraphQL操作
 * - 複数システム間の連携対応
 * - リアルタイム購読機能
 */

// 🏗️ サービスクラス
export { PositionService } from './position';
export { ActionService } from './action';
export { AccountService } from './account';
export { UserService } from './user';
export { SubscriptionService } from './subscription';

// 📍 Position関連操作
export {
  createPosition,
  updatePosition,
  listUserPositions,
  listOpenPositions,
  listTrailPositions,
  executePosition,
  closePosition,
  calculateNetPositions
} from './position';

// ⚡ Action関連操作
export {
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
  createCloseAction
} from './action';

// 🏦 Account関連操作
export {
  updateAccount,
  listUserAccounts,
  getAccount,
  updateAccountBalance,
  calculateCreditUtilization
} from './account';

// 👥 User関連操作
export {
  createUser,
  updateUser,
  getUser,
  updateUserStatus
} from './user';

// 📡 Subscription関連操作
export {
  subscribeToPositions,
  subscribeToActions,
  subscribeToAccounts,
  subscribeToSystemCoordination,
  unsubscribe,
  unsubscribeAll
} from './subscription';
/**
 * @repo/shared-amplify - MVP システム設計書準拠の統一AWS Amplify Gen2 サービス
 * 
 * 設計原則：
 * - userIdベースの高速クエリ最適化（v7.0対応）
 * - 複数Hedge System間の連携対応
 * - トレール機能の独立実行
 * - ボーナスアービトラージ対応
 * - amplify_outputs.json の一元管理
 * 
 * エクスポート構成：
 * - config: Amplify設定の一元管理
 * - client: 事前設定済みAmplifyクライアント
 * - services: MVP設計書準拠のCRUDサービス
 * - hooks: React用カスタムフック
 * - types: 統一型定義
 */

// 🔧 設定とクライアント
export { configureAmplify, amplifyConfig } from './config';
export { amplifyClient, getCurrentUserId, getCurrentUser, isAuthenticated, getAuthState } from './client';

// 📊 統一型定義
export * from './types';

// 🛠️ CRUDサービス
export * from './services';

// ⚛️ Reactフック（オプショナル）
export * from './hooks';

// 🎯 主要サービスクラス
export {
  PositionService,
  ActionService,
  AccountService,
  UserService,
  SubscriptionService
} from './services';

// 💡 便利関数
export {
  // Position操作
  createPosition,
  updatePosition,
  listUserPositions,
  executePosition,
  closePosition,
  
  // Action操作
  createAction,
  updateAction,
  triggerAction,
  completeAction,
  
  // Account操作
  updateAccount,
  listUserAccounts,
  
  // Subscription操作
  subscribeToPositions,
  subscribeToActions,
  unsubscribeAll
} from './services';

// 🌐 国際化（i18n）
export {
  translateAuthError,
  translate,
  authErrorMessages
} from './utils/i18n';

// 📊 モックデータ生成（開発・テスト用）
export {
  generateMockUsers,
  generateMockAccounts,
  generateMockPositions,
  generateMockActions,
  generateCompleteMockDataSet,
  generateMockDashboardStats,
  type MockDataSet,
  type MockDashboardStats
} from './utils/mock-data';

// 🔧 Service Instances
export {
  actionService,
  positionService,
  accountService,
  userService,
  subscriptionService
} from './services';
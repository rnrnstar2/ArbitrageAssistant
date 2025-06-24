/**
 * Admin Lib Index - MVPシステム設計書準拠のライブラリ統合エクスポート
 * 
 * AWS Amplify GraphQL統一アーキテクチャに基づく
 * アドミン画面用のライブラリ全体を提供します。
 * 
 * アーキテクチャ原則：
 * - 純粋GraphQL API（HTTP API削除）
 * - userIdベースの高速クエリ最適化
 * - 複数Hedge System間の連携
 * - ボーナスアービトラージ対応
 */

// Core Client & Authentication
export { amplifyClient, getCurrentUserId } from './amplify-client';

// Service Layer - MVPシステム設計書準拠 (GraphQL操作を統合)
export * from './services';

// Utilities
export * from './utils';
export * from './errorHandler';

// Legacy Amplify Config (compatibility)
export * from './amplify';

/**
 * 主要な使用方法：
 * 
 * ```typescript
 * import { 
 *   positionService,
 *   actionService,
 *   accountService,
 *   subscriptionService,
 *   MVPServices
 * } from '@/lib';
 * 
 * // Position操作
 * const position = await positionService.createPosition({...});
 * 
 * // トレール設定付きPosition作成
 * const positionWithTrail = await MVPServices.createPositionWithTrail({...});
 * 
 * // リアルタイム監視
 * await MVPServices.startSystemCoordination({
 *   onTrailTriggered: async (actionIds) => {...},
 *   onPositionExecuted: async (position) => {...}
 * });
 * ```
 */
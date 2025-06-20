/**
 * トレール通知システム - エクスポート
 */

// 型定義
export * from './trail-notification-types';

// 管理クラス
export { 
  TrailNotificationManager,
  getTrailNotificationManager,
  createTrailNotificationManager
} from './trail-notification-manager';

// React Hooks
export * from './useTrailNotifications';

// UIコンポーネント
export { TrailNotificationPanel } from './TrailNotificationPanel';
export { 
  TrailNotificationBadge,
  TrailNotificationIndicator,
  TrailNotificationToast
} from './TrailNotificationBadge';

// 便利な関数
export function createTrailNotificationData(
  positionId: string,
  symbol: string,
  accountId: string,
  trailId: string,
  options: {
    currentPrice?: number;
    stopLossPrice?: number;
    profit?: number;
    trailType?: 'fixed' | 'percentage' | 'atr';
    trailAmount?: number;
    oldValue?: number;
    newValue?: number;
    error?: string;
  } = {}
) {
  return {
    positionId,
    symbol,
    accountId,
    trailId,
    timestamp: new Date(),
    ...options
  };
}
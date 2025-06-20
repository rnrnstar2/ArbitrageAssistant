/**
 * トレール通知システム - 型定義
 */

export interface TrailNotificationData {
  positionId: string;
  symbol: string;
  accountId: string;
  trailId: string;
  oldValue?: number;
  newValue?: number;
  currentPrice?: number;
  stopLossPrice?: number;
  profit?: number;
  trailType?: 'fixed' | 'percentage' | 'atr';
  trailAmount?: number;
  error?: string;
  timestamp: Date;
}

export interface TrailNotification {
  id: string;
  type: TrailNotificationType;
  severity: 'info' | 'warning' | 'error' | 'critical' | 'success';
  title: string;
  message: string;
  data: TrailNotificationData;
  timestamp: Date;
  acknowledged: boolean;
  autoClose?: boolean;
  soundType?: TrailSoundType;
}

export type TrailNotificationType = 
  | 'trail_started'        // トレール開始
  | 'trail_updated'        // 損切りライン更新
  | 'trail_stopped'        // トレール停止
  | 'trail_executed'       // トレール実行（決済）
  | 'trail_error'          // トレールエラー
  | 'trail_warning'        // トレール警告
  | 'price_threshold'      // 価格閾値到達
  | 'connection_lost'      // EA接続断
  | 'max_profit_updated';  // 最大利益更新

export type TrailSoundType = 
  | 'glass'      // 一般的な通知
  | 'basso'      // 重要/エラー
  | 'purr'       // 成功/利益
  | 'sosumi'     // 警告
  | 'ping'       // 軽微な更新
  | 'funk'       // トレール開始
  | 'hero'       // 大きな利益
  | 'tink';      // 軽微な通知

export interface TrailNotificationSettings {
  enabled: boolean;
  showDesktopNotifications: boolean;
  enableSounds: boolean;
  enableMacOSNotifications: boolean;
  autoClose: boolean;
  autoCloseDelay: number; // seconds
  
  // 通知レベル設定
  levels: {
    trail_started: boolean;
    trail_updated: boolean;
    trail_stopped: boolean;
    trail_executed: boolean;
    trail_error: boolean;
    trail_warning: boolean;
    price_threshold: boolean;
    connection_lost: boolean;
    max_profit_updated: boolean;
  };
  
  // 音声設定
  sounds: {
    [K in TrailNotificationType]: TrailSoundType;
  };
  
  // カスタムメッセージテンプレート
  messageTemplates?: {
    [K in TrailNotificationType]?: string;
  };
}

export const DEFAULT_TRAIL_NOTIFICATION_SETTINGS: TrailNotificationSettings = {
  enabled: true,
  showDesktopNotifications: true,
  enableSounds: true,
  enableMacOSNotifications: true,
  autoClose: false,
  autoCloseDelay: 10,
  
  levels: {
    trail_started: true,
    trail_updated: false,     // デフォルトでは更新通知は無効
    trail_stopped: true,
    trail_executed: true,
    trail_error: true,
    trail_warning: true,
    price_threshold: true,
    connection_lost: true,
    max_profit_updated: false
  },
  
  sounds: {
    trail_started: 'funk',
    trail_updated: 'tink',
    trail_stopped: 'ping',
    trail_executed: 'purr',
    trail_error: 'basso',
    trail_warning: 'sosumi',
    price_threshold: 'glass',
    connection_lost: 'basso',
    max_profit_updated: 'hero'
  }
};

export interface TrailNotificationTemplate {
  type: TrailNotificationType;
  titleTemplate: string;
  messageTemplate: string;
  severity: TrailNotification['severity'];
  autoClose?: boolean;
  soundType?: TrailSoundType;
}

export const TRAIL_NOTIFICATION_TEMPLATES: Record<TrailNotificationType, TrailNotificationTemplate> = {
  trail_started: {
    type: 'trail_started',
    titleTemplate: 'トレール開始',
    messageTemplate: '{symbol} のトレールを開始しました (ポジションID: {positionId})',
    severity: 'info',
    autoClose: true,
    soundType: 'funk'
  },
  
  trail_updated: {
    type: 'trail_updated',
    titleTemplate: '損切りライン更新',
    messageTemplate: '{symbol} の損切りラインを {oldValue} → {newValue} に更新しました',
    severity: 'info',
    autoClose: true,
    soundType: 'tink'
  },
  
  trail_stopped: {
    type: 'trail_stopped',
    titleTemplate: 'トレール停止',
    messageTemplate: '{symbol} のトレールを停止しました',
    severity: 'warning',
    autoClose: false,
    soundType: 'ping'
  },
  
  trail_executed: {
    type: 'trail_executed',
    titleTemplate: 'トレール実行',
    messageTemplate: '{symbol} をトレール価格 {stopLossPrice} で決済しました (利益: {profit})',
    severity: 'success',
    autoClose: false,
    soundType: 'purr'
  },
  
  trail_error: {
    type: 'trail_error',
    titleTemplate: 'トレールエラー',
    messageTemplate: '{symbol} のトレール実行でエラーが発生しました: {error}',
    severity: 'error',
    autoClose: false,
    soundType: 'basso'
  },
  
  trail_warning: {
    type: 'trail_warning',
    titleTemplate: 'トレール警告',
    messageTemplate: '{symbol} のトレールで警告が発生しました: {error}',
    severity: 'warning',
    autoClose: false,
    soundType: 'sosumi'
  },
  
  price_threshold: {
    type: 'price_threshold',
    titleTemplate: '価格閾値到達',
    messageTemplate: '{symbol} が閾値価格に到達しました (現在価格: {currentPrice})',
    severity: 'info',
    autoClose: true,
    soundType: 'glass'
  },
  
  connection_lost: {
    type: 'connection_lost',
    titleTemplate: 'EA接続断',
    messageTemplate: 'EA接続が切断されました。トレール監視が停止している可能性があります。',
    severity: 'critical',
    autoClose: false,
    soundType: 'basso'
  },
  
  max_profit_updated: {
    type: 'max_profit_updated',
    titleTemplate: '最大利益更新',
    messageTemplate: '{symbol} の最大利益が更新されました (新記録: {profit})',
    severity: 'success',
    autoClose: true,
    soundType: 'hero'
  }
};
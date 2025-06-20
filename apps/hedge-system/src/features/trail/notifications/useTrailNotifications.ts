/**
 * トレール通知システム - React Hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrailNotification,
  TrailNotificationSettings,
  TrailNotificationType,
  TrailNotificationData
} from './trail-notification-types';
import { getTrailNotificationManager } from './trail-notification-manager';

export interface UseTrailNotificationsOptions {
  autoUpdate?: boolean;
  filterTypes?: TrailNotificationType[];
  maxNotifications?: number;
}

export interface UseTrailNotificationsReturn {
  // 通知データ
  notifications: TrailNotification[];
  unacknowledgedCount: number;
  latestNotification: TrailNotification | null;
  
  // 設定
  settings: TrailNotificationSettings;
  updateSettings: (settings: Partial<TrailNotificationSettings>) => void;
  
  // アクション
  acknowledge: (notificationId: string) => void;
  acknowledgeAll: () => void;
  clearNotifications: () => void;
  
  // 通知送信メソッド
  notifyTrailStarted: (data: TrailNotificationData) => Promise<void>;
  notifyTrailUpdated: (data: TrailNotificationData) => Promise<void>;
  notifyTrailStopped: (data: TrailNotificationData) => Promise<void>;
  notifyTrailExecuted: (data: TrailNotificationData) => Promise<void>;
  notifyTrailError: (data: TrailNotificationData, error: string) => Promise<void>;
  notifyTrailWarning: (data: TrailNotificationData, warning: string) => Promise<void>;
  notifyPriceThreshold: (data: TrailNotificationData) => Promise<void>;
  notifyConnectionLost: (data: TrailNotificationData) => Promise<void>;
  notifyMaxProfitUpdated: (data: TrailNotificationData) => Promise<void>;
  
  // テスト
  testNotification: (type?: TrailNotificationType) => Promise<void>;
}

export function useTrailNotifications(
  options: UseTrailNotificationsOptions = {}
): UseTrailNotificationsReturn {
  const {
    autoUpdate = true,
    filterTypes,
    maxNotifications = 50
  } = options;

  const manager = useMemo(() => getTrailNotificationManager(), []);
  
  const [notifications, setNotifications] = useState<TrailNotification[]>([]);
  const [settings, setSettings] = useState<TrailNotificationSettings>(
    manager.getSettings()
  );

  // 通知データの更新
  const updateNotifications = useCallback(() => {
    let allNotifications = manager.getNotifications();
    
    // フィルタリング
    if (filterTypes && filterTypes.length > 0) {
      allNotifications = allNotifications.filter(n => filterTypes.includes(n.type));
    }
    
    // 最大件数制限
    if (maxNotifications > 0) {
      allNotifications = allNotifications.slice(0, maxNotifications);
    }
    
    setNotifications(allNotifications);
  }, [manager, filterTypes, maxNotifications]);

  // 設定の更新
  const updateSettingsState = useCallback(() => {
    setSettings(manager.getSettings());
  }, [manager]);

  // 通知の購読設定
  useEffect(() => {
    if (!autoUpdate) return;

    const unsubscribe = manager.subscribe(() => {
      updateNotifications();
    });

    // 初期データの読み込み
    updateNotifications();
    updateSettingsState();

    return unsubscribe;
  }, [autoUpdate, manager, updateNotifications, updateSettingsState]);

  // アクション関数
  const acknowledge = useCallback((notificationId: string) => {
    manager.acknowledgeNotification(notificationId);
    updateNotifications();
  }, [manager, updateNotifications]);

  const acknowledgeAll = useCallback(() => {
    notifications.forEach(n => {
      if (!n.acknowledged) {
        manager.acknowledgeNotification(n.id);
      }
    });
    updateNotifications();
  }, [manager, notifications, updateNotifications]);

  const clearNotifications = useCallback(() => {
    manager.clearNotifications();
    updateNotifications();
  }, [manager, updateNotifications]);

  const updateSettings = useCallback((newSettings: Partial<TrailNotificationSettings>) => {
    manager.updateSettings(newSettings);
    updateSettingsState();
  }, [manager, updateSettingsState]);

  // 通知送信メソッド
  const notifyTrailStarted = useCallback(
    (data: TrailNotificationData) => manager.notifyTrailStarted(data),
    [manager]
  );

  const notifyTrailUpdated = useCallback(
    (data: TrailNotificationData) => manager.notifyTrailUpdated(data),
    [manager]
  );

  const notifyTrailStopped = useCallback(
    (data: TrailNotificationData) => manager.notifyTrailStopped(data),
    [manager]
  );

  const notifyTrailExecuted = useCallback(
    (data: TrailNotificationData) => manager.notifyTrailExecuted(data),
    [manager]
  );

  const notifyTrailError = useCallback(
    (data: TrailNotificationData, error: string) => manager.notifyTrailError(data, error),
    [manager]
  );

  const notifyTrailWarning = useCallback(
    (data: TrailNotificationData, warning: string) => manager.notifyTrailWarning(data, warning),
    [manager]
  );

  const notifyPriceThreshold = useCallback(
    (data: TrailNotificationData) => manager.notifyPriceThreshold(data),
    [manager]
  );

  const notifyConnectionLost = useCallback(
    (data: TrailNotificationData) => manager.notifyConnectionLost(data),
    [manager]
  );

  const notifyMaxProfitUpdated = useCallback(
    (data: TrailNotificationData) => manager.notifyMaxProfitUpdated(data),
    [manager]
  );

  const testNotification = useCallback(
    (type?: TrailNotificationType) => manager.testNotification(type),
    [manager]
  );

  // 派生データ
  const unacknowledgedCount = useMemo(
    () => notifications.filter(n => !n.acknowledged).length,
    [notifications]
  );

  const latestNotification = useMemo(
    () => notifications.length > 0 ? notifications[0] : null,
    [notifications]
  );

  return {
    // データ
    notifications,
    unacknowledgedCount,
    latestNotification,
    
    // 設定
    settings,
    updateSettings,
    
    // アクション
    acknowledge,
    acknowledgeAll,
    clearNotifications,
    
    // 通知送信
    notifyTrailStarted,
    notifyTrailUpdated,
    notifyTrailStopped,
    notifyTrailExecuted,
    notifyTrailError,
    notifyTrailWarning,
    notifyPriceThreshold,
    notifyConnectionLost,
    notifyMaxProfitUpdated,
    
    // テスト
    testNotification
  };
}

// 特定のタイプの通知のみを監視するHook
export function useTrailNotificationsFiltered(
  types: TrailNotificationType[],
  options?: Omit<UseTrailNotificationsOptions, 'filterTypes'>
): UseTrailNotificationsReturn {
  return useTrailNotifications({
    ...options,
    filterTypes: types
  });
}

// 未確認通知のみを監視するHook
export function useUnacknowledgedTrailNotifications(
  options?: UseTrailNotificationsOptions
): {
  notifications: TrailNotification[];
  count: number;
  acknowledge: (id: string) => void;
  acknowledgeAll: () => void;
} {
  const { notifications, acknowledge, acknowledgeAll } = useTrailNotifications(options);
  
  const unacknowledged = useMemo(
    () => notifications.filter(n => !n.acknowledged),
    [notifications]
  );

  return {
    notifications: unacknowledged,
    count: unacknowledged.length,
    acknowledge,
    acknowledgeAll
  };
}
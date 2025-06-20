// Main persistence service and types
export {
  DataPersistenceService,
  PositionPersistenceService,
  MarketDataPersistenceService,
  getPersistenceService,
} from './DataPersistenceService';

export type {
  PersistenceEntry,
  HistoryEntry,
  PersistenceStats,
  PersistenceConfig,
  DataChanges,
} from './DataPersistenceService';

// Integration hooks and utilities
export {
  usePersistence,
  usePositionPersistence,
  useMarketDataPersistence,
  PersistenceManager,
  PersistenceMonitor,
  exportAllData,
  importAllData,
} from './PersistenceIntegration';

export type {
  PersistenceHookOptions,
} from './PersistenceIntegration';

// Notification service
export { default as notificationService } from './NotificationService';
export type {
  NotificationType,
  SoundType,
  NotificationOptions,
  NotificationAction,
  NotificationSettings,
  NotificationHistory,
} from './NotificationService';

// Condition monitoring service
export {
  ConditionMonitoringService,
  DEFAULT_CONDITIONS,
} from './ConditionMonitoringService';
export type {
  MonitoringCondition,
  MonitoringEvent,
  ConditionEvaluationContext,
  MonitoringStatistics,
} from './ConditionMonitoringService';

// Notification trigger service
export {
  NotificationTrigger,
  createNotificationTrigger,
  DEFAULT_NOTIFICATION_CONFIG,
} from './NotificationTrigger';
export type {
  NotificationTriggerConfig,
} from './NotificationTrigger';

// Convenience functions for common operations
export const createPersistenceManager = () => PersistenceManager.getInstance();

export const initializePersistence = async () => {
  const manager = PersistenceManager.getInstance();
  await manager.initialize();
  return manager;
};

// Performance optimization service
export {
  PerformanceOptimizationService,
  getPerformanceOptimizationService,
  usePerformanceOptimization,
} from './PerformanceOptimizationService';
export type {
  PerformanceMetrics,
  MemoryStats,
  OptimizationConfig,
  DataCompressionResult,
} from './PerformanceOptimizationService';
export { LossCutHistory } from './LossCutHistory';
export { LossCutDetailViewer } from './LossCutDetailViewer';
export { LossCutAnalytics } from './LossCutAnalytics';
export { 
  LossCutHistoryManager,
  lossCutHistoryManager,
  type LossCutHistoryRecord,
  type ActionExecutionRecord,
  type LossCutFilter,
  type LossCutAnalytics as LossCutAnalyticsData
} from './LossCutHistoryManager';

// Re-export existing components
export { LossCutMonitor } from './LossCutMonitor';
export { MarginLevelGauge } from './MarginLevelGauge';
export { EmergencyActions } from './EmergencyActions';
export { InteractiveMarginGauge } from './InteractiveMarginGauge';
export { MarginDetailPanel } from './MarginDetailPanel';
export { MultiMarginGauge } from './MultiMarginGauge';
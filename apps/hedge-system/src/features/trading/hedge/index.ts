// 両建てポジション検出機能
export {
  HedgePositionDetector,
  type HedgeDetectionCriteria,
  type HedgePosition,
  type PotentialHedge
} from './HedgePositionDetector';

// ポジション関連付け管理機能
export { PositionRelationManager } from './PositionRelationManager';

// 両建てポジション検証機能
export { HedgePositionValidator } from './HedgePositionValidator';

// 両建て実行エンジン
export { HedgeExecutor } from './HedgeExecutor';
export type {
  HedgeExecutionCriteria,
  HedgeResult,
  ExecutionStatus
} from './HedgeExecutor';

// 両建てバランス計算機能
export { HedgeBalanceCalculator } from './HedgeBalanceCalculator';
export type {
  HedgeBalance,
  OptimalLots,
  RebalanceAction,
  RebalanceStep,
  RiskMetrics,
  LiquidityConstraints,
  OptimizationParams
} from './HedgeBalanceCalculator';

// クロスアカウント両建て機能
export { CrossAccountHedge } from './CrossAccountHedge';
export type {
  AccountExecution,
  BalanceValidation,
  SyncResult,
  CrossHedgeResult,
  CrossAccountSettings
} from './CrossAccountHedge';

// 両建てリバランス機能
export { HedgeRebalancer } from './HedgeRebalancer';
export type {
  RebalanceTarget,
  RebalanceSchedule,
  RebalanceCondition,
  RebalanceResult,
  RebalanceStatistics,
  RebalanceSettings
} from './HedgeRebalancer';

// UI コンポーネント
export { HedgePositionGrid } from './components';
export { HedgeControlPanel } from './components/HedgeControlPanel';
export type { HedgeAction, HedgeSettings } from './components/HedgeControlPanel';
export { HedgeAnalytics } from './components/HedgeAnalytics';
export type { 
  HedgeAnalyticsProps, 
  AnalyticsData, 
  HedgeStatistics, 
  HedgePerformance, 
  TimeSeriesDataPoint,
  TimeRange 
} from './components/HedgeAnalytics';

// 分析サービス
export { HedgeAnalyticsService } from './services/HedgeAnalyticsService';
export type {
  AdvancedHedgeStatistics,
  HedgePerformanceMetrics,
  SymbolAnalysis,
  TimeSeriesAnalytics,
  HedgeRiskAnalysis
} from './services/HedgeAnalyticsService';

// データエクスポート
export { HedgeDataExporter } from './services/HedgeDataExporter';
export type {
  ExportableData,
  ExportOptions,
  ExportFormat
} from './services/HedgeDataExporter';

// 履歴管理
export { default as HedgeHistoryManager } from './HedgeHistoryManager';
export type {
  HedgeAction,
  HedgeActionType,
  HedgeHistoryRecord,
  HedgeStateSnapshot,
  HedgePerformanceSnapshot,
  TimelineEvent,
  HistoryFilter,
  ExportData,
  HistorySummary,
  HistoryAnalytics,
  PatternAnalysis,
  PerformanceAnalysis,
  TrendAnalysis
} from './HedgeHistoryManager';

// チャートライブラリ
export { 
  HedgeChart, 
  HedgeProfitChart, 
  HedgeBalanceChart 
} from './components/charts/HedgeChartLib';
export type {
  ChartPoint,
  ChartSeries,
  ChartConfig,
  HedgeChartProps,
  ProfitChartProps,
  BalanceChartProps
} from './components/charts/HedgeChartLib';

// 型定義
export type {
  HedgeRelationship,
  HedgeValidationResult,
  HedgeValidationIssue
} from './types';
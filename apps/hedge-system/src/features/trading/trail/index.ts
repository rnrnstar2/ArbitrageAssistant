export { TrailPresetManager } from './TrailPresetManager';
export { useTrailPresetStorage } from './hooks/useTrailPresetStorage';
export { usePriceMonitor } from './hooks/usePriceMonitor';
export { PriceMonitor } from './PriceMonitor';
export { PriceMonitorExample } from './PriceMonitorExample';
export { 
  TrailExecutor, 
  createTrailExecutor, 
  executePositionTrail
} from './TrailExecutor';
export type {
  TrailSettings,
  TrailPreset,
  TrailPresetStorage,
  TrailPresetManagerProps,
  CreatePresetFormData,
  PresetFilterOptions
} from './types';
export type {
  PriceData,
  MonitoredPosition,
  TrailJudgmentResult,
  AbnormalPriceDetectionConfig,
  PerformanceConfig
} from './PriceMonitor';
export type {
  TrailCommand,
  TrailExecutionResult,
  TrailExecutionState,
  TrailExecutorConfig,
  TrailCalculationResult,
  TrailExecutorEvent
} from './TrailExecutor';
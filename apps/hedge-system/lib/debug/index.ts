// Debug Tools Core
export { DebugTools } from './debug-tools';
export type {
  ErrorType,
  MessageFilter,
  DebugMessage,
  NetworkTrace,
  MessageMonitor,
  MessageSimulator
} from './debug-tools';

// Communication Diagnostics
export { CommunicationDiagnostics } from './communication-diagnostics';
export type {
  ConnectionTestResult,
  NetworkHop,
  LatencyTestResult,
  LatencyAnalysis,
  ThroughputTestResult,
  BottleneckAnalysis,
  DiagnosisResult,
  ComponentDiagnosis
} from './communication-diagnostics';

// System Diagnostics
export { SystemDiagnostics } from './system-diagnostics';
export type {
  SystemDiagnosticReport,
  ComponentDiagnostic,
  DiagnosticIssue,
  SystemHealthSummary,
  EAHealthReport,
  DataIntegrityReport,
  PerformanceReport
} from './system-diagnostics';

// Debug components and hooks have been removed for MVP

// Re-export from websocket diagnostics for compatibility
export type {
  DiagnosticManager,
  MemoryMetrics,
  GCStats,
  ConnectionMetrics,
  FullDiagnosticReport
} from '../websocket/diagnostic-manager';
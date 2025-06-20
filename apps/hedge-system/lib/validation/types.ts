/**
 * データ検証・整合性チェック・品質管理機能の型定義
 */

import type {
  PositionUpdateData,
  AccountInfoData,
  MarketData,
  LosscutAlert,
  HeartbeatData,
} from '../websocket/message-types';

// ===== VALIDATION TYPES =====

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  value?: any;
  expectedValue?: any;
  constraint?: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: 'warning' | 'info';
  value?: any;
  suggestedValue?: any;
  impact?: string;
}

export interface BatchValidationResult {
  totalItems: number;
  validItems: number;
  errorItems: number;
  warningItems: number;
  overallScore: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  processingTime: number;
}

export type DataType = 
  | 'position'
  | 'account'
  | 'market'
  | 'losscut'
  | 'heartbeat';

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'format' | 'business' | 'statistical';
  constraint: any;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationContext {
  dataType: DataType;
  accountId: string;
  timestamp: number;
  historicalData?: any[];
  marketContext?: MarketContext;
}

export interface MarketContext {
  isMarketOpen: boolean;
  currentSpread: number;
  volatility: number;
  marketCondition: 'normal' | 'volatile' | 'closed';
}

// ===== CONSISTENCY CHECK TYPES =====

export interface ConsistencyResult {
  consistent: boolean;
  issues: ConsistencyIssue[];
  recommendations: string[];
  confidenceScore: number; // 0-100
}

export interface ConsistencyIssue {
  type: 'mismatch' | 'gap' | 'duplication' | 'sequence' | 'calculation' | 'anomaly';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  affectedFields: string[];
  suggestedFix?: string;
  impact?: string;
  confidence?: number;
}

export interface CrossValidationData {
  positions: PositionUpdateData[];
  accountInfo: AccountInfoData;
  marketData: MarketData[];
  timestamp: number;
}

export interface DataHistoryEntry {
  data: any;
  timestamp: number;
  dataType: DataType;
  accountId: string;
}

// ===== QUALITY MANAGEMENT TYPES =====

export interface QualityAssessment {
  overallScore: number; // 0-100
  dimensions: QualityDimensions;
  issues: QualityIssue[];
  improvements: string[];
  trend: QualityTrend;
  metadata: QualityMetadata;
}

export interface QualityDimensions {
  completeness: number; // 0-100
  accuracy: number; // 0-100
  consistency: number; // 0-100
  timeliness: number; // 0-100
  validity: number; // 0-100
  reliability: number; // 0-100
}

export interface QualityIssue {
  dimension: keyof QualityDimensions;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  examples: any[];
  impact: string;
  category: string;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface QualityTrend {
  direction: 'improving' | 'stable' | 'degrading';
  rate: number; // change per hour
  confidence: number; // 0-100
  timeWindow: number; // minutes
}

export interface QualityMetadata {
  assessmentTime: Date;
  dataVolume: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  dataTypes: DataType[];
}

export interface QualityReport {
  summary: QualityAssessment;
  detailedAnalysis: DetailedQualityAnalysis;
  recommendations: QualityRecommendation[];
  actionItems: QualityActionItem[];
  generatedAt: Date;
}

export interface DetailedQualityAnalysis {
  byDataType: Record<DataType, QualityAssessment>;
  byTimeSlice: TimeSliceAnalysis[];
  patterns: QualityPattern[];
  anomalies: QualityAnomaly[];
}

export interface TimeSliceAnalysis {
  timeSlice: {
    start: Date;
    end: Date;
  };
  dataVolume: number;
  qualityScore: number;
  issues: QualityIssue[];
}

export interface QualityPattern {
  type: 'periodic' | 'trend' | 'seasonal' | 'random';
  description: string;
  confidence: number;
  impact: 'positive' | 'negative' | 'neutral';
  recommendation: string;
}

export interface QualityAnomaly {
  timestamp: Date;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedData: any;
  potentialCause: string;
  resolution?: string;
}

export interface QualityRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'validation' | 'consistency' | 'performance' | 'monitoring';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

export interface QualityActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee?: string;
  dueDate?: Date;
  relatedIssues: string[];
}

export interface DataCleaningResult {
  originalCount: number;
  cleanedCount: number;
  removedCount: number;
  correctedCount: number;
  cleaningRules: CleaningRule[];
  processedData: any[];
  issues: DataCleaningIssue[];
}

export interface CleaningRule {
  type: 'remove' | 'correct' | 'flag';
  condition: string;
  action: string;
  applied: number;
}

export interface DataCleaningIssue {
  type: 'data_loss' | 'correction_uncertainty' | 'pattern_break';
  description: string;
  impact: string;
  recommendation: string;
}

// ===== STATISTICAL ANALYSIS TYPES =====

export interface StatisticalAnalysis {
  outliers: OutlierDetection;
  trends: TrendAnalysis;
  distribution: DistributionAnalysis;
  correlations: CorrelationAnalysis;
}

export interface OutlierDetection {
  method: 'iqr' | 'zscore' | 'isolation_forest';
  outliers: OutlierPoint[];
  threshold: number;
  confidence: number;
}

export interface OutlierPoint {
  index: number;
  value: any;
  score: number;
  field: string;
  timestamp: Date;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'flat';
  strength: number; // 0-1
  confidence: number; // 0-100
  periodicity?: number;
  seasonality?: SeasonalityInfo;
}

export interface SeasonalityInfo {
  detected: boolean;
  period: number;
  strength: number;
  pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
}

export interface DistributionAnalysis {
  type: 'normal' | 'skewed' | 'uniform' | 'multimodal' | 'unknown';
  mean: number;
  median: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  confidence: number;
}

export interface CorrelationAnalysis {
  correlations: FieldCorrelation[];
  strongCorrelations: FieldCorrelation[];
  suspiciousCorrelations: FieldCorrelation[];
}

export interface FieldCorrelation {
  field1: string;
  field2: string;
  correlation: number; // -1 to 1
  pValue: number;
  significance: 'strong' | 'moderate' | 'weak' | 'none';
}

// ===== PERFORMANCE MONITORING TYPES =====

export interface PerformanceMetrics {
  validationLatency: number; // ms
  throughput: number; // items/second
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  errorRate: number; // percentage
  cacheHitRate: number; // percentage
}

export interface PerformanceBenchmark {
  operation: string;
  expectedLatency: number;
  maxLatency: number;
  expectedThroughput: number;
  minThroughput: number;
}

// ===== CONFIGURATION TYPES =====

export interface ValidationConfig {
  rules: ValidationRule[];
  enabledChecks: {
    schemaValidation: boolean;
    businessLogicValidation: boolean;
    statisticalValidation: boolean;
    consistencyCheck: boolean;
  };
  thresholds: {
    errorTolerance: number; // percentage
    warningTolerance: number; // percentage
    qualityMinimum: number; // 0-100
  };
  performance: {
    maxBatchSize: number;
    timeoutMs: number;
    maxMemoryMB: number;
  };
}

export interface ConsistencyConfig {
  tolerances: {
    profitCalculationTolerance: number; // percentage
    marginCalculationTolerance: number; // percentage
    priceVariationTolerance: number; // percentage
    timeGapTolerance: number; // seconds
  };
  historicalComparisonWindow: number; // minutes
  minimumDataPoints: number;
}

export interface QualityConfig {
  dimensionWeights: QualityDimensions;
  reportingInterval: number; // minutes
  retentionPeriod: number; // days
  alertThresholds: {
    qualityDegradation: number; // score drop
    issueCount: number;
    errorRate: number; // percentage
  };
}

// ===== ERROR HANDLING TYPES =====

export interface ValidationErrorContext {
  operation: string;
  dataType: DataType;
  accountId: string;
  timestamp: Date;
  inputData: any;
  errorStack?: string;
}

export interface RecoveryStrategy {
  type: 'retry' | 'skip' | 'correct' | 'flag';
  maxAttempts?: number;
  fallbackValue?: any;
  condition?: string;
}

// ===== CONSTANTS =====

export const VALIDATION_ERROR_CODES = {
  // Schema validation errors
  REQUIRED_FIELD_MISSING: 'VAL_001',
  INVALID_DATA_TYPE: 'VAL_002',
  VALUE_OUT_OF_RANGE: 'VAL_003',
  INVALID_FORMAT: 'VAL_004',
  
  // Business logic errors
  INVALID_LOT_SIZE: 'BUS_001',
  INVALID_PRICE: 'BUS_002',
  PROFIT_CALCULATION_MISMATCH: 'BUS_003',
  MARGIN_CALCULATION_ERROR: 'BUS_004',
  POSITION_STATUS_INCONSISTENT: 'BUS_005',
  
  // Statistical anomalies
  STATISTICAL_OUTLIER: 'STAT_001',
  ABNORMAL_VARIATION: 'STAT_002',
  TREND_BREAK: 'STAT_003',
  
  // Consistency issues
  DATA_MISMATCH: 'CONS_001',
  TIME_GAP: 'CONS_002',
  SEQUENCE_ERROR: 'CONS_003',
  DUPLICATE_DATA: 'CONS_004',
  
  // Quality issues
  DATA_COMPLETENESS: 'QUAL_001',
  DATA_ACCURACY: 'QUAL_002',
  DATA_TIMELINESS: 'QUAL_003',
  DATA_RELIABILITY: 'QUAL_004',
} as const;

export const QUALITY_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  ACCEPTABLE: 60,
  POOR: 40,
  CRITICAL: 20,
} as const;

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  rules: [],
  enabledChecks: {
    schemaValidation: true,
    businessLogicValidation: true,
    statisticalValidation: true,
    consistencyCheck: true,
  },
  thresholds: {
    errorTolerance: 1, // 1%
    warningTolerance: 5, // 5%
    qualityMinimum: 75,
  },
  performance: {
    maxBatchSize: 1000,
    timeoutMs: 5000,
    maxMemoryMB: 100,
  },
};

export const DEFAULT_CONSISTENCY_CONFIG: ConsistencyConfig = {
  tolerances: {
    profitCalculationTolerance: 1, // 1%
    marginCalculationTolerance: 2, // 2%
    priceVariationTolerance: 5, // 5%
    timeGapTolerance: 5, // 5 seconds
  },
  historicalComparisonWindow: 60, // 1 hour
  minimumDataPoints: 10,
};

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  dimensionWeights: {
    completeness: 20,
    accuracy: 30,
    consistency: 20,
    timeliness: 15,
    validity: 10,
    reliability: 5,
  },
  reportingInterval: 15, // 15 minutes
  retentionPeriod: 30, // 30 days
  alertThresholds: {
    qualityDegradation: 10, // 10 points drop
    issueCount: 50,
    errorRate: 5, // 5%
  },
};
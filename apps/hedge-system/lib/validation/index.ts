/**
 * データ検証・整合性チェック・品質管理機能のエクスポート
 * 
 * このファイルからvalidation機能の全てにアクセスできます
 */

// Core classes
export { DataValidator, StatisticalAnalyzer, FinancialCalculator } from './data-validator';
export { ConsistencyChecker, DataHistoryManager } from './consistency-checker';
export { QualityManager, QualityMetricsCollector } from './quality-manager';

// Type definitions
export type {
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BatchValidationResult,
  ValidationRule,
  ValidationContext,
  MarketContext,
  DataType,
  
  // Consistency types
  ConsistencyResult,
  ConsistencyIssue,
  CrossValidationData,
  DataHistoryEntry,
  
  // Quality types
  QualityAssessment,
  QualityDimensions,
  QualityIssue,
  QualityTrend,
  QualityMetadata,
  QualityReport,
  DetailedQualityAnalysis,
  TimeSliceAnalysis,
  QualityPattern,
  QualityAnomaly,
  QualityRecommendation,
  QualityActionItem,
  
  // Data cleaning types
  DataCleaningResult,
  CleaningRule,
  DataCleaningIssue,
  
  // Statistical analysis types
  StatisticalAnalysis,
  OutlierDetection,
  OutlierPoint,
  TrendAnalysis,
  SeasonalityInfo,
  DistributionAnalysis,
  CorrelationAnalysis,
  FieldCorrelation,
  
  // Performance types
  PerformanceMetrics,
  PerformanceBenchmark,
  
  // Configuration types
  ValidationConfig,
  ConsistencyConfig,
  QualityConfig,
  
  // Error handling types
  ValidationErrorContext,
  RecoveryStrategy,
} from './types';

// Constants
export {
  VALIDATION_ERROR_CODES,
  QUALITY_THRESHOLDS,
  DEFAULT_VALIDATION_CONFIG,
  DEFAULT_CONSISTENCY_CONFIG,
  DEFAULT_QUALITY_CONFIG,
} from './types';

/**
 * 統合された検証管理クラス
 * 
 * DataValidator、ConsistencyChecker、QualityManagerを統合したファサードクラス
 */
export class ValidationManager {
  private dataValidator: DataValidator;
  private consistencyChecker: ConsistencyChecker;
  private qualityManager: QualityManager;

  constructor(
    validationConfig?: ValidationConfig,
    consistencyConfig?: ConsistencyConfig,
    qualityConfig?: QualityConfig
  ) {
    this.dataValidator = new DataValidator(validationConfig);
    this.consistencyChecker = new ConsistencyChecker(consistencyConfig);
    this.qualityManager = new QualityManager(
      this.dataValidator,
      this.consistencyChecker,
      qualityConfig
    );
  }

  /**
   * データバリデーター取得
   */
  getValidator(): DataValidator {
    return this.dataValidator;
  }

  /**
   * 整合性チェッカー取得
   */
  getConsistencyChecker(): ConsistencyChecker {
    return this.consistencyChecker;
  }

  /**
   * 品質管理機能取得
   */
  getQualityManager(): QualityManager {
    return this.qualityManager;
  }

  /**
   * 包括的なデータ検証
   */
  async validateData(data: any, type: DataType, context?: ValidationContext): Promise<{
    validation: ValidationResult;
    consistency?: ConsistencyResult;
    quality?: QualityAssessment;
  }> {
    const validation = await this.dataValidator.validatePositionData(data, context);
    
    // Optional consistency check if historical data is available
    let consistency: ConsistencyResult | undefined;
    if (context?.historicalData) {
      consistency = await this.consistencyChecker.checkDataConsistency(
        data,
        context.historicalData,
        type
      );
    }

    // Optional quality assessment for batch operations
    let quality: QualityAssessment | undefined;
    if (Array.isArray(data)) {
      quality = await this.qualityManager.assessDataQuality(data, type);
    }

    return {
      validation,
      consistency,
      quality,
    };
  }

  /**
   * バッチデータ検証
   */
  async validateBatch(
    data: any[],
    type: DataType,
    context?: ValidationContext
  ): Promise<{
    batchValidation: BatchValidationResult;
    consistency: ConsistencyResult;
    quality: QualityAssessment;
  }> {
    const batchValidation = await this.dataValidator.validateBatch(data, type, context);
    
    // Cross-validation for consistency
    const consistency = await this.consistencyChecker.checkDataConsistency(
      data[data.length - 1], // Latest data
      data.slice(0, -1), // Historical data
      type
    );

    // Quality assessment
    const quality = await this.qualityManager.assessDataQuality(data, type);

    return {
      batchValidation,
      consistency,
      quality,
    };
  }

  /**
   * クリーンアップとデータクリーニング
   */
  async cleanAndValidate(
    data: any[],
    type: DataType,
    context?: ValidationContext
  ): Promise<{
    cleaningResult: DataCleaningResult;
    validation: BatchValidationResult;
    quality: QualityAssessment;
  }> {
    // Clean data first
    const cleaningResult = await this.qualityManager.cleanData(data, type);
    
    // Validate cleaned data
    const validation = await this.dataValidator.validateBatch(
      cleaningResult.processedData,
      type,
      context
    );

    // Assess quality of cleaned data
    const quality = await this.qualityManager.assessDataQuality(
      cleaningResult.processedData,
      type
    );

    return {
      cleaningResult,
      validation,
      quality,
    };
  }

  /**
   * 全体的な品質レポート生成
   */
  async generateComprehensiveReport(): Promise<QualityReport & {
    validationMetrics: PerformanceMetrics;
    consistencyStats: any;
  }> {
    const qualityReport = await this.qualityManager.generateQualityReport();
    const validationMetrics = this.dataValidator.getPerformanceMetrics();
    const consistencyStats = this.consistencyChecker.getHistoryManager().getStats();

    return {
      ...qualityReport,
      validationMetrics,
      consistencyStats,
    };
  }

  /**
   * 設定の一括更新
   */
  updateConfigurations(configs: {
    validation?: Partial<ValidationConfig>;
    consistency?: Partial<ConsistencyConfig>;
    quality?: Partial<QualityConfig>;
  }): void {
    if (configs.validation) {
      this.dataValidator.updateConfig(configs.validation);
    }
    if (configs.consistency) {
      this.consistencyChecker.updateConfig(configs.consistency);
    }
    if (configs.quality) {
      this.qualityManager.updateConfig(configs.quality);
    }
  }

  /**
   * パフォーマンス指標の取得
   */
  getPerformanceOverview(): {
    validation: PerformanceMetrics;
    qualityMetrics: any;
    consistencyStats: any;
  } {
    return {
      validation: this.dataValidator.getPerformanceMetrics(),
      qualityMetrics: this.qualityManager.getMetricsCollector().getStatistics(),
      consistencyStats: this.consistencyChecker.getHistoryManager().getStats(),
    };
  }
}

/**
 * デフォルトの検証管理インスタンスを作成するファクトリー関数
 */
export function createValidationManager(options?: {
  validationConfig?: Partial<ValidationConfig>;
  consistencyConfig?: Partial<ConsistencyConfig>;
  qualityConfig?: Partial<QualityConfig>;
}): ValidationManager {
  return new ValidationManager(
    options?.validationConfig ? { ...DEFAULT_VALIDATION_CONFIG, ...options.validationConfig } : undefined,
    options?.consistencyConfig ? { ...DEFAULT_CONSISTENCY_CONFIG, ...options.consistencyConfig } : undefined,
    options?.qualityConfig ? { ...DEFAULT_QUALITY_CONFIG, ...options.qualityConfig } : undefined
  );
}

/**
 * 個別の検証機能を作成するファクトリー関数
 */
export const ValidationFactory = {
  /**
   * データバリデーターの作成
   */
  createValidator(config?: Partial<ValidationConfig>): DataValidator {
    return new DataValidator(config ? { ...DEFAULT_VALIDATION_CONFIG, ...config } : undefined);
  },

  /**
   * 整合性チェッカーの作成
   */
  createConsistencyChecker(config?: Partial<ConsistencyConfig>): ConsistencyChecker {
    return new ConsistencyChecker(config ? { ...DEFAULT_CONSISTENCY_CONFIG, ...config } : undefined);
  },

  /**
   * 品質管理機能の作成
   */
  createQualityManager(
    validator?: DataValidator,
    consistencyChecker?: ConsistencyChecker,
    config?: Partial<QualityConfig>
  ): QualityManager {
    const validatorInstance = validator || ValidationFactory.createValidator();
    const consistencyInstance = consistencyChecker || ValidationFactory.createConsistencyChecker();
    
    return new QualityManager(
      validatorInstance,
      consistencyInstance,
      config ? { ...DEFAULT_QUALITY_CONFIG, ...config } : undefined
    );
  },
};

/**
 * ユーティリティ関数
 */
export const ValidationUtils = {
  /**
   * 検証結果の要約
   */
  summarizeValidationResult(result: ValidationResult): string {
    const status = result.valid ? 'PASSED' : 'FAILED';
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    const score = result.score.toFixed(1);
    
    return `Validation ${status} (Score: ${score}/100, Errors: ${errorCount}, Warnings: ${warningCount})`;
  },

  /**
   * 品質レベルの判定
   */
  getQualityLevel(score: number): 'Excellent' | 'Good' | 'Acceptable' | 'Poor' | 'Critical' {
    if (score >= QUALITY_THRESHOLDS.EXCELLENT) return 'Excellent';
    if (score >= QUALITY_THRESHOLDS.GOOD) return 'Good';
    if (score >= QUALITY_THRESHOLDS.ACCEPTABLE) return 'Acceptable';
    if (score >= QUALITY_THRESHOLDS.POOR) return 'Poor';
    return 'Critical';
  },

  /**
   * エラーの重要度分析
   */
  analyzeSeverity(errors: ValidationError[]): {
    critical: number;
    major: number;
    minor: number;
  } {
    return {
      critical: errors.filter(e => e.severity === 'error').length,
      major: errors.filter(e => e.severity === 'warning').length,
      minor: errors.filter(e => e.severity === 'info').length,
    };
  },

  /**
   * トレンド方向の判定
   */
  getTrendDirection(trend: QualityTrend): '📈' | '📉' | '➡️' {
    switch (trend.direction) {
      case 'improving': return '📈';
      case 'degrading': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  },
};

// 後方互換性のためのエイリアス
export { DataValidator as Validator };
export { ConsistencyChecker as ConsistencyValidator };
export { QualityManager as QualityAssessor };
/**
 * データ品質管理機能の実装
 * 
 * データ品質評価、品質レポート生成、品質トレンド監視、データクリーニング機能を提供します
 */

import type {
  PositionUpdateData,
  AccountInfoData,
  MarketData,
  LosscutAlert,
  HeartbeatData,
} from '../websocket/message-types';

import type {
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
  DataCleaningResult,
  CleaningRule,
  DataCleaningIssue,
  DataType,
  ValidationResult,
  ConsistencyResult,
  QualityConfig,
} from './types';

import {
  QUALITY_THRESHOLDS,
  DEFAULT_QUALITY_CONFIG,
} from './types';

import { DataValidator } from './data-validator';
import { ConsistencyChecker } from './consistency-checker';

/**
 * 品質メトリクス収集クラス
 */
export class QualityMetricsCollector {
  private validationResults: Map<string, ValidationResult[]> = new Map();
  private consistencyResults: Map<string, ConsistencyResult[]> = new Map();
  private dataVolume: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private warningCounts: Map<string, number> = new Map();
  private processingTimes: Map<string, number[]> = new Map();

  /**
   * バリデーション結果を記録
   */
  recordValidationResult(dataType: DataType, result: ValidationResult): void {
    const key = `validation_${dataType}`;
    
    if (!this.validationResults.has(key)) {
      this.validationResults.set(key, []);
    }
    
    this.validationResults.get(key)!.push({
      ...result,
      timestamp: Date.now(),
    } as ValidationResult & { timestamp: number });

    // Update error and warning counts
    this.updateErrorCount(dataType, result.errors.length);
    this.updateWarningCount(dataType, result.warnings.length);
  }

  /**
   * 整合性チェック結果を記録
   */
  recordConsistencyResult(dataType: DataType, result: ConsistencyResult): void {
    const key = `consistency_${dataType}`;
    
    if (!this.consistencyResults.has(key)) {
      this.consistencyResults.set(key, []);
    }
    
    this.consistencyResults.get(key)!.push({
      ...result,
      timestamp: Date.now(),
    } as ConsistencyResult & { timestamp: number });
  }

  /**
   * データボリュームを記録
   */
  recordDataVolume(dataType: DataType, count: number): void {
    const current = this.dataVolume.get(dataType) || 0;
    this.dataVolume.set(dataType, current + count);
  }

  /**
   * 処理時間を記録
   */
  recordProcessingTime(operation: string, timeMs: number): void {
    if (!this.processingTimes.has(operation)) {
      this.processingTimes.set(operation, []);
    }
    
    const times = this.processingTimes.get(operation)!;
    times.push(timeMs);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
  }

  /**
   * エラー数の更新
   */
  private updateErrorCount(dataType: DataType, errorCount: number): void {
    const current = this.errorCounts.get(dataType) || 0;
    this.errorCounts.set(dataType, current + errorCount);
  }

  /**
   * 警告数の更新
   */
  private updateWarningCount(dataType: DataType, warningCount: number): void {
    const current = this.warningCounts.get(dataType) || 0;
    this.warningCounts.set(dataType, current + warningCount);
  }

  /**
   * 統計情報の取得
   */
  getStatistics(): {
    totalValidations: number;
    totalConsistencyChecks: number;
    totalDataVolume: number;
    totalErrors: number;
    totalWarnings: number;
    averageProcessingTime: Record<string, number>;
  } {
    let totalValidations = 0;
    let totalConsistencyChecks = 0;
    let totalDataVolume = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const results of Array.from(this.validationResults.values())) {
      totalValidations += results.length;
    }

    for (const results of Array.from(this.consistencyResults.values())) {
      totalConsistencyChecks += results.length;
    }

    for (const volume of Array.from(this.dataVolume.values())) {
      totalDataVolume += volume;
    }

    for (const errorCount of Array.from(this.errorCounts.values())) {
      totalErrors += errorCount;
    }

    for (const warningCount of Array.from(this.warningCounts.values())) {
      totalWarnings += warningCount;
    }

    const averageProcessingTime: Record<string, number> = {};
    for (const [operation, times] of Array.from(this.processingTimes.entries())) {
      averageProcessingTime[operation] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return {
      totalValidations,
      totalConsistencyChecks,
      totalDataVolume,
      totalErrors,
      totalWarnings,
      averageProcessingTime,
    };
  }

  /**
   * 期間内のデータを取得
   */
  getDataSince(since: Date): {
    validationResults: Map<string, ValidationResult[]>;
    consistencyResults: Map<string, ConsistencyResult[]>;
  } {
    const sinceTime = since.getTime();
    const filteredValidation = new Map<string, ValidationResult[]>();
    const filteredConsistency = new Map<string, ConsistencyResult[]>();

    for (const [key, results] of Array.from(this.validationResults.entries())) {
      const filtered = results.filter(result => 
        (result as any).timestamp >= sinceTime
      );
      if (filtered.length > 0) {
        filteredValidation.set(key, filtered);
      }
    }

    for (const [key, results] of Array.from(this.consistencyResults.entries())) {
      const filtered = results.filter(result => 
        (result as any).timestamp >= sinceTime
      );
      if (filtered.length > 0) {
        filteredConsistency.set(key, filtered);
      }
    }

    return {
      validationResults: filteredValidation,
      consistencyResults: filteredConsistency,
    };
  }

  /**
   * メトリクスのクリア
   */
  clear(): void {
    this.validationResults.clear();
    this.consistencyResults.clear();
    this.dataVolume.clear();
    this.errorCounts.clear();
    this.warningCounts.clear();
    this.processingTimes.clear();
  }
}

/**
 * データ品質管理のメインクラス
 */
export class QualityManager {
  private validator: DataValidator;
  private consistencyChecker: ConsistencyChecker;
  private metricsCollector: QualityMetricsCollector;
  private config: QualityConfig;
  private qualityHistory: QualityAssessment[] = [];

  constructor(
    validator: DataValidator,
    consistencyChecker: ConsistencyChecker,
    config: QualityConfig = DEFAULT_QUALITY_CONFIG
  ) {
    this.validator = validator;
    this.consistencyChecker = consistencyChecker;
    this.metricsCollector = new QualityMetricsCollector();
    this.config = config;
  }

  /**
   * データ品質の評価
   */
  async assessDataQuality(data: any[], type: DataType): Promise<QualityAssessment> {
    const startTime = performance.now();
    
    try {
      // Collect validation results
      const validationResults: ValidationResult[] = [];
      for (const item of data) {
        let result: ValidationResult;
        switch (type) {
          case 'position':
            result = await this.validator.validatePositionData(item);
            break;
          case 'account':
            result = await this.validator.validateAccountData(item);
            break;
          case 'market':
            result = await this.validator.validateMarketData(item);
            break;
          default:
            continue;
        }
        validationResults.push(result);
        this.metricsCollector.recordValidationResult(type, result);
      }

      // Calculate quality dimensions
      const dimensions = this.calculateQualityDimensions(data, validationResults, type);
      
      // Identify quality issues
      const issues = this.identifyQualityIssues(data, validationResults);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(dimensions);
      
      // Analyze trends
      const trend = this.analyzeQualityTrend(type);
      
      // Generate improvements
      const improvements = this.suggestImprovements(dimensions, issues);
      
      // Create metadata
      const metadata: QualityMetadata = {
        assessmentTime: new Date(),
        dataVolume: data.length,
        timeRange: {
          start: new Date(Date.now() - 60000), // Last minute
          end: new Date(),
        },
        dataTypes: [type],
      };

      const assessment: QualityAssessment = {
        overallScore,
        dimensions,
        issues,
        improvements,
        trend,
        metadata,
      };

      // Store in history
      this.qualityHistory.push(assessment);
      if (this.qualityHistory.length > 100) {
        this.qualityHistory.splice(0, this.qualityHistory.length - 100);
      }

      // Record processing time
      this.metricsCollector.recordProcessingTime('quality_assessment', performance.now() - startTime);
      this.metricsCollector.recordDataVolume(type, data.length);

      return assessment;
    } catch (error) {
      throw new Error(`Quality assessment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 品質レポートの生成
   */
  async generateQualityReport(): Promise<QualityReport> {
    const reportStartTime = new Date(Date.now() - (this.config.reportingInterval * 60 * 1000));
    const metricsData = this.metricsCollector.getDataSince(reportStartTime);
    
    // Generate summary assessment
    const allData: any[] = []; // In real implementation, this would come from data store
    const summary = await this.assessDataQuality(allData, 'position'); // Example

    // Generate detailed analysis
    const detailedAnalysis = this.generateDetailedAnalysis(metricsData);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, detailedAnalysis);
    
    // Generate action items
    const actionItems = this.generateActionItems(summary.issues);

    return {
      summary,
      detailedAnalysis,
      recommendations,
      actionItems,
      generatedAt: new Date(),
    };
  }

  /**
   * データクリーニング
   */
  async cleanData(data: any[], type: DataType): Promise<DataCleaningResult> {
    const originalCount = data.length;
    let cleanedData = [...data];
    const cleaningRules: CleaningRule[] = [];
    const issues: DataCleaningIssue[] = [];
    let removedCount = 0;
    let correctedCount = 0;

    // Rule 1: Remove null/undefined values
    const nullRule: CleaningRule = {
      type: 'remove',
      condition: 'null or undefined values',
      action: 'remove items with null/undefined critical fields',
      applied: 0,
    };

    cleanedData = cleanedData.filter(item => {
      if (!item || typeof item !== 'object') {
        nullRule.applied++;
        removedCount++;
        return false;
      }
      return true;
    });
    cleaningRules.push(nullRule);

    // Rule 2: Correct obvious data type issues
    const typeRule: CleaningRule = {
      type: 'correct',
      condition: 'incorrect data types',
      action: 'convert string numbers to numbers',
      applied: 0,
    };

    cleanedData = cleanedData.map(item => {
      const corrected = { ...item };
      let hasCorrection = false;

      // Example: Convert string numbers to numbers
      for (const [key, value] of Object.entries(corrected)) {
        if (typeof value === 'string' && !isNaN(Number(value)) && key !== 'positionId') {
          corrected[key] = Number(value);
          hasCorrection = true;
        }
      }

      if (hasCorrection) {
        typeRule.applied++;
        correctedCount++;
      }

      return corrected;
    });
    cleaningRules.push(typeRule);

    // Rule 3: Remove statistical outliers
    if (type === 'position') {
      const outlierRule: CleaningRule = {
        type: 'flag',
        condition: 'statistical outliers',
        action: 'flag extreme values for review',
        applied: 0,
      };

      const profits = cleanedData
        .filter(item => typeof item.profit === 'number')
        .map(item => item.profit);
      
      if (profits.length > 10) {
        const mean = profits.reduce((sum, p) => sum + p, 0) / profits.length;
        const variance = profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / profits.length;
        const stdDev = Math.sqrt(variance);
        const threshold = 3; // 3 standard deviations

        cleanedData = cleanedData.filter(item => {
          if (typeof item.profit === 'number') {
            const zScore = Math.abs((item.profit - mean) / stdDev);
            if (zScore > threshold) {
              outlierRule.applied++;
              removedCount++;
              return false;
            }
          }
          return true;
        });
      }
      cleaningRules.push(outlierRule);
    }

    // Identify potential issues
    if (removedCount > originalCount * 0.1) { // More than 10% removed
      issues.push({
        type: 'data_loss',
        description: `High data removal rate: ${((removedCount / originalCount) * 100).toFixed(1)}%`,
        impact: 'Potential loss of important data',
        recommendation: 'Review data collection and validation processes',
      });
    }

    if (correctedCount > originalCount * 0.2) { // More than 20% corrected
      issues.push({
        type: 'correction_uncertainty',
        description: `High correction rate: ${((correctedCount / originalCount) * 100).toFixed(1)}%`,
        impact: 'Data quality may be systematically poor',
        recommendation: 'Investigate data source quality',
      });
    }

    return {
      originalCount,
      cleanedCount: cleanedData.length,
      removedCount,
      correctedCount,
      cleaningRules,
      processedData: cleanedData,
      issues,
    };
  }

  /**
   * 品質トレンドの監視
   */
  monitorQualityTrends(): QualityTrend[] {
    const trends: QualityTrend[] = [];
    const dataTypes: DataType[] = ['position', 'account', 'market', 'losscut', 'heartbeat'];

    for (const dataType of dataTypes) {
      const trend = this.analyzeQualityTrend(dataType);
      trends.push(trend);
    }

    return trends;
  }

  /**
   * 品質次元の計算
   */
  private calculateQualityDimensions(
    data: any[],
    validationResults: ValidationResult[],
    type: DataType
  ): QualityDimensions {
    // Completeness: Percentage of non-null fields
    const completeness = this.assessCompleteness(data);
    
    // Accuracy: Percentage of validation-passed items
    const accuracy = validationResults.length > 0 
      ? (validationResults.filter(r => r.valid).length / validationResults.length) * 100
      : 100;
    
    // Consistency: Based on validation scores
    const consistency = validationResults.length > 0
      ? validationResults.reduce((sum, r) => sum + r.score, 0) / validationResults.length
      : 100;
    
    // Timeliness: Based on data freshness (simplified)
    const timeliness = this.assessTimeliness(data);
    
    // Validity: Based on business rule compliance
    const validity = this.assessValidity(data, type);
    
    // Reliability: Based on historical performance
    const reliability = this.assessReliability(type);

    return {
      completeness,
      accuracy,
      consistency,
      timeliness,
      validity,
      reliability,
    };
  }

  /**
   * データ完全性の評価
   */
  private assessCompleteness(data: any[]): number {
    if (data.length === 0) return 100;

    let totalFields = 0;
    let missingFields = 0;

    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        for (const [key, value] of Object.entries(item)) {
          totalFields++;
          if (value === null || value === undefined || value === '') {
            missingFields++;
          }
        }
      }
    }

    return totalFields === 0 ? 100 : ((totalFields - missingFields) / totalFields) * 100;
  }

  /**
   * データ適時性の評価
   */
  private assessTimeliness(data: any[]): number {
    if (data.length === 0) return 100;

    const now = Date.now();
    const maxAge = 60000; // 1 minute
    let timelyCount = 0;

    for (const item of data) {
      // Try to find timestamp field
      const timestamp = item.timestamp || item.lastUpdated || item.openTime;
      if (timestamp) {
        const age = now - new Date(timestamp).getTime();
        if (age <= maxAge) {
          timelyCount++;
        }
      } else {
        // If no timestamp, assume timely
        timelyCount++;
      }
    }

    return (timelyCount / data.length) * 100;
  }

  /**
   * データ妥当性の評価
   */
  private assessValidity(data: any[], type: DataType): number {
    if (data.length === 0) return 100;

    let validCount = 0;

    for (const item of data) {
      let isValid = true;

      switch (type) {
        case 'position':
          isValid = this.validatePositionBusinessRules(item);
          break;
        case 'account':
          isValid = this.validateAccountBusinessRules(item);
          break;
        case 'market':
          isValid = this.validateMarketBusinessRules(item);
          break;
        default:
          isValid = true; // Default to valid for unknown types
      }

      if (isValid) {
        validCount++;
      }
    }

    return (validCount / data.length) * 100;
  }

  /**
   * データ信頼性の評価
   */
  private assessReliability(type: DataType): number {
    // Based on recent quality history
    const recentAssessments = this.qualityHistory
      .filter(assessment => 
        assessment.metadata.dataTypes.includes(type) &&
        assessment.metadata.assessmentTime.getTime() > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      )
      .slice(-10); // Last 10 assessments

    if (recentAssessments.length === 0) return 80; // Default reliability

    const averageScore = recentAssessments.reduce((sum, assessment) => sum + assessment.overallScore, 0) / recentAssessments.length;
    return averageScore;
  }

  /**
   * ポジションビジネスルールの検証
   */
  private validatePositionBusinessRules(item: any): boolean {
    return (
      typeof item.lots === 'number' && item.lots > 0 && item.lots <= 100 &&
      typeof item.openPrice === 'number' && item.openPrice > 0 &&
      typeof item.currentPrice === 'number' && item.currentPrice > 0 &&
      ['buy', 'sell'].includes(item.type) &&
      ['open', 'closed', 'pending'].includes(item.status)
    );
  }

  /**
   * アカウントビジネスルールの検証
   */
  private validateAccountBusinessRules(item: any): boolean {
    return (
      typeof item.balance === 'number' && item.balance >= 0 &&
      typeof item.equity === 'number' && item.equity >= 0 &&
      typeof item.marginLevel === 'number' && item.marginLevel >= 0 &&
      typeof item.bonusAmount === 'number' && item.bonusAmount >= 0
    );
  }

  /**
   * 市場データビジネスルールの検証
   */
  private validateMarketBusinessRules(item: any): boolean {
    return (
      typeof item.bid === 'number' && item.bid > 0 &&
      typeof item.ask === 'number' && item.ask > 0 &&
      item.bid < item.ask &&
      typeof item.spread === 'number' && item.spread >= 0
    );
  }

  /**
   * 品質課題の特定
   */
  private identifyQualityIssues(data: any[], validationResults: ValidationResult[]): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // High error rate
    const errorCount = validationResults.reduce((sum, r) => sum + r.errors.length, 0);
    if (errorCount > data.length * 0.1) { // More than 10% error rate
      issues.push({
        dimension: 'accuracy',
        severity: 'high',
        count: errorCount,
        examples: validationResults.filter(r => r.errors.length > 0).slice(0, 3),
        impact: 'High error rate affecting data reliability',
        category: 'validation_errors',
        trend: 'degrading',
      });
    }

    // High warning rate
    const warningCount = validationResults.reduce((sum, r) => sum + r.warnings.length, 0);
    if (warningCount > data.length * 0.2) { // More than 20% warning rate
      issues.push({
        dimension: 'consistency',
        severity: 'medium',
        count: warningCount,
        examples: validationResults.filter(r => r.warnings.length > 0).slice(0, 3),
        impact: 'High warning rate indicating potential issues',
        category: 'validation_warnings',
        trend: 'stable',
      });
    }

    return issues;
  }

  /**
   * 品質トレンドの分析
   */
  private analyzeQualityTrend(type: DataType): QualityTrend {
    const recentAssessments = this.qualityHistory
      .filter(assessment => assessment.metadata.dataTypes.includes(type))
      .slice(-5); // Last 5 assessments

    if (recentAssessments.length < 2) {
      return {
        direction: 'stable',
        rate: 0,
        confidence: 50,
        timeWindow: this.config.reportingInterval,
      };
    }

    const first = recentAssessments[0].overallScore;
    const last = recentAssessments[recentAssessments.length - 1].overallScore;
    const change = last - first;
    const timeSpan = recentAssessments[recentAssessments.length - 1].metadata.assessmentTime.getTime() - 
                   recentAssessments[0].metadata.assessmentTime.getTime();

    const rate = change / (timeSpan / (60 * 60 * 1000)); // Change per hour
    const direction = Math.abs(rate) < 0.5 ? 'stable' : (rate > 0 ? 'improving' : 'degrading');
    const confidence = Math.min(95, Math.max(50, 60 + (recentAssessments.length * 8)));

    return {
      direction,
      rate,
      confidence,
      timeWindow: Math.round(timeSpan / (60 * 1000)), // in minutes
    };
  }

  /**
   * 改善提案の生成
   */
  private suggestImprovements(dimensions: QualityDimensions, issues: QualityIssue[]): string[] {
    const improvements: string[] = [];

    if (dimensions.completeness < QUALITY_THRESHOLDS.GOOD) {
      improvements.push('Improve data collection to reduce missing values');
    }

    if (dimensions.accuracy < QUALITY_THRESHOLDS.GOOD) {
      improvements.push('Enhance validation rules to catch more errors');
    }

    if (dimensions.consistency < QUALITY_THRESHOLDS.GOOD) {
      improvements.push('Implement stronger consistency checks');
    }

    if (dimensions.timeliness < QUALITY_THRESHOLDS.GOOD) {
      improvements.push('Optimize data processing to reduce latency');
    }

    if (dimensions.validity < QUALITY_THRESHOLDS.GOOD) {
      improvements.push('Review and update business rule validations');
    }

    if (dimensions.reliability < QUALITY_THRESHOLDS.GOOD) {
      improvements.push('Implement data source monitoring and alerting');
    }

    // Issue-specific improvements
    for (const issue of issues) {
      if (issue.severity === 'high' || issue.severity === 'critical') {
        improvements.push(`Address ${issue.category}: ${issue.impact}`);
      }
    }

    return improvements;
  }

  /**
   * 総合スコアの計算
   */
  private calculateOverallScore(dimensions: QualityDimensions): number {
    const weights = this.config.dimensionWeights;
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    return (
      (dimensions.completeness * weights.completeness +
       dimensions.accuracy * weights.accuracy +
       dimensions.consistency * weights.consistency +
       dimensions.timeliness * weights.timeliness +
       dimensions.validity * weights.validity +
       dimensions.reliability * weights.reliability) / totalWeight
    );
  }

  /**
   * 詳細分析の生成
   */
  private generateDetailedAnalysis(metricsData: any): DetailedQualityAnalysis {
    // Simplified implementation
    const byDataType: Record<DataType, QualityAssessment> = {} as any;
    const byTimeSlice: TimeSliceAnalysis[] = [];
    const patterns: QualityPattern[] = [];
    const anomalies: QualityAnomaly[] = [];

    return {
      byDataType,
      byTimeSlice,
      patterns,
      anomalies,
    };
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(summary: QualityAssessment, analysis: DetailedQualityAnalysis): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    if (summary.overallScore < QUALITY_THRESHOLDS.GOOD) {
      recommendations.push({
        priority: 'high',
        category: 'validation',
        title: 'Improve Overall Data Quality',
        description: 'Focus on addressing the most critical quality issues identified',
        expectedImpact: 'Significant improvement in data reliability',
        effort: 'medium',
        timeline: '2-4 weeks',
      });
    }

    return recommendations;
  }

  /**
   * アクションアイテムの生成
   */
  private generateActionItems(issues: QualityIssue[]): QualityActionItem[] {
    const actionItems: QualityActionItem[] = [];

    for (const issue of issues) {
      if (issue.severity === 'high' || issue.severity === 'critical') {
        actionItems.push({
          id: `quality_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: `Fix ${issue.category}`,
          description: issue.impact,
          priority: issue.severity === 'critical' ? 'urgent' : 'high',
          status: 'pending',
          relatedIssues: [issue.dimension],
          dueDate: new Date(Date.now() + (issue.severity === 'critical' ? 24 : 72) * 60 * 60 * 1000),
        });
      }
    }

    return actionItems;
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<QualityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * メトリクス収集機能へのアクセス
   */
  getMetricsCollector(): QualityMetricsCollector {
    return this.metricsCollector;
  }

  /**
   * 品質履歴の取得
   */
  getQualityHistory(): QualityAssessment[] {
    return [...this.qualityHistory];
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): QualityConfig {
    return { ...this.config };
  }
}
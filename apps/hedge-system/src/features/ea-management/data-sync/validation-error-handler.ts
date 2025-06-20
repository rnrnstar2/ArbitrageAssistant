import { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  ValidationContext 
} from './types';
import { 
  EAErrorHandler, 
  ErrorHandlerConfig 
} from '../error-handling/error-handler';
import { 
  ErrorDetail, 
  EAErrorContext,
  ERROR_CODES 
} from '../error-handling/error-types';

/**
 * バリデーションエラーをエラーハンドラーに橋渡しするクラス
 */
export class ValidationErrorHandler {
  private errorHandler: EAErrorHandler;

  constructor(errorHandler: EAErrorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * バリデーション結果をエラーハンドラーに報告
   */
  async handleValidationResult(
    result: ValidationResult,
    context: ValidationContext,
    originalData: any
  ): Promise<string[]> {
    const errorIds: string[] = [];

    // エラーを処理
    for (const error of result.errors) {
      const errorId = await this.handleValidationError(error, context, originalData);
      errorIds.push(errorId);
    }

    // 警告を処理
    for (const warning of result.warnings) {
      await this.handleValidationWarning(warning, context, originalData);
    }

    return errorIds;
  }

  /**
   * バリデーションエラーをエラーハンドラーに報告
   */
  private async handleValidationError(
    validationError: ValidationError,
    context: ValidationContext,
    originalData: any
  ): Promise<string> {
    const errorContext: EAErrorContext = {
      accountId: context.accountId,
      timestamp: context.timestamp,
      sessionId: context.sequenceNumber?.toString(),
    };

    const errorCode = this.mapValidationErrorCode(validationError.code);
    const severity = this.mapValidationSeverity(validationError.severity);
    const category = 'validation' as const;

    const metadata = {
      validationField: validationError.field,
      validationCode: validationError.code,
      receivedValue: validationError.receivedValue,
      expectedType: validationError.expectedType,
      expectedRange: validationError.expectedRange,
      messageType: context.messageType,
      originalData: this.sanitizeDataForLogging(originalData),
    };

    return this.errorHandler.handleError(
      errorCode,
      validationError.message,
      errorContext,
      severity,
      category,
      metadata
    );
  }

  /**
   * バリデーション警告をログに記録
   */
  private async handleValidationWarning(
    warning: ValidationWarning,
    context: ValidationContext,
    originalData: any
  ): Promise<void> {
    const metadata = {
      validationField: warning.field,
      validationCode: warning.code,
      receivedValue: warning.receivedValue,
      suggestedValue: warning.suggestedValue,
      messageType: context.messageType,
      accountId: context.accountId,
    };

    console.warn(`[ValidationWarning] ${warning.message}`, metadata);
  }

  /**
   * バリデーションエラーコードをシステムエラーコードにマッピング
   */
  private mapValidationErrorCode(validationCode: string): string {
    const codeMapping: Record<string, string> = {
      'VALIDATION_REQUIRED_FIELD_MISSING': ERROR_CODES.VALIDATION_REQUIRED_FIELD_MISSING,
      'VALIDATION_INVALID_TYPE': ERROR_CODES.VALIDATION_INVALID_TYPE,
      'VALIDATION_VALUE_OUT_OF_RANGE': ERROR_CODES.VALIDATION_VALUE_OUT_OF_RANGE,
      'VALIDATION_INVALID_FORMAT': ERROR_CODES.VALIDATION_INVALID_FORMAT,
      'VALIDATION_INVALID_CURRENCY_PAIR': ERROR_CODES.VALIDATION_INVALID_CURRENCY_PAIR,
      'VALIDATION_INVALID_TIMESTAMP': ERROR_CODES.VALIDATION_INVALID_TIMESTAMP,
      'VALIDATION_NEGATIVE_VALUE': ERROR_CODES.VALIDATION_NEGATIVE_VALUE,
      'VALIDATION_ZERO_VOLUME': ERROR_CODES.VALIDATION_ZERO_VOLUME,
      'VALIDATION_INVALID_TICKET': ERROR_CODES.VALIDATION_INVALID_TICKET,
      'VALIDATION_CORRUPTED_DATA': ERROR_CODES.VALIDATION_CORRUPTED_DATA,
    };

    return codeMapping[validationCode] || ERROR_CODES.DATA_VALIDATION_FAILED;
  }

  /**
   * バリデーション重要度をシステム重要度にマッピング
   */
  private mapValidationSeverity(validationSeverity: 'error' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    switch (validationSeverity) {
      case 'critical':
        return 'critical';
      case 'error':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * ログ記録用にデータをサニタイズ（機密情報を除去）
   */
  private sanitizeDataForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized: any = Array.isArray(data) ? [] : {};
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    for (const [key, value] of Object.entries(data)) {
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDataForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * バリデーションエラー統計を取得
   */
  getValidationErrorStats(timeRangeHours: number = 24): ValidationErrorStats {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - timeRangeHours);

    const stats = this.errorHandler.getStatistics();
    const validationErrors = stats.recentErrors.filter(error =>
      error.category === 'validation' && error.context.timestamp >= cutoffDate
    );

    const errorsByField: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};
    const errorsByAccount: Record<string, number> = {};

    for (const error of validationErrors) {
      const field = error.metadata?.validationField || 'unknown';
      const code = error.metadata?.validationCode || error.code;
      const accountId = error.context.accountId;

      errorsByField[field] = (errorsByField[field] || 0) + 1;
      errorsByCode[code] = (errorsByCode[code] || 0) + 1;
      errorsByAccount[accountId] = (errorsByAccount[accountId] || 0) + 1;
    }

    return {
      totalValidationErrors: validationErrors.length,
      timeRangeHours,
      errorsByField,
      errorsByCode,
      errorsByAccount,
      mostCommonError: this.getMostCommon(errorsByCode),
      mostProblematicField: this.getMostCommon(errorsByField),
      mostProblematicAccount: this.getMostCommon(errorsByAccount),
    };
  }

  private getMostCommon(counts: Record<string, number>): { key: string; count: number } | null {
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;

    const [key, count] = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );

    return { key, count };
  }

  /**
   * 特定のフィールドのバリデーションエラーレポート
   */
  getFieldValidationReport(fieldName: string, timeRangeHours: number = 24): FieldValidationReport {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - timeRangeHours);

    const stats = this.errorHandler.getStatistics();
    const fieldErrors = stats.recentErrors.filter(error =>
      error.category === 'validation' && 
      error.metadata?.validationField === fieldName &&
      error.context.timestamp >= cutoffDate
    );

    const errorTypes: Record<string, number> = {};
    const sampleValues: any[] = [];

    for (const error of fieldErrors) {
      const errorType = error.metadata?.validationCode || error.code;
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      
      if (sampleValues.length < 10 && error.metadata?.receivedValue !== undefined) {
        sampleValues.push(error.metadata.receivedValue);
      }
    }

    return {
      fieldName,
      totalErrors: fieldErrors.length,
      timeRangeHours,
      errorTypes,
      sampleInvalidValues: sampleValues,
      recommendations: this.generateFieldRecommendations(fieldName, errorTypes),
    };
  }

  private generateFieldRecommendations(fieldName: string, errorTypes: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (errorTypes.VALIDATION_REQUIRED_FIELD_MISSING) {
      recommendations.push(`${fieldName}フィールドが必須であることをEA側に確認してください`);
    }

    if (errorTypes.VALIDATION_INVALID_TYPE) {
      recommendations.push(`${fieldName}フィールドのデータ型を確認してください`);
    }

    if (errorTypes.VALIDATION_VALUE_OUT_OF_RANGE) {
      recommendations.push(`${fieldName}フィールドの値の範囲を確認してください`);
    }

    if (errorTypes.VALIDATION_INVALID_FORMAT) {
      recommendations.push(`${fieldName}フィールドのフォーマットを確認してください`);
    }

    return recommendations;
  }
}

/**
 * バリデーションエラー統計
 */
export interface ValidationErrorStats {
  totalValidationErrors: number;
  timeRangeHours: number;
  errorsByField: Record<string, number>;
  errorsByCode: Record<string, number>;
  errorsByAccount: Record<string, number>;
  mostCommonError: { key: string; count: number } | null;
  mostProblematicField: { key: string; count: number } | null;
  mostProblematicAccount: { key: string; count: number } | null;
}

/**
 * フィールド別バリデーションレポート
 */
export interface FieldValidationReport {
  fieldName: string;
  totalErrors: number;
  timeRangeHours: number;
  errorTypes: Record<string, number>;
  sampleInvalidValues: any[];
  recommendations: string[];
}

/**
 * 統合バリデーションサービス
 */
export class IntegratedValidationService {
  private validationErrorHandler: ValidationErrorHandler;

  constructor(errorHandler: EAErrorHandler) {
    this.validationErrorHandler = new ValidationErrorHandler(errorHandler);
  }

  /**
   * バリデーションとエラーハンドリングを統合実行
   */
  async validateAndHandleErrors(
    data: any,
    context: ValidationContext,
    validator: any
  ): Promise<{ isValid: boolean; errorIds: string[]; result: ValidationResult }> {
    try {
      // バリデーション実行
      const result = await validator.validateEAMessage(data, context);

      // エラーハンドリング
      const errorIds = await this.validationErrorHandler.handleValidationResult(
        result,
        context,
        data
      );

      return {
        isValid: result.isValid,
        errorIds,
        result
      };

    } catch (error) {
      // バリデーション処理自体がエラーになった場合
      const errorContext: EAErrorContext = {
        accountId: context.accountId,
        timestamp: context.timestamp,
      };

      const errorId = await this.validationErrorHandler['errorHandler'].handleError(
        ERROR_CODES.DATA_VALIDATION_FAILED,
        `バリデーション処理でエラーが発生しました: ${error}`,
        errorContext,
        'critical',
        'validation',
        { originalData: data, validationError: error }
      );

      return {
        isValid: false,
        errorIds: [errorId],
        result: {
          isValid: false,
          errors: [{
            field: 'validation',
            code: 'VALIDATION_PROCESS_FAILED',
            message: `バリデーション処理でエラーが発生しました: ${error}`,
            severity: 'critical'
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * バリデーション統計を取得
   */
  getValidationStats(timeRangeHours: number = 24): ValidationErrorStats {
    return this.validationErrorHandler.getValidationErrorStats(timeRangeHours);
  }

  /**
   * フィールド別レポートを取得
   */
  getFieldReport(fieldName: string, timeRangeHours: number = 24): FieldValidationReport {
    return this.validationErrorHandler.getFieldValidationReport(fieldName, timeRangeHours);
  }
}
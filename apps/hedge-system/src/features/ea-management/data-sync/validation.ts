import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationRule,
  EADataValidationSchema,
  ValidationContext,
  DataSanitizer,
  TransformRule,
} from './types';
import {
  Position,
  Account,
  EAMessage,
  PositionUpdateData,
  AccountUpdateData,
  HeartbeatData,
  CommandResponse,
} from '../types';
import { ERROR_CODES } from '../error-handling/error-types';

// バリデーションエラーコード
export const VALIDATION_ERROR_CODES = {
  REQUIRED_FIELD_MISSING: 'VALIDATION_REQUIRED_FIELD_MISSING',
  INVALID_TYPE: 'VALIDATION_INVALID_TYPE',
  VALUE_OUT_OF_RANGE: 'VALIDATION_VALUE_OUT_OF_RANGE',
  INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  INVALID_CURRENCY_PAIR: 'VALIDATION_INVALID_CURRENCY_PAIR',
  INVALID_TIMESTAMP: 'VALIDATION_INVALID_TIMESTAMP',
  NEGATIVE_VALUE: 'VALIDATION_NEGATIVE_VALUE',
  ZERO_VOLUME: 'VALIDATION_ZERO_VOLUME',
  INVALID_TICKET: 'VALIDATION_INVALID_TICKET',
  CORRUPTED_DATA: 'VALIDATION_CORRUPTED_DATA',
} as const;

// 通貨ペアのバリデーション正規表現
const CURRENCY_PAIR_REGEX = /^[A-Z]{6}$/;
const SYMBOL_REGEX = /^[A-Z]{6}([.][A-Z]+)?$/;

// バリデーションスキーマ定義
export const VALIDATION_SCHEMAS: Record<string, EADataValidationSchema> = {
  position: {
    entity: 'position',
    strictMode: false,
    rules: [
      { field: 'ticket', type: 'required', constraint: null, message: 'チケット番号は必須です', severity: 'critical' },
      { field: 'ticket', type: 'type', constraint: 'number', message: 'チケット番号は数値である必要があります', severity: 'critical' },
      { field: 'ticket', type: 'range', constraint: { min: 1 }, message: 'チケット番号は正の整数である必要があります', severity: 'critical' },
      
      { field: 'symbol', type: 'required', constraint: null, message: '通貨ペアは必須です', severity: 'critical' },
      { field: 'symbol', type: 'type', constraint: 'string', message: '通貨ペアは文字列である必要があります', severity: 'error' },
      { field: 'symbol', type: 'format', constraint: SYMBOL_REGEX, message: '無効な通貨ペア形式です', severity: 'error' },
      
      { field: 'type', type: 'required', constraint: null, message: 'ポジションタイプは必須です', severity: 'critical' },
      { field: 'type', type: 'format', constraint: /^(buy|sell)$/, message: 'ポジションタイプはbuyまたはsellである必要があります', severity: 'critical' },
      
      { field: 'volume', type: 'required', constraint: null, message: 'ボリュームは必須です', severity: 'critical' },
      { field: 'volume', type: 'type', constraint: 'number', message: 'ボリュームは数値である必要があります', severity: 'critical' },
      { field: 'volume', type: 'range', constraint: { min: 0.01, max: 1000 }, message: 'ボリュームは0.01から1000の範囲である必要があります', severity: 'error' },
      
      { field: 'openPrice', type: 'required', constraint: null, message: 'オープン価格は必須です', severity: 'critical' },
      { field: 'openPrice', type: 'type', constraint: 'number', message: 'オープン価格は数値である必要があります', severity: 'critical' },
      { field: 'openPrice', type: 'range', constraint: { min: 0.00001 }, message: 'オープン価格は正の値である必要があります', severity: 'critical' },
      
      { field: 'currentPrice', type: 'required', constraint: null, message: '現在価格は必須です', severity: 'critical' },
      { field: 'currentPrice', type: 'type', constraint: 'number', message: '現在価格は数値である必要があります', severity: 'critical' },
      { field: 'currentPrice', type: 'range', constraint: { min: 0.00001 }, message: '現在価格は正の値である必要があります', severity: 'critical' },
      
      { field: 'profit', type: 'type', constraint: 'number', message: '利益は数値である必要があります', severity: 'error' },
      { field: 'swap', type: 'type', constraint: 'number', message: 'スワップは数値である必要があります', severity: 'warning' },
      { field: 'openTime', type: 'type', constraint: 'date', message: 'オープン時刻は有効な日付である必要があります', severity: 'error' },
    ]
  },
  
  account: {
    entity: 'account',
    strictMode: false,
    rules: [
      { field: 'accountId', type: 'required', constraint: null, message: 'アカウントIDは必須です', severity: 'critical' },
      { field: 'balance', type: 'required', constraint: null, message: '残高は必須です', severity: 'critical' },
      { field: 'balance', type: 'type', constraint: 'number', message: '残高は数値である必要があります', severity: 'critical' },
      { field: 'balance', type: 'range', constraint: { min: 0 }, message: '残高は負の値になることはできません', severity: 'warning' },
      
      { field: 'equity', type: 'required', constraint: null, message: '有効証拠金は必須です', severity: 'critical' },
      { field: 'equity', type: 'type', constraint: 'number', message: '有効証拠金は数値である必要があります', severity: 'critical' },
      
      { field: 'margin', type: 'type', constraint: 'number', message: 'マージンは数値である必要があります', severity: 'error' },
      { field: 'marginLevel', type: 'type', constraint: 'number', message: 'マージンレベルは数値である必要があります', severity: 'error' },
      { field: 'marginLevel', type: 'range', constraint: { min: 0, max: 100000 }, message: 'マージンレベルが異常な値です', severity: 'warning' },
      
      { field: 'currency', type: 'required', constraint: null, message: '通貨は必須です', severity: 'error' },
      { field: 'currency', type: 'format', constraint: /^[A-Z]{3}$/, message: '通貨コードは3文字のISO形式である必要があります', severity: 'error' },
      
      { field: 'leverage', type: 'type', constraint: 'number', message: 'レバレッジは数値である必要があります', severity: 'error' },
      { field: 'leverage', type: 'range', constraint: { min: 1, max: 3000 }, message: 'レバレッジが異常な値です', severity: 'warning' },
    ]
  },
  
  heartbeat: {
    entity: 'heartbeat',
    strictMode: true,
    rules: [
      { field: 'type', type: 'required', constraint: null, message: 'メッセージタイプは必須です', severity: 'critical' },
      { field: 'accountId', type: 'required', constraint: null, message: 'アカウントIDは必須です', severity: 'critical' },
      { field: 'timestamp', type: 'required', constraint: null, message: 'タイムスタンプは必須です', severity: 'critical' },
      { field: 'timestamp', type: 'type', constraint: 'number', message: 'タイムスタンプは数値である必要があります', severity: 'critical' },
      { field: 'status', type: 'format', constraint: /^online$/, message: 'ハートビートのステータスはonlineである必要があります', severity: 'critical' },
    ]
  },
};

/**
 * メインバリデーション関数
 */
export class EADataValidator {
  private schemas: Record<string, EADataValidationSchema>;
  private sanitizer: DataSanitizer;

  constructor(customSchemas?: Record<string, EADataValidationSchema>) {
    this.schemas = { ...VALIDATION_SCHEMAS, ...customSchemas };
    this.sanitizer = new DefaultDataSanitizer();
  }

  /**
   * EAメッセージをバリデーション
   */
  async validateEAMessage(message: EAMessage, context: ValidationContext): Promise<ValidationResult> {
    try {
      // データの前処理
      const sanitizedMessage = this.sanitizer.sanitize(message, context);
      
      // メッセージタイプに応じたバリデーション
      switch (sanitizedMessage.type) {
        case 'position_update':
          return this.validatePositionUpdate(sanitizedMessage as PositionUpdateData, context);
        case 'account_update':
          return this.validateAccountUpdate(sanitizedMessage as AccountUpdateData, context);
        case 'heartbeat':
          return this.validateHeartbeat(sanitizedMessage as HeartbeatData, context);
        case 'command_response':
          return this.validateCommandResponse(sanitizedMessage as CommandResponse, context);
        default:
          return {
            isValid: false,
            errors: [{ 
              field: 'type', 
              code: VALIDATION_ERROR_CODES.INVALID_TYPE, 
              message: `未知のメッセージタイプ: ${(message as any).type}`,
              severity: 'critical'
            }],
            warnings: []
          };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'message',
          code: VALIDATION_ERROR_CODES.CORRUPTED_DATA,
          message: `データ検証中にエラーが発生しました: ${error}`,
          severity: 'critical'
        }],
        warnings: []
      };
    }
  }

  /**
   * ポジション更新データのバリデーション
   */
  private async validatePositionUpdate(data: PositionUpdateData, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
    
    // 基本構造のバリデーション
    const basicResult = this.validateBasicStructure(data, context);
    result.errors.push(...basicResult.errors);
    result.warnings.push(...basicResult.warnings);
    
    // 各ポジションのバリデーション
    if (data.positions && Array.isArray(data.positions)) {
      for (let i = 0; i < data.positions.length; i++) {
        const positionResult = this.validatePosition(data.positions[i], i, context);
        result.errors.push(...positionResult.errors);
        result.warnings.push(...positionResult.warnings);
      }
    } else if (data.positions) {
      result.errors.push({
        field: 'positions',
        code: VALIDATION_ERROR_CODES.INVALID_TYPE,
        message: 'positions配列が無効です',
        severity: 'critical'
      });
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * 個別ポジションのバリデーション
   */
  private validatePosition(position: Position, index: number, context: ValidationContext): ValidationResult {
    const schema = this.schemas.position;
    return this.validateAgainstSchema(position, schema, `positions[${index}]`, context);
  }

  /**
   * アカウント更新データのバリデーション
   */
  private async validateAccountUpdate(data: AccountUpdateData, context: ValidationContext): Promise<ValidationResult> {
    const schema = this.schemas.account;
    return this.validateAgainstSchema(data, schema, 'account', context);
  }

  /**
   * ハートビートデータのバリデーション
   */
  private async validateHeartbeat(data: HeartbeatData, context: ValidationContext): Promise<ValidationResult> {
    const schema = this.schemas.heartbeat;
    const result = this.validateAgainstSchema(data, schema, 'heartbeat', context);
    
    // タイムスタンプの新鮮度チェック
    const now = Date.now();
    const timestampAge = now - data.timestamp;
    
    if (timestampAge > 30000) { // 30秒以上古い
      result.warnings.push({
        field: 'timestamp',
        code: 'STALE_TIMESTAMP',
        message: 'ハートビートのタイムスタンプが古すぎます',
        receivedValue: data.timestamp,
        suggestedValue: now
      });
    }
    
    return result;
  }

  /**
   * コマンドレスポンスのバリデーション
   */
  private async validateCommandResponse(data: CommandResponse, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
    
    // 必須フィールドのチェック
    if (!data.commandId) {
      result.errors.push({
        field: 'commandId',
        code: VALIDATION_ERROR_CODES.REQUIRED_FIELD_MISSING,
        message: 'コマンドIDが必要です',
        severity: 'critical'
      });
    }
    
    if (!data.status || !['success', 'error'].includes(data.status)) {
      result.errors.push({
        field: 'status',
        code: VALIDATION_ERROR_CODES.INVALID_FORMAT,
        message: 'ステータスはsuccessまたはerrorである必要があります',
        severity: 'critical'
      });
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * スキーマに対するバリデーション
   */
  private validateAgainstSchema(
    data: any, 
    schema: EADataValidationSchema, 
    fieldPrefix: string,
    context: ValidationContext
  ): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
    
    for (const rule of schema.rules) {
      const fieldPath = fieldPrefix ? `${fieldPrefix}.${rule.field}` : rule.field;
      const value = this.getNestedValue(data, rule.field);
      
      const ruleResult = this.validateRule(value, rule, fieldPath, context);
      
      if (ruleResult.severity === 'error' || ruleResult.severity === 'critical') {
        if (ruleResult.violation) {
          result.errors.push({
            field: fieldPath,
            code: ruleResult.code,
            message: ruleResult.message,
            severity: ruleResult.severity,
            receivedValue: value,
            expectedType: rule.constraint
          });
        }
      } else if (ruleResult.severity === 'warning' && ruleResult.violation) {
        result.warnings.push({
          field: fieldPath,
          code: ruleResult.code,
          message: ruleResult.message,
          receivedValue: value
        });
      }
    }
    
    // 厳密モードでは警告もエラー扱い
    if (schema.strictMode && result.warnings.length > 0) {
      result.errors.push(...result.warnings.map(w => ({
        field: w.field,
        code: w.code,
        message: w.message,
        severity: 'error' as const,
        receivedValue: w.receivedValue
      })));
      result.warnings = [];
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * 基本構造のバリデーション
   */
  private validateBasicStructure(data: any, context: ValidationContext): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
    
    if (!data.accountId) {
      result.errors.push({
        field: 'accountId',
        code: VALIDATION_ERROR_CODES.REQUIRED_FIELD_MISSING,
        message: 'アカウントIDは必須です',
        severity: 'critical'
      });
    } else if (data.accountId !== context.accountId) {
      result.warnings.push({
        field: 'accountId',
        code: 'ACCOUNT_ID_MISMATCH',
        message: 'コンテキストのアカウントIDと一致しません',
        receivedValue: data.accountId,
        suggestedValue: context.accountId
      });
    }
    
    if (!data.timestamp || typeof data.timestamp !== 'number') {
      result.errors.push({
        field: 'timestamp',
        code: VALIDATION_ERROR_CODES.INVALID_TIMESTAMP,
        message: 'タイムスタンプは数値である必要があります',
        severity: 'critical',
        receivedValue: data.timestamp
      });
    }
    
    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * 個別ルールのバリデーション
   */
  private validateRule(value: any, rule: ValidationRule, fieldPath: string, context: ValidationContext) {
    switch (rule.type) {
      case 'required':
        return {
          violation: value === undefined || value === null || value === '',
          code: VALIDATION_ERROR_CODES.REQUIRED_FIELD_MISSING,
          message: rule.message,
          severity: rule.severity
        };
        
      case 'type':
        return this.validateType(value, rule.constraint, rule);
        
      case 'range':
        return this.validateRange(value, rule.constraint, rule);
        
      case 'format':
        return this.validateFormat(value, rule.constraint, rule);
        
      default:
        return {
          violation: false,
          code: '',
          message: '',
          severity: rule.severity
        };
    }
  }

  private validateType(value: any, expectedType: string, rule: ValidationRule) {
    let violation = false;
    
    switch (expectedType) {
      case 'string':
        violation = typeof value !== 'string';
        break;
      case 'number':
        violation = typeof value !== 'number' || isNaN(value);
        break;
      case 'date':
        violation = !(value instanceof Date) && (typeof value !== 'number' || isNaN(new Date(value).getTime()));
        break;
      case 'boolean':
        violation = typeof value !== 'boolean';
        break;
    }
    
    return {
      violation,
      code: VALIDATION_ERROR_CODES.INVALID_TYPE,
      message: rule.message,
      severity: rule.severity
    };
  }

  private validateRange(value: any, range: { min?: number; max?: number }, rule: ValidationRule) {
    let violation = false;
    
    if (typeof value === 'number') {
      if (range.min !== undefined && value < range.min) violation = true;
      if (range.max !== undefined && value > range.max) violation = true;
    }
    
    return {
      violation,
      code: VALIDATION_ERROR_CODES.VALUE_OUT_OF_RANGE,
      message: rule.message,
      severity: rule.severity
    };
  }

  private validateFormat(value: any, pattern: RegExp, rule: ValidationRule) {
    const violation = typeof value === 'string' && !pattern.test(value);
    
    return {
      violation,
      code: VALIDATION_ERROR_CODES.INVALID_FORMAT,
      message: rule.message,
      severity: rule.severity
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * カスタムスキーマを追加
   */
  addSchema(name: string, schema: EADataValidationSchema): void {
    this.schemas[name] = schema;
  }

  /**
   * スキーマを更新
   */
  updateSchema(name: string, updates: Partial<EADataValidationSchema>): void {
    if (this.schemas[name]) {
      this.schemas[name] = { ...this.schemas[name], ...updates };
    }
  }
}

/**
 * デフォルトデータサニタイザー
 */
class DefaultDataSanitizer implements DataSanitizer {
  sanitize(data: any, context: ValidationContext): any {
    // 基本的なデータクリーニング
    let sanitized = this.normalize(data);
    
    // 型変換ルール
    const transformRules: TransformRule[] = [
      { field: 'timestamp', transformer: 'number' },
      { field: 'volume', transformer: 'number' },
      { field: 'openPrice', transformer: 'number' },
      { field: 'currentPrice', transformer: 'number' },
      { field: 'profit', transformer: 'number' },
      { field: 'balance', transformer: 'number' },
      { field: 'equity', transformer: 'number' },
      { field: 'margin', transformer: 'number' },
      { field: 'marginLevel', transformer: 'number' },
      { field: 'symbol', transformer: 'uppercase' },
      { field: 'currency', transformer: 'uppercase' },
    ];
    
    return this.transform(sanitized, transformRules);
  }

  normalize(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const normalized: any = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // 文字列の前後空白削除
        normalized[key] = value.trim();
      } else if (typeof value === 'object' && value !== null) {
        // 再帰的に正規化
        normalized[key] = this.normalize(value);
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  transform(data: any, rules: TransformRule[]): any {
    let transformed = { ...data };
    
    for (const rule of rules) {
      const value = this.getNestedValue(transformed, rule.field);
      if (value !== undefined) {
        const transformedValue = this.applyTransformer(value, rule.transformer, rule.config);
        this.setNestedValue(transformed, rule.field, transformedValue);
      }
    }
    
    return transformed;
  }

  private applyTransformer(value: any, transformer: string, config?: any): any {
    switch (transformer) {
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'number':
        return typeof value === 'string' ? parseFloat(value) : value;
      case 'date':
        return typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
      default:
        return value;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

// デフォルトバリデーターのインスタンス
export const defaultValidator = new EADataValidator();

/**
 * 便利な関数：クイックバリデーション
 */
export async function validateEAMessage(message: EAMessage, accountId: string): Promise<ValidationResult> {
  const context: ValidationContext = {
    accountId,
    timestamp: new Date(),
    messageType: message.type,
  };
  
  return defaultValidator.validateEAMessage(message, context);
}

/**
 * 便利な関数：ポジションバリデーション
 */
export function validatePosition(position: Position): ValidationResult {
  const context: ValidationContext = {
    accountId: 'unknown',
    timestamp: new Date(),
    messageType: 'position',
  };
  
  const validator = new EADataValidator();
  return validator['validatePosition'](position, 0, context);
}
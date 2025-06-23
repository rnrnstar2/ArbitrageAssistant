import { SyncEvent } from './sync-manager.js';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class DataValidator {
  validate(event: SyncEvent): boolean {
    try {
      // 基本的なイベント構造の検証
      if (!this.validateEventStructure(event)) {
        return false;
      }
      
      // エンティティ固有の検証
      switch (event.entity) {
        case 'position':
          return this.validatePosition(event.data);
        case 'strategy':
          return this.validateStrategy(event.data);
        case 'action':
          return this.validateAction(event.data);
        default:
          return false;
      }
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }
  
  validateWithDetails(event: SyncEvent): ValidationResult {
    const errors: string[] = [];
    
    try {
      // 基本的なイベント構造の検証
      const structureResult = this.validateEventStructureWithDetails(event);
      if (!structureResult.isValid) {
        errors.push(...structureResult.errors);
      }
      
      // エンティティ固有の検証
      let entityResult: ValidationResult;
      switch (event.entity) {
        case 'position':
          entityResult = this.validatePositionWithDetails(event.data);
          break;
        case 'strategy':
          entityResult = this.validateStrategyWithDetails(event.data);
          break;
        case 'action':
          entityResult = this.validateActionWithDetails(event.data);
          break;
        default:
          entityResult = { isValid: false, errors: ['Unknown entity type'] };
      }
      
      if (!entityResult.isValid) {
        errors.push(...entityResult.errors);
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        errors: [`Validation error: ${error}`]
      };
    }
  }
  
  private validateEventStructure(event: SyncEvent): boolean {
    return !!(
      event.type &&
      event.entity &&
      event.data &&
      event.timestamp &&
      event.source &&
      event.syncId
    );
  }
  
  private validateEventStructureWithDetails(event: SyncEvent): ValidationResult {
    const errors: string[] = [];
    
    if (!event.type) errors.push('Event type is required');
    if (!event.entity) errors.push('Event entity is required');
    if (!event.data) errors.push('Event data is required');
    if (!event.timestamp) errors.push('Event timestamp is required');
    if (!event.source) errors.push('Event source is required');
    if (!event.syncId) errors.push('Event syncId is required');
    
    // 型の検証
    if (event.type && !['CREATE', 'UPDATE', 'DELETE'].includes(event.type)) {
      errors.push('Invalid event type');
    }
    
    if (event.entity && !['position', 'strategy', 'action'].includes(event.entity)) {
      errors.push('Invalid entity type');
    }
    
    if (event.source && !['local', 'remote'].includes(event.source)) {
      errors.push('Invalid source type');
    }
    
    if (event.timestamp && !(event.timestamp instanceof Date) && isNaN(Date.parse(String(event.timestamp)))) {
      errors.push('Invalid timestamp format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private validatePosition(position: any): boolean {
    return !!(
      position.positionId &&
      position.strategyId &&
      position.status &&
      position.symbol &&
      typeof position.volume === 'number' &&
      position.volume > 0
    );
  }
  
  private validatePositionWithDetails(position: any): ValidationResult {
    const errors: string[] = [];
    
    if (!position.positionId) errors.push('Position ID is required');
    if (!position.strategyId) errors.push('Strategy ID is required');
    if (!position.status) errors.push('Position status is required');
    if (!position.symbol) errors.push('Symbol is required');
    
    if (position.volume === undefined || position.volume === null) {
      errors.push('Volume is required');
    } else if (typeof position.volume !== 'number') {
      errors.push('Volume must be a number');
    } else if (position.volume <= 0) {
      errors.push('Volume must be greater than 0');
    }
    
    // 任意フィールドの検証
    if (position.entryPrice !== undefined && typeof position.entryPrice !== 'number') {
      errors.push('Entry price must be a number');
    }
    
    if (position.exitPrice !== undefined && typeof position.exitPrice !== 'number') {
      errors.push('Exit price must be a number');
    }
    
    if (position.stopLoss !== undefined && typeof position.stopLoss !== 'number') {
      errors.push('Stop loss must be a number');
    }
    
    if (position.takeProfit !== undefined && typeof position.takeProfit !== 'number') {
      errors.push('Take profit must be a number');
    }
    
    if (position.trailWidth !== undefined && typeof position.trailWidth !== 'number') {
      errors.push('Trail width must be a number');
    }
    
    // 日付フィールドの検証
    if (position.entryTime && isNaN(Date.parse(position.entryTime))) {
      errors.push('Invalid entry time format');
    }
    
    if (position.exitTime && isNaN(Date.parse(position.exitTime))) {
      errors.push('Invalid exit time format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private validateStrategy(strategy: any): boolean {
    return !!(
      strategy.strategyId &&
      strategy.name &&
      typeof strategy.trailWidth === 'number' &&
      strategy.trailWidth > 0
    );
  }
  
  private validateStrategyWithDetails(strategy: any): ValidationResult {
    const errors: string[] = [];
    
    if (!strategy.strategyId) errors.push('Strategy ID is required');
    if (!strategy.name) errors.push('Strategy name is required');
    
    if (strategy.trailWidth === undefined || strategy.trailWidth === null) {
      errors.push('Trail width is required');
    } else if (typeof strategy.trailWidth !== 'number') {
      errors.push('Trail width must be a number');
    } else if (strategy.trailWidth <= 0) {
      errors.push('Trail width must be greater than 0');
    }
    
    // 任意フィールドの検証
    if (strategy.symbol && typeof strategy.symbol !== 'string') {
      errors.push('Symbol must be a string');
    }
    
    if (strategy.maxRisk !== undefined && typeof strategy.maxRisk !== 'number') {
      errors.push('Max risk must be a number');
    }
    
    if (strategy.maxRisk !== undefined && strategy.maxRisk < 0) {
      errors.push('Max risk cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private validateAction(action: any): boolean {
    return !!(
      action.actionId &&
      action.strategyId &&
      action.type &&
      action.status
    );
  }
  
  private validateActionWithDetails(action: any): ValidationResult {
    const errors: string[] = [];
    
    if (!action.actionId) errors.push('Action ID is required');
    if (!action.strategyId) errors.push('Strategy ID is required');
    if (!action.type) errors.push('Action type is required');
    if (!action.status) errors.push('Action status is required');
    
    // 任意フィールドの検証
    if (action.positionId && typeof action.positionId !== 'string') {
      errors.push('Position ID must be a string');
    }
    
    if (action.params && typeof action.params !== 'object') {
      errors.push('Action params must be an object');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  sanitizeData(data: any): any {
    // データのサニタイズ
    // - 不要なフィールドの削除
    // - 型の正規化
    // - セキュリティチェック
    
    const sanitized = { ...data };
    
    // 内部フィールドの削除
    delete sanitized._internal;
    delete sanitized._temp;
    delete sanitized.__typename; // GraphQLの型名フィールド
    
    // 型の正規化
    if (sanitized.volume !== undefined) {
      sanitized.volume = Number(sanitized.volume);
    }
    if (sanitized.trailWidth !== undefined) {
      sanitized.trailWidth = Number(sanitized.trailWidth);
    }
    if (sanitized.entryPrice !== undefined) {
      sanitized.entryPrice = Number(sanitized.entryPrice);
    }
    if (sanitized.exitPrice !== undefined) {
      sanitized.exitPrice = Number(sanitized.exitPrice);
    }
    if (sanitized.stopLoss !== undefined) {
      sanitized.stopLoss = Number(sanitized.stopLoss);
    }
    if (sanitized.takeProfit !== undefined) {
      sanitized.takeProfit = Number(sanitized.takeProfit);
    }
    if (sanitized.maxRisk !== undefined) {
      sanitized.maxRisk = Number(sanitized.maxRisk);
    }
    
    // 日付の正規化
    if (sanitized.entryTime && typeof sanitized.entryTime === 'string') {
      sanitized.entryTime = new Date(sanitized.entryTime);
    }
    if (sanitized.exitTime && typeof sanitized.exitTime === 'string') {
      sanitized.exitTime = new Date(sanitized.exitTime);
    }
    if (sanitized.createdAt && typeof sanitized.createdAt === 'string') {
      sanitized.createdAt = new Date(sanitized.createdAt);
    }
    if (sanitized.updatedAt && typeof sanitized.updatedAt === 'string') {
      sanitized.updatedAt = new Date(sanitized.updatedAt);
    }
    
    // 文字列のトリミング
    if (typeof sanitized.name === 'string') {
      sanitized.name = sanitized.name.trim();
    }
    if (typeof sanitized.symbol === 'string') {
      sanitized.symbol = sanitized.symbol.trim().toUpperCase();
    }
    if (typeof sanitized.status === 'string') {
      sanitized.status = sanitized.status.trim();
    }
    if (typeof sanitized.type === 'string') {
      sanitized.type = sanitized.type.trim();
    }
    if (typeof sanitized.exitReason === 'string') {
      sanitized.exitReason = sanitized.exitReason.trim();
    }
    
    return sanitized;
  }
  
  // セキュリティ関連の検証
  isSecure(data: any): boolean {
    // 危険なプロパティやスクリプトが含まれていないかチェック
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const dataString = JSON.stringify(data);
    
    // 危険なキーの存在チェック
    for (const key of dangerousKeys) {
      if (key in data) {
        return false;
      }
    }
    
    // 基本的なXSS対策
    if (dataString.includes('<script>') || dataString.includes('javascript:')) {
      return false;
    }
    
    return true;
  }
}
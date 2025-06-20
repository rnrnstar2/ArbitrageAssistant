/**
 * 決済システム用バリデーション機能
 * 
 * 決済フォームの入力値検証、決済前チェック、ビジネスロジック検証を提供
 */

import { CloseFormData, CloseResult, BatchCloseInput } from "./types";
import { Position } from "../../monitoring/types";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  value?: any;
  impact?: string;
}

export interface CloseValidationContext {
  position: Position;
  relatedPositions: Position[];
  marketContext?: {
    isMarketOpen: boolean;
    currentSpread: number;
    lastPriceUpdate: Date;
  };
  accountContext?: {
    balance: number;
    marginLevel: number;
    equity: number;
  };
}

export class CloseFormValidator {
  /**
   * 決済フォームデータの包括的バリデーション
   */
  validateCloseForm(
    data: CloseFormData,
    context: CloseValidationContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 基本フィールドバリデーション
    this.validateBasicFields(data, errors);

    // 価格バリデーション
    this.validatePrice(data, context, errors, warnings);

    // トレール設定バリデーション
    this.validateTrailSettings(data, errors, warnings);

    // 関連ポジション連動バリデーション
    this.validateLinkedAction(data, context, errors, warnings);

    // ビジネスロジックバリデーション
    this.validateBusinessLogic(data, context, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 一括決済データのバリデーション
   */
  validateBatchClose(
    data: BatchCloseInput,
    positions: Position[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // ポジション存在チェック
    if (!data.positionIds || data.positionIds.length === 0) {
      errors.push({
        field: "positionIds",
        code: "EMPTY_POSITION_LIST",
        message: "決済対象のポジションが選択されていません",
      });
      return { isValid: false, errors, warnings };
    }

    // 各ポジションの検証
    data.positionIds.forEach((positionId, index) => {
      const position = positions.find(p => p.id === positionId);
      if (!position) {
        errors.push({
          field: `positionIds[${index}]`,
          code: "POSITION_NOT_FOUND",
          message: `ポジション ${positionId} が見つかりません`,
          value: positionId,
        });
      } else {
        // ポジション状態チェック
        this.validatePositionState(position, `positionIds[${index}]`, errors, warnings);
      }
    });

    // 大量決済の警告
    if (data.positionIds.length > 10) {
      warnings.push({
        field: "positionIds",
        code: "LARGE_BATCH_SIZE",
        message: `${data.positionIds.length}件の大量決済です`,
        impact: "処理時間が長くなる可能性があります",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 基本フィールドの必須チェック
   */
  private validateBasicFields(data: CloseFormData, errors: ValidationError[]): void {
    if (!data.positionId) {
      errors.push({
        field: "positionId",
        code: "REQUIRED_FIELD",
        message: "ポジションIDが必要です",
      });
    }

    if (!data.closeType) {
      errors.push({
        field: "closeType",
        code: "REQUIRED_FIELD",
        message: "決済方法を選択してください",
      });
    }

    if (data.closeType === "limit" && (!data.closePrice || data.closePrice <= 0)) {
      errors.push({
        field: "closePrice",
        code: "INVALID_LIMIT_PRICE",
        message: "指値決済の場合は有効な決済価格を入力してください",
        value: data.closePrice,
        constraint: "closePrice > 0",
      });
    }
  }

  /**
   * 価格バリデーション
   */
  private validatePrice(
    data: CloseFormData,
    context: CloseValidationContext,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (data.closeType === "limit" && data.closePrice) {
      const { position } = context;
      const currentPrice = position.currentPrice;
      const openPrice = position.openPrice;

      // 価格範囲チェック
      const maxDeviation = currentPrice * 0.1; // 10%の変動まで許可
      if (Math.abs(data.closePrice - currentPrice) > maxDeviation) {
        warnings.push({
          field: "closePrice",
          code: "LARGE_PRICE_DEVIATION",
          message: `現在価格から${(Math.abs(data.closePrice - currentPrice) / currentPrice * 100).toFixed(1)}%離れています`,
          value: data.closePrice,
          impact: "約定しない可能性があります",
        });
      }

      // 損失拡大警告
      const currentProfit = this.calculateExpectedProfit(position, currentPrice);
      const limitProfit = this.calculateExpectedProfit(position, data.closePrice);
      
      if (limitProfit < currentProfit - Math.abs(currentProfit * 0.05)) { // 5%以上損失拡大
        warnings.push({
          field: "closePrice",
          code: "INCREASED_LOSS",
          message: `現在より損失が拡大します（差額: ${(limitProfit - currentProfit).toFixed(2)}）`,
          value: { current: currentProfit, limit: limitProfit },
          impact: "追加損失が発生します",
        });
      }
    }

    // 市場状況チェック
    if (context.marketContext) {
      if (!context.marketContext.isMarketOpen) {
        warnings.push({
          field: "market",
          code: "MARKET_CLOSED",
          message: "市場が閉まっています",
          impact: "決済が翌営業日に延期される可能性があります",
        });
      }

      // スプレッド警告
      if (context.marketContext.currentSpread > 50) { // 5pips以上
        warnings.push({
          field: "market",
          code: "HIGH_SPREAD",
          message: `スプレッドが広がっています（${context.marketContext.currentSpread / 10}pips）`,
          impact: "取引コストが増加します",
        });
      }
    }
  }

  /**
   * トレール設定バリデーション
   */
  private validateTrailSettings(
    data: CloseFormData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (data.trailSettings?.enabled) {
      const { startPips, trailPips } = data.trailSettings;

      if (!startPips || startPips <= 0) {
        errors.push({
          field: "trailSettings.startPips",
          code: "INVALID_TRAIL_START",
          message: "トレール開始PIPSは1以上で入力してください",
          value: startPips,
          constraint: "startPips >= 1",
        });
      }

      if (!trailPips || trailPips <= 0) {
        errors.push({
          field: "trailSettings.trailPips",
          code: "INVALID_TRAIL_PIPS",
          message: "トレール幅PIPSは1以上で入力してください",
          value: trailPips,
          constraint: "trailPips >= 1",
        });
      }

      if (startPips && trailPips && startPips < trailPips) {
        warnings.push({
          field: "trailSettings",
          code: "TRAIL_START_TOO_SMALL",
          message: "トレール開始PIPSがトレール幅より小さいです",
          impact: "トレールが即座に開始される可能性があります",
        });
      }

      // 過度に大きなトレール設定の警告
      if (startPips && startPips > 500) { // 50pips
        warnings.push({
          field: "trailSettings.startPips",
          code: "LARGE_TRAIL_START",
          message: `トレール開始PIPSが大きすぎます（${startPips / 10}pips）`,
          impact: "トレールが開始されにくくなります",
        });
      }
    }
  }

  /**
   * 関連ポジション連動バリデーション
   */
  private validateLinkedAction(
    data: CloseFormData,
    context: CloseValidationContext,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (data.linkedAction && data.linkedAction.action !== "none") {
      const { relatedPositionId, action } = data.linkedAction;

      if (!relatedPositionId) {
        errors.push({
          field: "linkedAction.relatedPositionId",
          code: "MISSING_RELATED_POSITION",
          message: "連動アクションを設定する場合は対象ポジションを選択してください",
        });
        return;
      }

      const relatedPosition = context.relatedPositions.find(p => p.id === relatedPositionId);
      if (!relatedPosition) {
        errors.push({
          field: "linkedAction.relatedPositionId",
          code: "RELATED_POSITION_NOT_FOUND",
          message: "選択された関連ポジションが見つかりません",
          value: relatedPositionId,
        });
        return;
      }

      // 両建てチェック
      if (action === "close" && this.isHedgePosition(context.position, relatedPosition)) {
        warnings.push({
          field: "linkedAction",
          code: "HEDGE_SIMULTANEOUS_CLOSE",
          message: "両建てポジションを同時決済します",
          impact: "リスクヘッジが解除されます",
        });
      }

      // 関連ポジション状態チェック
      this.validatePositionState(relatedPosition, "linkedAction.relatedPositionId", errors, warnings);
    }
  }

  /**
   * ビジネスロジックバリデーション
   */
  private validateBusinessLogic(
    data: CloseFormData,
    context: CloseValidationContext,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { position, accountContext } = context;

    // ポジション状態チェック
    this.validatePositionState(position, "position", errors, warnings);

    // 証拠金レベルチェック
    if (accountContext) {
      if (accountContext.marginLevel < 100) {
        warnings.push({
          field: "account",
          code: "LOW_MARGIN_LEVEL",
          message: `証拠金維持率が低下しています（${accountContext.marginLevel.toFixed(1)}%）`,
          impact: "強制ロスカットのリスクがあります",
        });
      }

      // 大きな損失の警告
      const currentProfit = this.calculateExpectedProfit(position, position.currentPrice);
      const lossThreshold = accountContext.balance * 0.1; // 残高の10%

      if (currentProfit < -lossThreshold) {
        warnings.push({
          field: "position",
          code: "LARGE_LOSS",
          message: `大きな損失が発生しています（${currentProfit.toFixed(2)}）`,
          impact: "アカウント残高への影響が大きいです",
        });
      }
    }

    // 長期保有ポジションの警告
    const holdingDays = this.calculateHoldingDays(position.openTime);
    if (holdingDays > 7) {
      warnings.push({
        field: "position",
        code: "LONG_HOLDING_POSITION",
        message: `${holdingDays}日間保有されているポジションです`,
        impact: "スワップコストが累積している可能性があります",
      });
    }
  }

  /**
   * ポジション状態の個別チェック
   */
  private validatePositionState(
    position: Position,
    fieldPrefix: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // ポジション決済可能性チェック
    if (position.status && position.status !== "open") {
      errors.push({
        field: fieldPrefix,
        code: "POSITION_NOT_CLOSABLE",
        message: `ポジション ${position.id} は決済できません（状態: ${position.status}）`,
        value: position.status,
      });
    }

    // 最終更新時間チェック
    const lastUpdateMinutes = this.getMinutesSince(position.lastUpdate);
    if (lastUpdateMinutes > 5) {
      warnings.push({
        field: fieldPrefix,
        code: "STALE_POSITION_DATA",
        message: `ポジションデータが${lastUpdateMinutes}分前の情報です`,
        impact: "最新の価格が反映されていない可能性があります",
      });
    }
  }

  /**
   * 期待損益の計算
   */
  private calculateExpectedProfit(position: Position, closePrice: number): number {
    const priceDiff = position.type === "buy" 
      ? closePrice - position.openPrice
      : position.openPrice - closePrice;
    
    // 簡易計算（実際はより複雑な計算が必要）
    const pipValue = position.lots * 100000 * 0.0001;
    return priceDiff * pipValue - (position.commission || 0) - (position.swapPoints || 0);
  }

  /**
   * 両建てポジションかどうかの判定
   */
  private isHedgePosition(position1: Position, position2: Position): boolean {
    return position1.symbol === position2.symbol && 
           position1.type !== position2.type &&
           Math.abs(position1.lots - position2.lots) < 0.01;
  }

  /**
   * 保有日数の計算
   */
  private calculateHoldingDays(openTime: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(openTime).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 経過分数の計算
   */
  private getMinutesSince(timestamp: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(timestamp).getTime());
    return Math.floor(diffTime / (1000 * 60));
  }
}

/**
 * 価格バリデーション用ユーティリティ
 */
export class PriceValidator {
  /**
   * 価格の妥当性チェック
   */
  static validatePrice(price: number, symbol: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (price <= 0) {
      errors.push({
        field: "price",
        code: "INVALID_PRICE",
        message: "価格は正の値である必要があります",
        value: price,
      });
    }

    // 通貨ペア別の価格範囲チェック
    const priceRange = this.getPriceRange(symbol);
    if (price < priceRange.min || price > priceRange.max) {
      warnings.push({
        field: "price",
        code: "PRICE_OUT_OF_RANGE",
        message: `${symbol}の一般的な価格範囲外です（${priceRange.min} - ${priceRange.max}）`,
        value: price,
        impact: "価格が異常である可能性があります",
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 通貨ペア別の価格範囲を取得
   */
  private static getPriceRange(symbol: string): { min: number; max: number } {
    const ranges: Record<string, { min: number; max: number }> = {
      "EURUSD": { min: 0.8000, max: 1.5000 },
      "GBPUSD": { min: 1.0000, max: 2.0000 },
      "USDJPY": { min: 80.00, max: 160.00 },
      "USDCHF": { min: 0.7000, max: 1.3000 },
      "AUDUSD": { min: 0.5000, max: 1.2000 },
      "USDCAD": { min: 1.0000, max: 1.6000 },
      "NZDUSD": { min: 0.4000, max: 1.0000 },
    };

    return ranges[symbol] || { min: 0.0001, max: 1000000 };
  }
}

/**
 * 数量バリデーション用ユーティリティ
 */
export class QuantityValidator {
  /**
   * ロット数の妥当性チェック
   */
  static validateLotSize(lots: number, maxLots: number = 100): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (lots <= 0) {
      errors.push({
        field: "lots",
        code: "INVALID_LOT_SIZE",
        message: "ロット数は正の値である必要があります",
        value: lots,
      });
    }

    if (lots > maxLots) {
      errors.push({
        field: "lots",
        code: "LOT_SIZE_TOO_LARGE",
        message: `ロット数が上限を超えています（上限: ${maxLots}）`,
        value: lots,
        constraint: `lots <= ${maxLots}`,
      });
    }

    // 小数点以下の桁数チェック
    const decimalPlaces = (lots.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      warnings.push({
        field: "lots",
        code: "EXCESSIVE_DECIMAL_PLACES",
        message: "ロット数の小数点以下は2桁までが推奨されます",
        value: lots,
        impact: "注文が拒否される可能性があります",
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * 決済バリデーションのファクトリー関数
 */
export function createCloseValidator(): CloseFormValidator {
  return new CloseFormValidator();
}
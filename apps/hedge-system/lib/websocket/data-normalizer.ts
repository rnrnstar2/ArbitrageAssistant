import { 
  WebSocketMessage, 
  Position, 
  AccountInfo,
  validateMessage,
  safeParseEAMessage,
  EAMessage
} from "./message-types";
import { createComponentLogger } from "./logger";

const logger = createComponentLogger('data-normalizer');

/**
 * Normalizes incoming EA data to a consistent format
 */
export class DataNormalizer {
  
  /**
   * Normalize position update data
   */
  static normalizePositionUpdate(message: WebSocketMessage): Position[] | null {
    try {
      if (!validateMessage(message) || message.type !== "position_update") {
        logger.warning('Invalid position update message', { 
          messageType: message.type,
          hasPayload: !!message.payload 
        });
        return null;
      }

      const payload = message.payload as any;
      
      if (!payload.positions || !Array.isArray(payload.positions)) {
        logger.warning('Position update missing positions array');
        return null;
      }

      return payload.positions.map((pos: any) => this.normalizePosition(pos, payload.accountId));
    } catch (error) {
      logger.error('Failed to normalize position update', error);
      return null;
    }
  }

  /**
   * Normalize account update data
   */
  static normalizeAccountUpdate(message: WebSocketMessage): AccountInfo | null {
    try {
      if (!validateMessage(message) || message.type !== "account_update") {
        logger.warning('Invalid account update message', { 
          messageType: message.type,
          hasPayload: !!message.payload 
        });
        return null;
      }

      const payload = message.payload as any;

      return {
        accountId: payload.accountId || '',
        broker: payload.broker || 'Unknown',
        accountNumber: payload.accountNumber || '',
        balance: this.normalizeNumber(payload.balance, 0),
        equity: this.normalizeNumber(payload.equity, 0),
        bonusAmount: this.normalizeNumber(payload.bonusAmount, 0),
        marginLevel: this.normalizeNumber(payload.marginLevel, 0),
        freeMargin: this.normalizeNumber(payload.freeMargin, 0),
        usedMargin: this.normalizeNumber(payload.usedMargin, 0),
        currency: payload.currency || 'USD',
        leverage: this.normalizeNumber(payload.leverage, 1),
        profit: this.normalizeNumber(payload.profit, 0),
        credit: this.normalizeNumber(payload.credit, 0),
        timestamp: payload.timestamp || Date.now(),
      };
    } catch (error) {
      logger.error('Failed to normalize account update', error);
      return null;
    }
  }

  /**
   * Normalize market data
   */
  static normalizeMarketData(message: WebSocketMessage): any | null {
    try {
      if (!validateMessage(message) || message.type !== "market_data") {
        logger.warning('Invalid market data message', { 
          messageType: message.type,
          hasPayload: !!message.payload 
        });
        return null;
      }

      const payload = message.payload as any;

      // Handle both single symbol and multiple symbols
      if (payload.symbol) {
        // Single symbol format
        return {
          [payload.symbol]: {
            symbol: payload.symbol,
            bid: this.normalizePrice(payload.bid),
            ask: this.normalizePrice(payload.ask),
            spread: this.normalizeSpread(payload.bid, payload.ask),
            lastUpdated: payload.lastUpdated || new Date().toISOString(),
          }
        };
      } else {
        // Multiple symbols format
        const normalizedData: any = {};
        for (const [symbol, data] of Object.entries(payload)) {
          const symbolData = data as any;
          normalizedData[symbol] = {
            symbol,
            bid: this.normalizePrice(symbolData.bid),
            ask: this.normalizePrice(symbolData.ask),
            spread: this.normalizeSpread(symbolData.bid, symbolData.ask),
            lastUpdated: symbolData.lastUpdated || new Date().toISOString(),
          };
        }
        return normalizedData;
      }
    } catch (error) {
      logger.error('Failed to normalize market data', error);
      return null;
    }
  }

  /**
   * Normalize individual position
   */
  private static normalizePosition(pos: any, accountId: string): Position {
    return {
      id: pos.id || pos.positionId || `pos_${Date.now()}`,
      accountId: accountId,
      symbol: pos.symbol || '',
      type: pos.type === 'BUY' ? 'buy' : pos.type === 'SELL' ? 'sell' : pos.type,
      lots: this.normalizeNumber(pos.lots || pos.volume, 0),
      openPrice: this.normalizePrice(pos.openPrice),
      currentPrice: this.normalizePrice(pos.currentPrice || pos.price),
      profit: this.normalizeNumber(pos.profit, 0),
      swapTotal: this.normalizeNumber(pos.swapTotal || pos.swap, 0),
      commission: this.normalizeNumber(pos.commission, 0),
      stopLoss: pos.stopLoss ? this.normalizePrice(pos.stopLoss) : undefined,
      takeProfit: pos.takeProfit ? this.normalizePrice(pos.takeProfit) : undefined,
      status: this.normalizePositionStatus(pos.status),
      openedAt: this.normalizeDateTime(pos.openedAt || pos.openTime),
      closedAt: pos.closedAt ? this.normalizeDateTime(pos.closedAt) : undefined,
      comment: pos.comment || '',
      trailSettings: pos.trailSettings,
      closeSettings: pos.closeSettings,
      relatedPositionId: pos.relatedPositionId,
    };
  }

  /**
   * Normalize numeric values
   */
  private static normalizeNumber(value: any, defaultValue: number = 0): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return defaultValue;
  }

  /**
   * Normalize price values (with precision)
   */
  private static normalizePrice(value: any): number {
    const price = this.normalizeNumber(value, 0);
    // Round to 5 decimal places for most FX pairs
    return Math.round(price * 100000) / 100000;
  }

  /**
   * Calculate and normalize spread
   */
  private static normalizeSpread(bid: any, ask: any): number {
    const bidPrice = this.normalizePrice(bid);
    const askPrice = this.normalizePrice(ask);
    const spread = askPrice - bidPrice;
    return Math.max(0, Math.round(spread * 100000) / 100000);
  }

  /**
   * Normalize position status
   */
  private static normalizePositionStatus(status: any): "open" | "pending_close" | "closed" {
    if (typeof status === 'string') {
      const normalized = status.toLowerCase();
      if (normalized === 'open' || normalized === 'active') return 'open';
      if (normalized === 'closed' || normalized === 'closed') return 'closed';
      if (normalized === 'pending' || normalized === 'pending_close') return 'pending_close';
    }
    return 'open'; // Default to open
  }

  /**
   * Normalize datetime values
   */
  private static normalizeDateTime(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * Validate and normalize incoming message
   */
  static normalizeMessage(message: any): WebSocketMessage | null {
    try {
      if (!validateMessage(message)) {
        logger.warning('Message failed validation', {
          type: typeof message,
          hasType: !!message?.type,
          hasTimestamp: !!message?.timestamp,
          hasPayload: !!message?.payload
        });
        return null;
      }

      return {
        type: message.type,
        payload: message.payload,
        timestamp: this.normalizeNumber(message.timestamp, Date.now()),
        clientId: message.clientId,
      };
    } catch (error) {
      logger.error('Failed to normalize message', error);
      return null;
    }
  }

  /**
   * Batch normalize multiple messages
   */
  static batchNormalize(messages: any[]): WebSocketMessage[] {
    return messages
      .map(msg => this.normalizeMessage(msg))
      .filter((msg): msg is WebSocketMessage => msg !== null);
  }

  /**
   * Get data quality score for a message
   */
  static getDataQuality(message: WebSocketMessage): number {
    let score = 0;
    let maxScore = 0;

    // Basic message structure (20 points)
    maxScore += 20;
    if (message.type && message.timestamp && message.payload) {
      score += 20;
    }

    // Payload completeness depends on message type
    if (message.type === 'position_update') {
      maxScore += 40;
      const payload = message.payload as any;
      if (payload.accountId) score += 10;
      if (payload.positions && Array.isArray(payload.positions)) score += 15;
      if (payload.positions?.every((p: any) => p.id && p.symbol && p.type)) score += 15;
    } else if (message.type === 'account_update') {
      maxScore += 40;
      const payload = message.payload as any;
      if (payload.accountId) score += 10;
      if (typeof payload.balance === 'number') score += 10;
      if (typeof payload.equity === 'number') score += 10;
      if (typeof payload.marginLevel === 'number') score += 10;
    }

    // Timeliness (40 points)
    maxScore += 40;
    const age = Date.now() - message.timestamp;
    if (age < 1000) score += 40;        // Less than 1 second
    else if (age < 5000) score += 30;   // Less than 5 seconds  
    else if (age < 30000) score += 20;  // Less than 30 seconds
    else if (age < 60000) score += 10;  // Less than 1 minute

    return Math.round((score / maxScore) * 100);
  }
}

/**
 * Export convenience functions
 */
export const {
  normalizePositionUpdate,
  normalizeAccountUpdate,
  normalizeMarketData,
  normalizeMessage,
  batchNormalize,
  getDataQuality
} = DataNormalizer;
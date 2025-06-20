import { 
  TrailHistoryEntry, 
  TrailHistoryFilters, 
  TrailHistoryResponse, 
  TrailHistoryStats,
  TrailSettings 
} from './types';

export class TrailLogManager {
  private static instance: TrailLogManager;
  private historyData: TrailHistoryEntry[] = [];
  private maxHistorySize = 10000;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): TrailLogManager {
    if (!TrailLogManager.instance) {
      TrailLogManager.instance = new TrailLogManager();
    }
    return TrailLogManager.instance;
  }

  logTrailAction(
    positionId: string,
    accountId: string,
    symbol: string,
    trailSettings: TrailSettings,
    actionType: 'start' | 'update' | 'stop' | 'triggered',
    currentPrice: number,
    currentProfit: number,
    maxProfit: number,
    oldStopLoss?: number,
    newStopLoss?: number,
    reason?: string,
    success: boolean = true,
    error?: string
  ): void {
    const entry: TrailHistoryEntry = {
      id: this.generateId(),
      positionId,
      accountId,
      symbol,
      trailSettings: { ...trailSettings },
      actionType,
      oldStopLoss,
      newStopLoss,
      price: currentPrice,
      profit: currentProfit,
      maxProfit,
      trailDistance: this.calculateTrailDistance(trailSettings, currentPrice, newStopLoss),
      timestamp: new Date(),
      reason,
      success,
      error
    };

    this.historyData.unshift(entry);
    this.limitHistorySize();
    this.saveToStorage();
  }

  getHistory(filters: TrailHistoryFilters = {}): TrailHistoryResponse {
    let filteredData = this.applyFilters(this.historyData, filters);
    
    const stats = this.calculateStats(filteredData);
    
    // ソート
    if (filters.sortBy) {
      filteredData = this.sortData(filteredData, filters.sortBy, filters.sortOrder || 'desc');
    }

    // ページネーション
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const totalPages = Math.ceil(filteredData.length / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    
    const items = filteredData.slice(offset, offset + limit);

    return {
      items,
      total: filteredData.length,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      currentPage,
      totalPages,
      stats
    };
  }

  clearHistory(): void {
    this.historyData = [];
    this.saveToStorage();
  }

  exportHistory(filters: TrailHistoryFilters = {}): TrailHistoryEntry[] {
    return this.applyFilters(this.historyData, filters);
  }

  private applyFilters(data: TrailHistoryEntry[], filters: TrailHistoryFilters): TrailHistoryEntry[] {
    let filtered = [...data];

    if (filters.accountIds?.length) {
      filtered = filtered.filter(item => filters.accountIds!.includes(item.accountId));
    }

    if (filters.symbols?.length) {
      filtered = filtered.filter(item => filters.symbols!.includes(item.symbol));
    }

    if (filters.positionIds?.length) {
      filtered = filtered.filter(item => filters.positionIds!.includes(item.positionId));
    }

    if (filters.actionTypes?.length) {
      filtered = filtered.filter(item => filters.actionTypes!.includes(item.actionType));
    }

    if (filters.dateRange) {
      const { from, to } = filters.dateRange;
      filtered = filtered.filter(item => {
        const timestamp = item.timestamp.getTime();
        return timestamp >= from.getTime() && timestamp <= to.getTime();
      });
    }

    if (filters.profitRange) {
      const { min, max } = filters.profitRange;
      filtered = filtered.filter(item => {
        if (min !== undefined && item.profit < min) return false;
        if (max !== undefined && item.profit > max) return false;
        return true;
      });
    }

    if (filters.success !== undefined) {
      filtered = filtered.filter(item => item.success === filters.success);
    }

    return filtered;
  }

  private sortData(
    data: TrailHistoryEntry[], 
    sortBy: string, 
    sortOrder: 'asc' | 'desc'
  ): TrailHistoryEntry[] {
    return [...data].sort((a, b) => {
      let aValue: any = a[sortBy as keyof TrailHistoryEntry];
      let bValue: any = b[sortBy as keyof TrailHistoryEntry];

      if (aValue instanceof Date && bValue instanceof Date) {
        aValue = aValue.getTime();
        bValue = bValue.getTime();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      let result = 0;
      if (aValue < bValue) result = -1;
      else if (aValue > bValue) result = 1;

      return sortOrder === 'desc' ? -result : result;
    });
  }

  private calculateStats(data: TrailHistoryEntry[]): TrailHistoryStats {
    if (data.length === 0) {
      return {
        totalActions: 0,
        successfulActions: 0,
        successRate: 0,
        averageProfit: 0,
        maxProfit: 0,
        minProfit: 0,
        averageTrailDistance: 0,
        totalTriggered: 0,
        triggerRate: 0,
        byActionType: {},
        bySymbol: {},
        profitDistribution: {
          profitable: 0,
          unprofitable: 0,
          breakeven: 0
        }
      };
    }

    const totalActions = data.length;
    const successfulActions = data.filter(item => item.success).length;
    const profits = data.map(item => item.profit);
    const trailDistances = data.map(item => item.trailDistance);
    const triggeredActions = data.filter(item => item.actionType === 'triggered').length;

    // アクション種別別統計
    const byActionType: Record<string, any> = {};
    const actionTypes = [...new Set(data.map(item => item.actionType))];
    
    actionTypes.forEach(actionType => {
      const typeData = data.filter(item => item.actionType === actionType);
      byActionType[actionType] = {
        count: typeData.length,
        successRate: typeData.filter(item => item.success).length / typeData.length,
        averageProfit: typeData.reduce((sum, item) => sum + item.profit, 0) / typeData.length
      };
    });

    // 通貨ペア別統計
    const bySymbol: Record<string, any> = {};
    const symbols = [...new Set(data.map(item => item.symbol))];
    
    symbols.forEach(symbol => {
      const symbolData = data.filter(item => item.symbol === symbol);
      const symbolTriggered = symbolData.filter(item => item.actionType === 'triggered').length;
      
      bySymbol[symbol] = {
        count: symbolData.length,
        successRate: symbolData.filter(item => item.success).length / symbolData.length,
        averageProfit: symbolData.reduce((sum, item) => sum + item.profit, 0) / symbolData.length,
        totalTriggered: symbolTriggered
      };
    });

    // 損益分布
    const profitable = data.filter(item => item.profit > 0).length;
    const unprofitable = data.filter(item => item.profit < 0).length;
    const breakeven = data.filter(item => item.profit === 0).length;

    return {
      totalActions,
      successfulActions,
      successRate: successfulActions / totalActions,
      averageProfit: profits.reduce((sum, profit) => sum + profit, 0) / profits.length,
      maxProfit: Math.max(...profits),
      minProfit: Math.min(...profits),
      averageTrailDistance: trailDistances.reduce((sum, dist) => sum + dist, 0) / trailDistances.length,
      totalTriggered: triggeredActions,
      triggerRate: triggeredActions / totalActions,
      byActionType,
      bySymbol,
      profitDistribution: {
        profitable,
        unprofitable,
        breakeven
      }
    };
  }

  private calculateTrailDistance(
    trailSettings: TrailSettings, 
    currentPrice: number, 
    stopLoss?: number
  ): number {
    if (!stopLoss) return 0;
    
    switch (trailSettings.type) {
      case 'fixed':
        return Math.abs(currentPrice - stopLoss);
      case 'percentage':
        return Math.abs((currentPrice - stopLoss) / currentPrice * 100);
      case 'atr':
        return Math.abs(currentPrice - stopLoss);
      default:
        return 0;
    }
  }

  private generateId(): string {
    return `trail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private limitHistorySize(): void {
    if (this.historyData.length > this.maxHistorySize) {
      this.historyData = this.historyData.slice(0, this.maxHistorySize);
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        history: this.historyData,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('trail_history', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save trail history to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('trail_history');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.history && Array.isArray(data.history)) {
          this.historyData = data.history.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp),
            trailSettings: {
              ...item.trailSettings,
              lastUpdated: new Date(item.trailSettings.lastUpdated)
            }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load trail history from storage:', error);
      this.historyData = [];
    }
  }
}

export const trailLogManager = TrailLogManager.getInstance();
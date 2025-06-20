import { useEffect, useCallback, useState } from 'react';
import { DataPersistenceService, getPersistenceService, PositionPersistenceService, MarketDataPersistenceService } from './DataPersistenceService';

export interface PersistenceHookOptions {
  autoSave?: boolean;
  saveInterval?: number;
  enableHistory?: boolean;
}

/**
 * React Hook for data persistence
 */
export function usePersistence<T>(
  key: string,
  initialData: T,
  options: PersistenceHookOptions = {}
) {
  const {
    autoSave = true,
    saveInterval = 5000,
    enableHistory = true,
  } = options;

  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service] = useState(() => getPersistenceService());

  // データの復元
  useEffect(() => {
    const restoreData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (!service) {
          throw new Error('Persistence service not available');
        }
        
        await service.initialize();
        const restored = await service.restoreData(key);
        
        if (restored !== null) {
          setData(restored);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to restore data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreData();
  }, [key, service]);

  // 自動保存
  useEffect(() => {
    if (!autoSave || isLoading) return;

    const saveData = async () => {
      try {
        await service.persistData(key, data);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    };

    const timer = setInterval(saveData, saveInterval);
    return () => clearInterval(timer);
  }, [data, key, autoSave, saveInterval, isLoading, service]);

  // 手動保存
  const save = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      return await service.persistData(key, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
      return false;
    }
  }, [key, data, service]);

  // データ更新
  const updateData = useCallback((newData: T | ((prev: T) => T)) => {
    setData(prev => {
      if (typeof newData === 'function') {
        return (newData as (prev: T) => T)(prev);
      }
      return newData;
    });
  }, []);

  // 履歴取得
  const getHistory = useCallback(async (limit?: number) => {
    if (!enableHistory) return [];
    try {
      return await service.getHistory(key, limit);
    } catch (err) {
      console.error('Failed to get history:', err);
      return [];
    }
  }, [key, enableHistory, service]);

  return {
    data,
    setData: updateData,
    save,
    getHistory,
    isLoading,
    error,
  };
}

/**
 * ポジションデータ用Hook
 */
export function usePositionPersistence(accountId?: string) {
  const [service] = useState(() => new PositionPersistenceService());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        await service.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize position persistence:', error);
      }
    };
    initialize();
  }, [service]);

  const savePosition = useCallback(async (positionId: string, positionData: any) => {
    if (!isInitialized) return false;
    try {
      return await service.persistPosition(positionId, positionData);
    } catch (error) {
      console.error('Failed to save position:', error);
      return false;
    }
  }, [service, isInitialized]);

  const loadPosition = useCallback(async (positionId: string) => {
    if (!isInitialized) return null;
    try {
      return await service.restorePosition(positionId);
    } catch (error) {
      console.error('Failed to load position:', error);
      return null;
    }
  }, [service, isInitialized]);

  const saveAccountPositions = useCallback(async (positions: any[]) => {
    if (!isInitialized || !accountId) return false;
    try {
      return await service.persistAccountPositions(accountId, positions);
    } catch (error) {
      console.error('Failed to save account positions:', error);
      return false;
    }
  }, [service, isInitialized, accountId]);

  const loadAccountPositions = useCallback(async () => {
    if (!isInitialized || !accountId) return [];
    try {
      return await service.restoreAccountPositions(accountId);
    } catch (error) {
      console.error('Failed to load account positions:', error);
      return [];
    }
  }, [service, isInitialized, accountId]);

  return {
    savePosition,
    loadPosition,
    saveAccountPositions,
    loadAccountPositions,
    isInitialized,
  };
}

/**
 * マーケットデータ用Hook
 */
export function useMarketDataPersistence() {
  const [service] = useState(() => new MarketDataPersistenceService());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        await service.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize market data persistence:', error);
      }
    };
    initialize();
  }, [service]);

  const savePriceData = useCallback(async (symbol: string, priceData: any) => {
    if (!isInitialized) return false;
    try {
      return await service.persistPriceData(symbol, priceData);
    } catch (error) {
      console.error('Failed to save price data:', error);
      return false;
    }
  }, [service, isInitialized]);

  const loadPriceData = useCallback(async (symbol: string) => {
    if (!isInitialized) return null;
    try {
      return await service.restorePriceData(symbol);
    } catch (error) {
      console.error('Failed to load price data:', error);
      return null;
    }
  }, [service, isInitialized]);

  return {
    savePriceData,
    loadPriceData,
    isInitialized,
  };
}

/**
 * 全体的なPersistenceコンテキスト用のProvider
 */
export class PersistenceManager {
  private static instance: PersistenceManager | null = null;
  private dataService: DataPersistenceService;
  private positionService: PositionPersistenceService;
  private marketDataService: MarketDataPersistenceService;
  private isInitialized: boolean = false;

  private constructor() {
    this.dataService = getPersistenceService();
    this.positionService = new PositionPersistenceService();
    this.marketDataService = new MarketDataPersistenceService();
  }

  static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.all([
        this.dataService.initialize(),
        this.positionService.initialize(),
        this.marketDataService.initialize(),
      ]);
      
      this.isInitialized = true;
      console.log('PersistenceManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PersistenceManager:', error);
      throw error;
    }
  }

  getDataService(): DataPersistenceService {
    return this.dataService;
  }

  getPositionService(): PositionPersistenceService {
    return this.positionService;
  }

  getMarketDataService(): MarketDataPersistenceService {
    return this.marketDataService;
  }

  async createFullBackup(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('PersistenceManager not initialized');
    }

    const backups = await Promise.all([
      this.dataService.createBackup(),
      this.positionService.createBackup(),
      this.marketDataService.createBackup(),
    ]);

    const fullBackup = {
      timestamp: Date.now(),
      version: '1.0.0',
      services: {
        data: backups[0],
        positions: backups[1],
        marketData: backups[2],
      },
    };

    return JSON.stringify(fullBackup);
  }

  async restoreFromFullBackup(backupStr: string): Promise<boolean> {
    try {
      const fullBackup = JSON.parse(backupStr);
      
      const results = await Promise.all([
        this.dataService.restoreFromBackup(fullBackup.services.data),
        this.positionService.restoreFromBackup(fullBackup.services.positions),
        this.marketDataService.restoreFromBackup(fullBackup.services.marketData),
      ]);

      return results.every(result => result);
    } catch (error) {
      console.error('Failed to restore from full backup:', error);
      return false;
    }
  }

  async getOverallStats() {
    if (!this.isInitialized) {
      throw new Error('PersistenceManager not initialized');
    }

    return {
      data: this.dataService.getStats(),
      positions: this.positionService.getStats(),
      marketData: this.marketDataService.getStats(),
    };
  }

  dispose(): void {
    this.dataService.dispose();
    this.positionService.dispose();
    this.marketDataService.dispose();
    this.isInitialized = false;
  }
}

// Utility functions for migration and data export

export async function exportAllData(manager: PersistenceManager): Promise<Blob> {
  const backup = await manager.createFullBackup();
  return new Blob([backup], { type: 'application/json' });
}

export async function importAllData(manager: PersistenceManager, file: File): Promise<boolean> {
  try {
    const text = await file.text();
    return await manager.restoreFromFullBackup(text);
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// Performance monitoring
export class PersistenceMonitor {
  private manager: PersistenceManager;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(manager: PersistenceManager) {
    this.manager = manager;
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const stats = await this.manager.getOverallStats();
        console.group('Persistence Monitor Report');
        console.log('Data Service:', stats.data);
        console.log('Position Service:', stats.positions);
        console.log('Market Data Service:', stats.marketData);
        console.groupEnd();
      } catch (error) {
        console.error('Monitoring failed:', error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}
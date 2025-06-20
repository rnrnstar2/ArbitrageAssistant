import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataBuffer } from '../data-buffer';
import { SequenceManager } from '../sequence-manager';
import { SyncQualityMonitor } from '../sync-quality-monitor';
import { DataSynchronizerImpl, dataSynchronizer } from '../data-synchronizer';
import { PositionUpdateData, AccountInfoData, MarketData, LosscutAlert, HeartbeatData } from '../message-types';

// Mock data for testing
const mockPositionData: PositionUpdateData = {
  positionId: 'pos_001',
  symbol: 'EURUSD',
  type: 'buy',
  lots: 0.1,
  openPrice: 1.1000,
  currentPrice: 1.1050,
  profit: 50.00,
  swapPoints: 0.5,
  commission: 2.0,
  status: 'open',
  openTime: new Date('2023-01-01T10:00:00Z'),
};

const mockAccountData: AccountInfoData = {
  balance: 10000,
  equity: 10050,
  freeMargin: 8000,
  marginLevel: 125.6,
  bonusAmount: 1000,
  profit: 50,
  credit: 0,
  marginUsed: 2000,
  currency: 'USD',
};

const mockMarketData: MarketData = {
  symbol: 'EURUSD',
  bid: 1.1050,
  ask: 1.1052,
  spread: 0.0002,
  marketStatus: 'open',
  lastUpdated: new Date(),
};

const mockLosscutAlert: LosscutAlert = {
  alertType: 'warning',
  marginLevel: 50,
  thresholdLevel: 30,
  affectedPositions: ['pos_001'],
  estimatedLoss: 500,
  message: 'Margin level approaching danger zone',
};

const mockHeartbeatData: HeartbeatData = {
  status: 'ok',
  connectionQuality: 95,
  lastActivity: new Date(),
};

describe('DataBuffer', () => {
  let dataBuffer: DataBuffer;

  beforeEach(() => {
    dataBuffer = new DataBuffer();
  });

  afterEach(() => {
    dataBuffer.destroy();
  });

  it('should add and retrieve data correctly', () => {
    const message = {
      version: '1.0',
      type: 'position_update' as const,
      timestamp: Date.now(),
      messageId: 'msg_001',
      accountId: 'acc_001',
      data: mockPositionData,
    };

    dataBuffer.addData(message);

    const retrievedData = dataBuffer.getData('position_update');
    expect(retrievedData).toHaveLength(1);
    expect(retrievedData[0].data).toEqual(mockPositionData);
  });

  it('should enforce buffer size limit', () => {
    const smallBuffer = new DataBuffer({ maxBufferSize: 5 });

    // Add more items than the buffer size
    for (let i = 0; i < 10; i++) {
      const message = {
        version: '1.0',
        type: 'position_update' as const,
        timestamp: Date.now() + i,
        messageId: `msg_${i}`,
        accountId: 'acc_001',
        data: { ...mockPositionData, positionId: `pos_${i}` },
      };
      smallBuffer.addData(message);
    }

    const data = smallBuffer.getData('position_update');
    expect(data.length).toBeLessThanOrEqual(5);

    smallBuffer.destroy();
  });

  it('should flush data correctly', () => {
    const message = {
      version: '1.0',
      type: 'account_update' as const,
      timestamp: Date.now(),
      messageId: 'msg_001',
      accountId: 'acc_001',
      data: mockAccountData,
    };

    dataBuffer.addData(message);
    expect(dataBuffer.getData('account_update')).toHaveLength(1);

    const flushedData = dataBuffer.flush('account_update');
    expect(flushedData).toHaveLength(1);
    expect(dataBuffer.getData('account_update')).toHaveLength(0);
  });

  it('should provide buffer statistics', () => {
    const message = {
      version: '1.0',
      type: 'market_data' as const,
      timestamp: Date.now(),
      messageId: 'msg_001',
      accountId: 'acc_001',
      data: mockMarketData,
    };

    dataBuffer.addData(message);

    const stats = dataBuffer.getStatistics();
    expect(stats.totalItems).toBe(1);
    expect(stats.itemsByType.market_data).toBe(1);
    expect(stats.memoryUsageMB).toBeGreaterThan(0);
  });
});

describe('SequenceManager', () => {
  let sequenceManager: SequenceManager;

  beforeEach(() => {
    sequenceManager = new SequenceManager();
  });

  it('should validate sequences correctly', () => {
    const dataItems = [
      {
        type: 'position_update' as const,
        data: mockPositionData,
        timestamp: new Date(),
        sequence: 1,
        messageId: 'msg_001',
        accountId: 'acc_001',
      },
      {
        type: 'position_update' as const,
        data: mockPositionData,
        timestamp: new Date(),
        sequence: 2,
        messageId: 'msg_002',
        accountId: 'acc_001',
      },
      {
        type: 'position_update' as const,
        data: mockPositionData,
        timestamp: new Date(),
        sequence: 4, // Missing sequence 3
        messageId: 'msg_004',
        accountId: 'acc_001',
      },
    ];

    const result = sequenceManager.validateSequence(dataItems);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain(3);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].start).toBe(3);
    expect(result.gaps[0].end).toBe(3);
  });

  it('should detect duplicate sequences', () => {
    const dataItems = [
      {
        type: 'position_update' as const,
        data: mockPositionData,
        timestamp: new Date(),
        sequence: 1,
        messageId: 'msg_001',
        accountId: 'acc_001',
      },
      {
        type: 'position_update' as const,
        data: mockPositionData,
        timestamp: new Date(),
        sequence: 1, // Duplicate
        messageId: 'msg_002',
        accountId: 'acc_001',
      },
    ];

    const result = sequenceManager.validateSequence(dataItems);
    expect(result.valid).toBe(false);
    expect(result.duplicates).toContain(1);
  });

  it('should handle missing data requests', async () => {
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    sequenceManager.setMissingDataHandler(mockHandler);

    const message = {
      version: '1.0',
      type: 'position_update' as const,
      timestamp: 3,
      messageId: 'msg_003',
      accountId: 'acc_001',
      data: mockPositionData,
    };

    // This should trigger a missing data request for sequences 1 and 2
    const result = sequenceManager.processMessage(message);
    
    expect(result.canProcess).toBe(false);
    // Note: In real implementation, the handler would be called asynchronously
  });
});

describe('SyncQualityMonitor', () => {
  let qualityMonitor: SyncQualityMonitor;

  beforeEach(() => {
    qualityMonitor = new SyncQualityMonitor();
  });

  it('should record sync metrics and calculate quality score', () => {
    const syncResult = {
      success: true,
      processed: 100,
      duplicates: 2,
      missing: 1,
      errors: 0,
      syncTime: 50,
      timestamp: new Date(),
      dataType: 'position_update' as const,
      accountId: 'acc_001',
    };

    qualityMonitor.recordSyncMetrics(syncResult);

    const qualityScore = qualityMonitor.calculateQualityScore();
    expect(qualityScore).toBeGreaterThan(0);
    expect(qualityScore).toBeLessThanOrEqual(100);
  });

  it('should generate quality reports', () => {
    const syncResults = [
      {
        success: true,
        processed: 100,
        duplicates: 1,
        missing: 0,
        errors: 0,
        syncTime: 50,
        timestamp: new Date(),
        dataType: 'position_update' as const,
        accountId: 'acc_001',
      },
      {
        success: false,
        processed: 50,
        duplicates: 0,
        missing: 5,
        errors: 1,
        syncTime: 200,
        timestamp: new Date(),
        dataType: 'account_update' as const,
        accountId: 'acc_002',
      },
    ];

    syncResults.forEach(result => {
      qualityMonitor.recordSyncMetrics(result);
    });

    const report = qualityMonitor.getQualityReport();

    expect(report.overall.totalOperations).toBe(2);
    expect(report.overall.successRate).toBe(50);
    expect(report.byDataType.size).toBe(2);
    expect(report.byAccount.size).toBe(2);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('should trigger alerts for quality issues', () => {
    const alertCallback = vi.fn();
    qualityMonitor.onAlert('high_latency', alertCallback);

    const slowSyncResult = {
      success: true,
      processed: 10,
      duplicates: 0,
      missing: 0,
      errors: 0,
      syncTime: 2000, // High latency
      timestamp: new Date(),
      dataType: 'position_update' as const,
      accountId: 'acc_001',
    };

    qualityMonitor.recordSyncMetrics(slowSyncResult);

    expect(alertCallback).toHaveBeenCalled();
  });
});

describe('DataSynchronizer', () => {
  let synchronizer: DataSynchronizerImpl;

  beforeEach(() => {
    synchronizer = new DataSynchronizerImpl({
      enableQualityMonitoring: true,
      enableSequenceValidation: true,
      batchSize: 10,
    });
  });

  afterEach(() => {
    synchronizer.destroy();
  });

  it('should sync position data successfully', async () => {
    const positionData = [mockPositionData];
    const result = await synchronizer.syncPositionData(positionData, 'acc_001');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.dataType).toBe('position_update');
    expect(result.accountId).toBe('acc_001');
  });

  it('should sync account data successfully', async () => {
    const accountData = [mockAccountData];
    const result = await synchronizer.syncAccountData(accountData, 'acc_001');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.dataType).toBe('account_update');
  });

  it('should sync market data successfully', async () => {
    const marketData = [mockMarketData];
    const result = await synchronizer.syncMarketData(marketData, 'acc_001');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.dataType).toBe('market_data');
  });

  it('should sync losscut alerts successfully', async () => {
    const alertData = [mockLosscutAlert];
    const result = await synchronizer.syncLosscutAlerts(alertData, 'acc_001');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.dataType).toBe('losscut_alert');
  });

  it('should sync heartbeat data successfully', async () => {
    const heartbeatData = [mockHeartbeatData];
    const result = await synchronizer.syncHeartbeatData(heartbeatData, 'acc_001');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.dataType).toBe('heartbeat');
  });

  it('should handle batch processing', async () => {
    const largeBatch = Array.from({ length: 25 }, (_, i) => ({
      ...mockPositionData,
      positionId: `pos_${i}`,
    }));

    const result = await synchronizer.syncPositionData(largeBatch, 'acc_001');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(25);
    expect(result.errors).toBe(0);
  });

  it('should provide sync status', async () => {
    // Sync some data first
    await synchronizer.syncPositionData([mockPositionData], 'acc_001');
    await synchronizer.syncAccountData([mockAccountData], 'acc_002');

    const status = await synchronizer.checkSyncStatus();

    expect(status.totalSynced).toBe(2);
    expect(status.qualityScore).toBeGreaterThan(0);
    expect(status.byDataType.size).toBeGreaterThan(0);
    expect(status.byAccount.size).toBe(2);
  });

  it('should handle event callbacks', async () => {
    const onSyncComplete = vi.fn();
    const onSyncError = vi.fn();
    const onQualityAlert = vi.fn();

    synchronizer.setEventHandlers({
      onSyncComplete,
      onSyncError,
      onQualityAlert,
    });

    await synchronizer.syncPositionData([mockPositionData], 'acc_001');

    expect(onSyncComplete).toHaveBeenCalled();
    expect(onSyncError).not.toHaveBeenCalled();
  });

  it('should generate quality reports', async () => {
    await synchronizer.syncPositionData([mockPositionData], 'acc_001');
    await synchronizer.syncAccountData([mockAccountData], 'acc_001');

    const report = synchronizer.getQualityReport();

    expect(report.overall.totalOperations).toBe(2);
    expect(report.period.start).toBeInstanceOf(Date);
    expect(report.period.end).toBeInstanceOf(Date);
    expect(report.byDataType.size).toBeGreaterThan(0);
  });

  it('should handle missing data handler', async () => {
    const mockMissingDataHandler = vi.fn().mockResolvedValue([]);
    synchronizer.setMissingDataHandler(mockMissingDataHandler);

    const result = await synchronizer.resyncData('position_update', 'acc_001');

    expect(result.dataType).toBe('position_update');
    expect(result.accountId).toBe('acc_001');
  });
});

describe('Integration Tests', () => {
  it('should work with the singleton instance', async () => {
    const result = await dataSynchronizer.syncPositionData([mockPositionData], 'test_account');

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);

    const status = await dataSynchronizer.checkSyncStatus();
    expect(status.totalSynced).toBeGreaterThan(0);
  });

  it('should handle complex data synchronization flow', async () => {
    const testAccountId = 'integration_test_account';
    
    // Sync different types of data
    const posResult = await dataSynchronizer.syncPositionData([mockPositionData], testAccountId);
    const accResult = await dataSynchronizer.syncAccountData([mockAccountData], testAccountId);
    const mktResult = await dataSynchronizer.syncMarketData([mockMarketData], testAccountId);

    expect(posResult.success).toBe(true);
    expect(accResult.success).toBe(true);
    expect(mktResult.success).toBe(true);

    // Check overall status
    const status = await dataSynchronizer.checkSyncStatus();
    expect(status.totalSynced).toBeGreaterThan(2);

    // Get quality report
    const report = dataSynchronizer.getQualityReport();
    expect(report.overall.totalOperations).toBeGreaterThan(2);
    expect(report.byDataType.size).toBeGreaterThan(2);
  });
});
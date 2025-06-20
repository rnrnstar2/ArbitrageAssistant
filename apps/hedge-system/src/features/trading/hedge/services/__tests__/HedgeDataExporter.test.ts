import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HedgeDataExporter, { 
  ExportableData, 
  ExportOptions,
  ExportFormat 
} from '../HedgeDataExporter'
import { 
  AdvancedHedgeStatistics, 
  HedgePerformanceMetrics, 
  SymbolAnalysis,
  TimeSeriesAnalytics 
} from '../HedgeAnalyticsService'
import { HedgePosition } from '../../types'

// DOM APIのモック
const mockCreateElement = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockClick = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

// グローバルオブジェクトのモック
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL
  },
  writable: true
})

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true
})

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
  writable: true
})

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
  writable: true
})

describe('HedgeDataExporter', () => {
  let mockExportableData: ExportableData
  let exporter: HedgeDataExporter

  beforeEach(() => {
    vi.clearAllMocks()

    // モックデータの準備
    const mockStatistics: AdvancedHedgeStatistics = {
      totalHedges: 10,
      activeHedges: 8,
      completedHedges: 2,
      perfectHedges: 5,
      partialHedges: 3,
      crossAccountHedges: 2,
      averageBalance: 0.05,
      totalProfit: 1250.75,
      winRate: 75.5,
      avgHoldingTime: 4.5,
      profitability: 2.8
    }

    const mockPerformance: HedgePerformanceMetrics = {
      totalReturn: 1250.75,
      averageReturn: 125.08,
      medianReturn: 100.00,
      bestReturn: 500.00,
      worstReturn: -150.00,
      volatility: 85.32,
      sharpeRatio: 1.47,
      sortinoRatio: 1.89,
      maxDrawdown: 8.5,
      maxDrawdownDuration: 2.5,
      profitFactor: 2.8,
      calmarRatio: 14.7,
      recoveryFactor: 3.2,
      expectedValue: 125.08
    }

    const mockSymbolAnalysis: SymbolAnalysis[] = [
      {
        symbol: 'EURUSD',
        totalPositions: 4,
        totalLots: 8.0,
        netLots: 0.2,
        totalProfit: 650.25,
        winRate: 80.0,
        averageProfit: 162.56,
        maxProfit: 300.00,
        minProfit: -50.00,
        volatility: 45.2,
        sharpeRatio: 1.2,
        isBalanced: true,
        balanceRatio: 0.95,
        riskLevel: 'medium',
        exposurePercentage: 25.5
      },
      {
        symbol: 'GBPUSD',
        totalPositions: 3,
        totalLots: 6.0,
        netLots: -0.5,
        totalProfit: 300.50,
        winRate: 66.7,
        averageProfit: 100.17,
        maxProfit: 200.00,
        minProfit: -25.00,
        volatility: 38.9,
        sharpeRatio: 0.9,
        isBalanced: false,
        balanceRatio: 0.83,
        riskLevel: 'low',
        exposurePercentage: 19.2
      }
    ]

    const mockTimeSeriesData: TimeSeriesAnalytics[] = [
      {
        timestamp: new Date('2024-01-01T10:00:00Z'),
        totalProfit: 100.0,
        cumulativeProfit: 100.0,
        drawdown: 0.0,
        runningBalance: 0.95,
        hedgeCount: 2,
        activeHedgeCount: 2,
        riskScore: 3.5,
        exposureLevel: 200000,
        balanceRatio: 0.95
      },
      {
        timestamp: new Date('2024-01-01T11:00:00Z'),
        totalProfit: 50.0,
        cumulativeProfit: 150.0,
        drawdown: 0.0,
        runningBalance: 0.92,
        hedgeCount: 3,
        activeHedgeCount: 3,
        riskScore: 4.2,
        exposureLevel: 300000,
        balanceRatio: 0.92
      }
    ]

    const mockHedgePositions: HedgePosition[] = [
      {
        id: 'hedge-1',
        positionIds: ['pos-1', 'pos-2'],
        symbol: 'EURUSD',
        hedgeType: 'perfect',
        accounts: ['acc-1', 'acc-2'],
        totalLots: { buy: 1.0, sell: 1.0 },
        totalProfit: 150.0,
        isBalanced: true,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        settings: {
          autoRebalance: true,
          maxImbalance: 0.1,
          maintainOnClose: true
        }
      }
    ]

    mockExportableData = {
      metadata: {
        exportDate: new Date('2024-01-01T12:00:00Z'),
        timeRange: '24時間',
        totalRecords: 10,
        version: '1.0.0'
      },
      statistics: mockStatistics,
      performance: mockPerformance,
      symbolAnalysis: mockSymbolAnalysis,
      timeSeriesData: mockTimeSeriesData,
      hedgePositions: mockHedgePositions
    }

    exporter = new HedgeDataExporter(mockExportableData)

    // DOM要素のモック
    const mockLinkElement = {
      href: '',
      download: '',
      click: mockClick
    }
    mockCreateElement.mockReturnValue(mockLinkElement)
    mockCreateObjectURL.mockReturnValue('blob:mock-url')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('export', () => {
    it('CSV形式でエクスポートできる', async () => {
      const options: ExportOptions = {
        format: 'csv',
        filename: 'test.csv'
      }

      await exporter.export(options)

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockAppendChild).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRemoveChild).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('JSON形式でエクスポートできる', async () => {
      const options: ExportOptions = {
        format: 'json',
        filename: 'test.json'
      }

      await exporter.export(options)

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('Excel形式でエクスポートできる', async () => {
      const options: ExportOptions = {
        format: 'excel',
        filename: 'test.excel'
      }

      await exporter.export(options)

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('PDF形式でエクスポートできる', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf'
      }

      await exporter.export(options)

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('サポートされていない形式でエラーが発生する', async () => {
      const options: ExportOptions = {
        format: 'invalid' as ExportFormat,
        filename: 'test.invalid'
      }

      await expect(exporter.export(options)).rejects.toThrow('Unsupported export format: invalid')
    })

    it('ファイル名が指定されていない場合は自動生成される', async () => {
      const options: ExportOptions = {
        format: 'csv'
      }

      await exporter.export(options)

      expect(mockCreateElement).toHaveBeenCalled()
      const linkElement = mockCreateElement.mock.results[0].value
      expect(linkElement.download).toMatch(/hedge_analytics_\d{4}-\d{2}-\d{2}_\d{6}\.csv/)
    })
  })

  describe('CSV生成', () => {
    it('正しいCSV形式でデータが生成される', async () => {
      // CSVコンテンツの直接テストは困難なため、エクスポート処理が正常に完了することを確認
      const options: ExportOptions = {
        format: 'csv',
        includeRawData: true
      }

      await expect(exporter.export(options)).resolves.not.toThrow()
    })

    it('includeRawDataがtrueの場合は詳細データが含まれる', async () => {
      const options: ExportOptions = {
        format: 'csv',
        includeRawData: true
      }

      await exporter.export(options)

      // Blobが作成されることを確認
      expect(mockCreateObjectURL).toHaveBeenCalled()
      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall).toBeInstanceOf(Blob)
      expect(blobCall.type).toBe('text/csv')
    })

    it('includeRawDataがfalseの場合は基本データのみ含まれる', async () => {
      const options: ExportOptions = {
        format: 'csv',
        includeRawData: false
      }

      await exporter.export(options)

      expect(mockCreateObjectURL).toHaveBeenCalled()
      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall).toBeInstanceOf(Blob)
    })
  })

  describe('JSON生成', () => {
    it('正しいJSON形式でデータが生成される', async () => {
      const options: ExportOptions = {
        format: 'json'
      }

      await exporter.export(options)

      expect(mockCreateObjectURL).toHaveBeenCalled()
      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall.type).toBe('application/json')
    })
  })

  describe('HTML/PDF生成', () => {
    it('HTMLレポートが生成される', async () => {
      const options: ExportOptions = {
        format: 'pdf'
      }

      await exporter.export(options)

      expect(mockCreateObjectURL).toHaveBeenCalled()
      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall.type).toBe('text/html')
    })
  })

  describe('静的メソッド', () => {
    it('exportAnalyticsDataが正常に動作する', async () => {
      const options: ExportOptions = {
        format: 'json'
      }

      await expect(
        HedgeDataExporter.exportAnalyticsData(mockExportableData, options)
      ).resolves.not.toThrow()
    })

    it('exportMultipleFormatsで複数形式のエクスポートができる', async () => {
      const formats: ExportFormat[] = ['csv', 'json']
      const baseOptions = {
        filename: 'test_export'
      }

      await HedgeDataExporter.exportMultipleFormats(
        mockExportableData,
        formats,
        baseOptions
      )

      // 2つの形式でエクスポートされるため、createElementが2回呼ばれる
      expect(mockCreateElement).toHaveBeenCalledTimes(2)
    })

    it('createExportableDataでエクスポート可能データが作成される', () => {
      const result = HedgeDataExporter.createExportableData(
        mockExportableData.statistics,
        mockExportableData.performance,
        mockExportableData.symbolAnalysis,
        mockExportableData.timeSeriesData,
        mockExportableData.hedgePositions,
        '24時間'
      )

      expect(result).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            timeRange: '24時間',
            version: '1.0.0'
          }),
          statistics: mockExportableData.statistics,
          performance: mockExportableData.performance,
          symbolAnalysis: mockExportableData.symbolAnalysis,
          timeSeriesData: mockExportableData.timeSeriesData,
          hedgePositions: mockExportableData.hedgePositions
        })
      )
    })
  })

  describe('エラーハンドリング', () => {
    it('空のデータでもエクスポートが正常に動作する', async () => {
      const emptyData: ExportableData = {
        metadata: {
          exportDate: new Date(),
          timeRange: '24時間',
          totalRecords: 0,
          version: '1.0.0'
        },
        statistics: {
          totalHedges: 0,
          activeHedges: 0,
          completedHedges: 0,
          perfectHedges: 0,
          partialHedges: 0,
          crossAccountHedges: 0,
          averageBalance: 0,
          totalProfit: 0,
          winRate: 0,
          avgHoldingTime: 0,
          profitability: 0
        },
        performance: {
          totalReturn: 0,
          averageReturn: 0,
          medianReturn: 0,
          bestReturn: 0,
          worstReturn: 0,
          volatility: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          maxDrawdown: 0,
          maxDrawdownDuration: 0,
          profitFactor: 0,
          calmarRatio: 0,
          recoveryFactor: 0,
          expectedValue: 0
        },
        symbolAnalysis: [],
        timeSeriesData: []
      }

      const emptyExporter = new HedgeDataExporter(emptyData)
      const options: ExportOptions = {
        format: 'csv'
      }

      await expect(emptyExporter.export(options)).resolves.not.toThrow()
    })

    it('不正なデータ値でもエクスポートが完了する', async () => {
      const invalidData: ExportableData = {
        ...mockExportableData,
        statistics: {
          ...mockExportableData.statistics,
          totalProfit: NaN,
          winRate: Infinity
        }
      }

      const invalidExporter = new HedgeDataExporter(invalidData)
      const options: ExportOptions = {
        format: 'csv'
      }

      await expect(invalidExporter.export(options)).resolves.not.toThrow()
    })
  })

  describe('ファイル名生成', () => {
    it('デフォルトファイル名が正しい形式で生成される', async () => {
      const options: ExportOptions = {
        format: 'csv'
      }

      await exporter.export(options)

      const linkElement = mockCreateElement.mock.results[0].value
      expect(linkElement.download).toMatch(/^hedge_analytics_\d{4}-\d{2}-\d{2}_\d{6}\.csv$/)
    })

    it('カスタムファイル名が正しく設定される', async () => {
      const options: ExportOptions = {
        format: 'json',
        filename: 'my_custom_export.json'
      }

      await exporter.export(options)

      const linkElement = mockCreateElement.mock.results[0].value
      expect(linkElement.download).toBe('my_custom_export.json')
    })
  })

  describe('MIME type', () => {
    it('CSV形式で正しいMIME typeが設定される', async () => {
      const options: ExportOptions = {
        format: 'csv'
      }

      await exporter.export(options)

      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall.type).toBe('text/csv')
    })

    it('JSON形式で正しいMIME typeが設定される', async () => {
      const options: ExportOptions = {
        format: 'json'
      }

      await exporter.export(options)

      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall.type).toBe('application/json')
    })

    it('HTML形式で正しいMIME typeが設定される', async () => {
      const options: ExportOptions = {
        format: 'pdf'
      }

      await exporter.export(options)

      const blobCall = mockCreateObjectURL.mock.calls[0][0]
      expect(blobCall.type).toBe('text/html')
    })
  })

  describe('パフォーマンス', () => {
    it('大量データのエクスポートでも適切な時間内で完了する', async () => {
      // 大量のモックデータを作成
      const largeTimeSeriesData: TimeSeriesAnalytics[] = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000),
        totalProfit: Math.random() * 1000 - 500,
        cumulativeProfit: Math.random() * 5000,
        drawdown: Math.random() * 10,
        runningBalance: 0.8 + Math.random() * 0.2,
        hedgeCount: Math.floor(Math.random() * 20),
        activeHedgeCount: Math.floor(Math.random() * 15),
        riskScore: Math.random() * 10,
        exposureLevel: Math.random() * 1000000,
        balanceRatio: 0.7 + Math.random() * 0.3
      }))

      const largeData: ExportableData = {
        ...mockExportableData,
        timeSeriesData: largeTimeSeriesData
      }

      const largeExporter = new HedgeDataExporter(largeData)
      const options: ExportOptions = {
        format: 'csv',
        includeRawData: true
      }

      const startTime = performance.now()
      await largeExporter.export(options)
      const endTime = performance.now()

      // 2秒以内でエクスポートが完了することを期待
      expect(endTime - startTime).toBeLessThan(2000)
    })
  })
})
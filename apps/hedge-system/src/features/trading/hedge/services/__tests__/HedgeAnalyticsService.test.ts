import { describe, it, expect, beforeEach } from 'vitest'
import HedgeAnalyticsService, {
  AdvancedHedgeStatistics,
  HedgePerformanceMetrics,
  SymbolAnalysis,
  TimeSeriesAnalytics
} from '../HedgeAnalyticsService'
import { HedgePosition } from '../../types'
import { Position } from '../../../close/types'

describe('HedgeAnalyticsService', () => {
  let service: HedgeAnalyticsService
  let mockHedgePositions: HedgePosition[]
  let mockPositions: Position[]

  beforeEach(() => {
    // モックデータの設定
    mockHedgePositions = [
      {
        id: 'hedge-1',
        positionIds: ['pos-1', 'pos-2'],
        symbol: 'EURUSD',
        hedgeType: 'perfect',
        accounts: ['acc-1', 'acc-2'],
        totalLots: { buy: 1.0, sell: 1.0 },
        totalProfit: 150.0,
        isBalanced: true,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2時間前
        settings: {
          autoRebalance: true,
          maxImbalance: 0.1,
          maintainOnClose: true
        }
      },
      {
        id: 'hedge-2',
        positionIds: ['pos-3', 'pos-4'],
        symbol: 'GBPUSD',
        hedgeType: 'partial',
        accounts: ['acc-1'],
        totalLots: { buy: 0.5, sell: 0.7 },
        totalProfit: -25.0,
        isBalanced: false,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4時間前
        settings: {
          autoRebalance: false,
          maxImbalance: 0.2,
          maintainOnClose: false
        }
      },
      {
        id: 'hedge-3',
        positionIds: ['pos-5', 'pos-6'],
        symbol: 'USDJPY',
        hedgeType: 'cross_account',
        accounts: ['acc-1', 'acc-3'],
        totalLots: { buy: 2.0, sell: 2.0 },
        totalProfit: 75.0,
        isBalanced: true,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1時間前
        settings: {
          autoRebalance: true,
          maxImbalance: 0.05,
          maintainOnClose: true
        }
      },
      {
        id: 'hedge-4',
        positionIds: ['pos-7', 'pos-8'],
        symbol: 'EURUSD',
        hedgeType: 'perfect',
        accounts: ['acc-2', 'acc-3'],
        totalLots: { buy: 1.5, sell: 1.5 },
        totalProfit: -50.0,
        isBalanced: true,
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30時間前（範囲外）
        settings: {
          autoRebalance: true,
          maxImbalance: 0.1,
          maintainOnClose: true
        }
      }
    ]

    mockPositions = []
    service = new HedgeAnalyticsService(mockHedgePositions, mockPositions)
  })

  describe('calculateBasicStatistics', () => {
    it('24時間以内の基本統計を正しく計算する', () => {
      const stats = service.calculateBasicStatistics(24)

      expect(stats.totalHedges).toBe(3) // 24時間以内は3つ
      expect(stats.activeHedges).toBe(2) // isBalanced=trueは2つ
      expect(stats.completedHedges).toBe(1) // isBalanced=falseは1つ
      expect(stats.perfectHedges).toBe(1) // perfectタイプは1つ
      expect(stats.partialHedges).toBe(1) // partialタイプは1つ
      expect(stats.crossAccountHedges).toBe(1) // cross_accountタイプは1つ
      expect(stats.totalProfit).toBe(200.0) // 150 + (-25) + 75
      expect(stats.winRate).toBeCloseTo(66.67, 2) // 3つ中2つが利益
    })

    it('時間窓を変更した場合の統計を正しく計算する', () => {
      const stats = service.calculateBasicStatistics(3) // 3時間以内

      expect(stats.totalHedges).toBe(2) // 3時間以内は2つ
      expect(stats.totalProfit).toBe(225.0) // 150 + 75
      expect(stats.winRate).toBe(100) // 両方とも利益
    })

    it('平均バランスを正しく計算する', () => {
      const stats = service.calculateBasicStatistics(24)

      // |1.0-1.0| + |0.5-0.7| + |2.0-2.0| = 0 + 0.2 + 0 = 0.2
      // 平均 = 0.2 / 3 = 0.0667
      expect(stats.averageBalance).toBeCloseTo(0.0667, 4)
    })

    it('空のデータに対して適切なデフォルト値を返す', () => {
      const emptyService = new HedgeAnalyticsService([], [])
      const stats = emptyService.calculateBasicStatistics(24)

      expect(stats.totalHedges).toBe(0)
      expect(stats.activeHedges).toBe(0)
      expect(stats.totalProfit).toBe(0)
      expect(stats.winRate).toBe(0)
      expect(stats.averageBalance).toBe(0)
    })
  })

  describe('calculatePerformanceMetrics', () => {
    it('パフォーマンス指標を正しく計算する', () => {
      const performance = service.calculatePerformanceMetrics(24)

      expect(performance.totalReturn).toBe(200.0)
      expect(performance.averageReturn).toBeCloseTo(66.67, 2) // 200/3
      expect(performance.bestReturn).toBe(150.0)
      expect(performance.worstReturn).toBe(-25.0)
      expect(performance.volatility).toBeGreaterThan(0)
    })

    it('プロフィットファクターを正しく計算する', () => {
      const performance = service.calculatePerformanceMetrics(24)

      // 利益: 150 + 75 = 225
      // 損失: 25
      // プロフィットファクター: 225/25 = 9
      expect(performance.profitFactor).toBe(9.0)
    })

    it('空のデータに対して適切なデフォルト値を返す', () => {
      const emptyService = new HedgeAnalyticsService([], [])
      const performance = emptyService.calculatePerformanceMetrics(24)

      expect(performance.totalReturn).toBe(0)
      expect(performance.averageReturn).toBe(0)
      expect(performance.bestReturn).toBe(0)
      expect(performance.worstReturn).toBe(0)
      expect(performance.volatility).toBe(0)
      expect(performance.profitFactor).toBe(0)
    })

    it('損失のみのデータでプロフィットファクターがInfinityにならない', () => {
      const lossOnlyHedges: HedgePosition[] = [
        {
          ...mockHedgePositions[0],
          totalProfit: -100.0
        },
        {
          ...mockHedgePositions[1],
          totalProfit: -50.0
        }
      ]

      const lossService = new HedgeAnalyticsService(lossOnlyHedges, [])
      const performance = lossService.calculatePerformanceMetrics(24)

      expect(performance.profitFactor).toBe(0)
    })
  })

  describe('calculateRiskAnalysis', () => {
    it('リスク分析を正しく計算する', () => {
      const riskAnalysis = service.calculateRiskAnalysis()

      // 総エクスポージャー: (1.0+1.0 + 0.5+0.7 + 2.0+2.0 + 1.5+1.5) * 100000
      const expectedTotalExposure = (2.0 + 1.2 + 4.0 + 3.0) * 100000
      expect(riskAnalysis.totalExposure).toBe(expectedTotalExposure)

      // ネットエクスポージャー: (|1.0-1.0| + |0.5-0.7| + |2.0-2.0| + |1.5-1.5|) * 100000
      const expectedNetExposure = (0 + 0.2 + 0 + 0) * 100000
      expect(riskAnalysis.netExposure).toBe(expectedNetExposure)

      expect(riskAnalysis.maxPositionSize).toBe(3.0) // 最大は1.5+1.5
      expect(riskAnalysis.diversificationRatio).toBeCloseTo(0.75, 2) // 3通貨ペア/4ヘッジ
    })

    it('多様化比率を正しく計算する', () => {
      const riskAnalysis = service.calculateRiskAnalysis()

      // 通貨ペア: EURUSD, GBPUSD, USDJPY = 3種類
      // ヘッジ数: 4つ
      // 多様化比率: 3/4 = 0.75
      expect(riskAnalysis.diversificationRatio).toBe(0.75)
    })
  })

  describe('calculateSymbolAnalysis', () => {
    it('通貨ペア別分析を正しく計算する', () => {
      const symbolAnalysis = service.calculateSymbolAnalysis()

      expect(symbolAnalysis).toHaveLength(3) // EURUSD, GBPUSD, USDJPY

      // EURUSD の分析
      const eurUsdAnalysis = symbolAnalysis.find(s => s.symbol === 'EURUSD')
      expect(eurUsdAnalysis).toBeDefined()
      expect(eurUsdAnalysis!.totalPositions).toBe(2)
      expect(eurUsdAnalysis!.totalProfit).toBe(100.0) // 150 + (-50)
      expect(eurUsdAnalysis!.winRate).toBe(50) // 2つ中1つが利益

      // GBPUSD の分析
      const gbpUsdAnalysis = symbolAnalysis.find(s => s.symbol === 'GBPUSD')
      expect(gbpUsdAnalysis).toBeDefined()
      expect(gbpUsdAnalysis!.totalPositions).toBe(1)
      expect(gbpUsdAnalysis!.totalProfit).toBe(-25.0)
      expect(gbpUsdAnalysis!.winRate).toBe(0)

      // USDJPY の分析
      const usdJpyAnalysis = symbolAnalysis.find(s => s.symbol === 'USDJPY')
      expect(usdJpyAnalysis).toBeDefined()
      expect(usdJpyAnalysis!.totalPositions).toBe(1)
      expect(usdJpyAnalysis!.totalProfit).toBe(75.0)
      expect(usdJpyAnalysis!.winRate).toBe(100)
    })

    it('バランス比率を正しく計算する', () => {
      const symbolAnalysis = service.calculateSymbolAnalysis()

      const gbpUsdAnalysis = symbolAnalysis.find(s => s.symbol === 'GBPUSD')
      expect(gbpUsdAnalysis).toBeDefined()
      
      // 買い: 0.5, 売り: 0.7
      // バランス比率: min(0.5, 0.7) / max(0.5, 0.7) = 0.5/0.7 ≈ 0.714
      expect(gbpUsdAnalysis!.balanceRatio).toBeCloseTo(0.714, 3)
      expect(gbpUsdAnalysis!.isBalanced).toBe(false) // 0.714 < 0.9
    })

    it('リスクレベルを正しく判定する', () => {
      const symbolAnalysis = service.calculateSymbolAnalysis()

      // エクスポージャーが高い通貨ペアは高リスクになるはず
      const usdJpyAnalysis = symbolAnalysis.find(s => s.symbol === 'USDJPY')
      expect(usdJpyAnalysis!.riskLevel).toBe('high') // 4.0ロットは高リスク
    })
  })

  describe('generateTimeSeriesAnalytics', () => {
    it('時系列データを正しく生成する', () => {
      const timeSeriesData = service.generateTimeSeriesAnalytics(24, 10)

      expect(timeSeriesData).toHaveLength(10)
      
      timeSeriesData.forEach(point => {
        expect(point.timestamp).toBeInstanceOf(Date)
        expect(typeof point.totalProfit).toBe('number')
        expect(typeof point.cumulativeProfit).toBe('number')
        expect(typeof point.drawdown).toBe('number')
        expect(typeof point.hedgeCount).toBe('number')
        expect(typeof point.riskScore).toBe('number')
        expect(point.drawdown).toBeGreaterThanOrEqual(0)
      })
    })

    it('時系列データが時間順になっている', () => {
      const timeSeriesData = service.generateTimeSeriesAnalytics(24, 5)

      for (let i = 1; i < timeSeriesData.length; i++) {
        expect(timeSeriesData[i].timestamp.getTime()).toBeGreaterThan(
          timeSeriesData[i - 1].timestamp.getTime()
        )
      }
    })
  })

  describe('プライベートメソッドのテスト（間接的）', () => {
    it('ボラティリティ計算が正常に動作する', () => {
      const performance = service.calculatePerformanceMetrics(24)
      
      // ボラティリティは正の値であるべき
      expect(performance.volatility).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(performance.volatility)).toBe(true)
    })

    it('相関リスクの推定が正常に動作する', () => {
      const riskAnalysis = service.calculateRiskAnalysis()
      
      // 相関リスクは0-1の範囲であるべき
      expect(riskAnalysis.correlationRisk).toBeGreaterThanOrEqual(0)
      expect(riskAnalysis.correlationRisk).toBeLessThanOrEqual(1)
    })

    it('通貨ペアの共通通貨検出が正常に動作する', () => {
      // EURUSD と EURGBP は EUR を共有している
      // EURUSD と GBPUSD は USD を共有している
      // この内部ロジックが correlationRisk に反映されているはず
      const riskAnalysis = service.calculateRiskAnalysis()
      
      expect(typeof riskAnalysis.correlationRisk).toBe('number')
    })
  })

  describe('エッジケースとエラーハンドリング', () => {
    it('NaN値を含むデータでも正常に処理する', () => {
      const invalidHedges: HedgePosition[] = [
        {
          ...mockHedgePositions[0],
          totalProfit: NaN
        }
      ]

      const invalidService = new HedgeAnalyticsService(invalidHedges, [])
      
      expect(() => {
        invalidService.calculateBasicStatistics(24)
      }).not.toThrow()

      expect(() => {
        invalidService.calculatePerformanceMetrics(24)
      }).not.toThrow()
    })

    it('非常に大きな数値でも正常に処理する', () => {
      const largeHedges: HedgePosition[] = [
        {
          ...mockHedgePositions[0],
          totalProfit: 1e10,
          totalLots: { buy: 1e6, sell: 1e6 }
        }
      ]

      const largeService = new HedgeAnalyticsService(largeHedges, [])
      const stats = largeService.calculateBasicStatistics(24)
      
      expect(Number.isFinite(stats.totalProfit)).toBe(true)
      expect(Number.isFinite(stats.averageBalance)).toBe(true)
    })

    it('負の時間窓でも適切に処理する', () => {
      expect(() => {
        service.calculateBasicStatistics(-24)
      }).not.toThrow()
    })

    it('ゼロ時間窓でも適切に処理する', () => {
      const stats = service.calculateBasicStatistics(0)
      expect(stats.totalHedges).toBe(0)
    })
  })

  describe('パフォーマンス', () => {
    it('大量データでも適切な時間内で処理が完了する', () => {
      const largeHedgePositions: HedgePosition[] = Array.from({ length: 10000 }, (_, i) => ({
        ...mockHedgePositions[0],
        id: `hedge-${i}`,
        totalProfit: Math.random() * 200 - 100,
        createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
      }))

      const largeService = new HedgeAnalyticsService(largeHedgePositions, [])

      const startTime = performance.now()
      largeService.calculateBasicStatistics(24)
      largeService.calculatePerformanceMetrics(24)
      largeService.calculateRiskAnalysis()
      largeService.calculateSymbolAnalysis()
      const endTime = performance.now()

      // 1秒以内で処理が完了することを期待
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })
})
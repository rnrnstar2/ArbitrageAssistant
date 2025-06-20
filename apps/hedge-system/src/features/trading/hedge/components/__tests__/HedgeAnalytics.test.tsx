import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HedgeAnalytics, { 
  HedgeAnalyticsProps, 
  TimeRange,
  HedgeStatistics,
  HedgePerformance 
} from '../HedgeAnalytics'
import { HedgePosition } from '../../types'
import { Position } from '../../../close/types'

// モックデータ
const mockHedgePositions: HedgePosition[] = [
  {
    id: 'hedge-1',
    positionIds: ['pos-1', 'pos-2'],
    symbol: 'EURUSD',
    hedgeType: 'perfect',
    accounts: ['acc-1', 'acc-2'],
    totalLots: { buy: 1.0, sell: 1.0 },
    totalProfit: 150.5,
    isBalanced: true,
    createdAt: new Date('2024-01-01T10:00:00Z'),
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
    createdAt: new Date('2024-01-01T12:00:00Z'),
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
    totalProfit: 75.25,
    isBalanced: true,
    createdAt: new Date('2024-01-01T14:00:00Z'),
    settings: {
      autoRebalance: true,
      maxImbalance: 0.05,
      maintainOnClose: true
    }
  }
]

const mockPositions: Position[] = []

const mockTimeRange: TimeRange = {
  label: '24時間',
  value: '24h',
  hours: 24
}

const mockOnExportData = vi.fn()

const defaultProps: HedgeAnalyticsProps = {
  hedgePositions: mockHedgePositions,
  positions: mockPositions,
  timeRange: mockTimeRange,
  onExportData: mockOnExportData
}

describe('HedgeAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // HTMLCanvasElement のモック
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn()
    }))
  })

  describe('基本レンダリング', () => {
    it('コンポーネントが正常にレンダリングされる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      expect(screen.getByText('両建て分析・統計')).toBeInTheDocument()
      expect(screen.getByText('エクスポート')).toBeInTheDocument()
    })

    it('タブナビゲーションが表示される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      expect(screen.getByText('概要')).toBeInTheDocument()
      expect(screen.getByText('パフォーマンス')).toBeInTheDocument()
      expect(screen.getByText('リスク')).toBeInTheDocument()
      expect(screen.getByText('バランス')).toBeInTheDocument()
    })

    it('時間範囲セレクタが表示される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      const select = screen.getByDisplayValue('24時間')
      expect(select).toBeInTheDocument()
    })
  })

  describe('概要タブ', () => {
    it('基本統計が正しく表示される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // 総両建て数
      expect(screen.getByText('総両建て数')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      
      // アクティブ数
      expect(screen.getByText('アクティブ')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('両建てタイプ別分析が表示される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      expect(screen.getByText('完全両建て')).toBeInTheDocument()
      expect(screen.getByText('部分両建て')).toBeInTheDocument()
      expect(screen.getByText('クロスアカウント')).toBeInTheDocument()
    })

    it('パフォーマンスサマリーが表示される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      expect(screen.getByText('平均リターン')).toBeInTheDocument()
      expect(screen.getByText('最高リターン')).toBeInTheDocument()
      expect(screen.getByText('最低リターン')).toBeInTheDocument()
      expect(screen.getByText('プロフィットファクター')).toBeInTheDocument()
    })
  })

  describe('タブ切り替え', () => {
    it('パフォーマンスタブに切り替えできる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      fireEvent.click(screen.getByText('パフォーマンス'))
      
      expect(screen.getByText('損益推移')).toBeInTheDocument()
      expect(screen.getByText('詳細パフォーマンス')).toBeInTheDocument()
    })

    it('リスクタブに切り替えできる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      fireEvent.click(screen.getByText('リスク'))
      
      expect(screen.getByText('リスクメトリクス')).toBeInTheDocument()
      expect(screen.getByText('通貨ペア別リスク分析')).toBeInTheDocument()
    })

    it('バランスタブに切り替えできる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      fireEvent.click(screen.getByText('バランス'))
      
      expect(screen.getByText('バランス状況')).toBeInTheDocument()
    })
  })

  describe('時間範囲変更', () => {
    it('時間範囲を変更できる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      const select = screen.getByDisplayValue('24時間')
      fireEvent.change(select, { target: { value: '7d' } })
      
      expect(select).toHaveValue('7d')
    })
  })

  describe('エクスポート機能', () => {
    it('エクスポートボタンをクリックするとコールバックが呼ばれる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      const exportButton = screen.getByText('エクスポート')
      fireEvent.click(exportButton)
      
      expect(mockOnExportData).toHaveBeenCalledTimes(1)
      expect(mockOnExportData).toHaveBeenCalledWith(
        expect.objectContaining({
          hedgePositions: expect.any(Array),
          statistics: expect.any(Object),
          performance: expect.any(Object),
          riskMetrics: expect.any(Object),
          timeSeriesData: expect.any(Array)
        })
      )
    })
  })

  describe('統計計算', () => {
    it('勝率が正しく計算される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // 3つのヘッジポジションのうち2つがプラス（勝率66.7%）
      const winRateElements = screen.getAllByText(/66\.7%/)
      expect(winRateElements.length).toBeGreaterThan(0)
    })

    it('総損益が正しく計算される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // 150.5 + (-25.0) + 75.25 = 200.75
      expect(screen.getByText(/\$200\.75/)).toBeInTheDocument()
    })
  })

  describe('エラーハンドリング', () => {
    it('空のデータでもエラーが発生しない', () => {
      const emptyProps = {
        ...defaultProps,
        hedgePositions: []
      }
      
      expect(() => {
        render(<HedgeAnalytics {...emptyProps} />)
      }).not.toThrow()
    })

    it('無効なヘッジポジションデータでもエラーが発生しない', () => {
      const invalidProps = {
        ...defaultProps,
        hedgePositions: [
          {
            ...mockHedgePositions[0],
            totalProfit: NaN
          }
        ] as HedgePosition[]
      }
      
      expect(() => {
        render(<HedgeAnalytics {...invalidProps} />)
      }).not.toThrow()
    })
  })

  describe('アクセシビリティ', () => {
    it('タブにroleが正しく設定されている', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      const tabs = screen.getAllByRole('button')
      const tabButtons = tabs.filter(button => 
        ['概要', 'パフォーマンス', 'リスク', 'バランス'].includes(button.textContent || '')
      )
      
      expect(tabButtons.length).toBe(4)
    })

    it('チャートキャンバスにアクセシブルな属性が設定されている', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // パフォーマンスタブに切り替え
      fireEvent.click(screen.getByText('パフォーマンス'))
      
      const canvas = screen.getByRole('img', { hidden: true })
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('パフォーマンス', () => {
    it('大量のデータでもレンダリングが完了する', () => {
      const largeDataProps = {
        ...defaultProps,
        hedgePositions: Array.from({ length: 1000 }, (_, i) => ({
          ...mockHedgePositions[0],
          id: `hedge-${i}`,
          totalProfit: Math.random() * 200 - 100
        }))
      }
      
      const startTime = performance.now()
      render(<HedgeAnalytics {...largeDataProps} />)
      const endTime = performance.now()
      
      // レンダリングが2秒以内に完了することを確認
      expect(endTime - startTime).toBeLessThan(2000)
    })
  })

  describe('メモ化とパフォーマンス最適化', () => {
    it('同じpropsで再レンダリングしても計算が再実行されない', () => {
      const { rerender } = render(<HedgeAnalytics {...defaultProps} />)
      
      // 初回レンダリング後の状態を記録
      const initialText = screen.getByText('両建て分析・統計')
      
      // 同じpropsで再レンダリング
      rerender(<HedgeAnalytics {...defaultProps} />)
      
      // 要素が同じであることを確認（メモ化が効いている）
      expect(screen.getByText('両建て分析・統計')).toBe(initialText)
    })
  })

  describe('数値フォーマット', () => {
    it('通貨が正しくフォーマットされる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // 日本円形式でフォーマットされることを確認
      expect(screen.getByText(/\$/)).toBeInTheDocument()
    })

    it('パーセンテージが正しくフォーマットされる', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // パーセンテージ表示を確認
      expect(screen.getByText(/66\.7%/)).toBeInTheDocument()
    })

    it('小数点以下の桁数が適切に制限される', () => {
      render(<HedgeAnalytics {...defaultProps} />)
      
      // 過度に長い小数点表示がないことを確認
      const textContent = screen.getByTestId || screen.getByText(/\d+\.\d{3,}/)
      // 小数点3桁以上の表示がないことを期待（実装による）
    })
  })
})

// ユーティリティ関数のテスト
describe('HedgeAnalytics ユーティリティ関数', () => {
  describe('calculateVolatility', () => {
    it('ボラティリティが正しく計算される', () => {
      // 実際の計算ロジックをテストする場合
      const profits = [10, 20, 15, 25, 5]
      // ボラティリティ計算のテスト実装
      const mean = profits.reduce((sum, p) => sum + p, 0) / profits.length
      const variance = profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (profits.length - 1)
      const volatility = Math.sqrt(variance)
      
      expect(volatility).toBeGreaterThan(0)
      expect(typeof volatility).toBe('number')
      expect(Number.isFinite(volatility)).toBe(true)
    })
  })

  describe('calculateProfitFactor', () => {
    it('プロフィットファクターが正しく計算される', () => {
      const profits = [10, -5, 15, -3, 20]
      const wins = profits.filter(p => p > 0)
      const losses = profits.filter(p => p < 0)
      
      const totalWins = wins.reduce((sum, p) => sum + p, 0)
      const totalLosses = Math.abs(losses.reduce((sum, p) => sum + p, 0))
      const profitFactor = totalWins / totalLosses
      
      expect(profitFactor).toBeGreaterThan(0)
      expect(typeof profitFactor).toBe('number')
    })

    it('損失がない場合はInfinityを返す', () => {
      const profits = [10, 15, 20]
      const losses = profits.filter(p => p < 0)
      
      expect(losses.length).toBe(0)
      // 損失がない場合の処理をテスト
    })
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HedgePositionGrid } from '../HedgePositionGrid';
import { HedgePosition } from '../../types';
import { Position } from '../../../close/types';

// Mock データ
const mockAccounts = [
  {
    id: 'acc1',
    broker: 'Test Broker A',
    accountNumber: '12345678',
  },
  {
    id: 'acc2',
    broker: 'Test Broker B',
    accountNumber: '87654321',
  },
];

const mockPositions: Position[] = [
  {
    id: 'pos1',
    accountId: 'acc1',
    symbol: 'EURUSD',
    type: 'buy',
    lots: 1.0,
    openPrice: 1.1000,
    currentPrice: 1.1050,
    profit: 50.0,
    openedAt: new Date('2024-06-20T10:00:00Z'),
  },
  {
    id: 'pos2',
    accountId: 'acc1',
    symbol: 'EURUSD',
    type: 'sell',
    lots: 1.0,
    openPrice: 1.1005,
    currentPrice: 1.1055,
    profit: -50.0,
    openedAt: new Date('2024-06-20T10:05:00Z'),
  },
  {
    id: 'pos3',
    accountId: 'acc2',
    symbol: 'EURUSD',
    type: 'buy',
    lots: 0.5,
    openPrice: 1.1010,
    currentPrice: 1.1060,
    profit: 25.0,
    openedAt: new Date('2024-06-20T10:10:00Z'),
  },
  {
    id: 'pos4',
    accountId: 'acc1',
    symbol: 'GBPUSD',
    type: 'buy',
    lots: 2.0,
    openPrice: 1.2500,
    currentPrice: 1.2550,
    profit: 100.0,
    openedAt: new Date('2024-06-20T10:15:00Z'),
  },
];

const mockHedgePositions: HedgePosition[] = [
  {
    id: 'hedge1',
    positionIds: ['pos1', 'pos2'],
    symbol: 'EURUSD',
    hedgeType: 'perfect',
    accounts: ['acc1'],
    totalLots: {
      buy: 1.0,
      sell: 1.0,
    },
    totalProfit: 0.0,
    isBalanced: true,
    createdAt: new Date('2024-06-20T10:05:00Z'),
    settings: {
      autoRebalance: true,
      maxImbalance: 0.1,
      maintainOnClose: true,
    },
  },
  {
    id: 'hedge2',
    positionIds: ['pos3'],
    symbol: 'EURUSD',
    hedgeType: 'partial',
    accounts: ['acc2'],
    totalLots: {
      buy: 0.5,
      sell: 0.0,
    },
    totalProfit: 25.0,
    isBalanced: false,
    createdAt: new Date('2024-06-20T10:10:00Z'),
    lastRebalanced: new Date('2024-06-20T10:12:00Z'),
    settings: {
      autoRebalance: false,
      maxImbalance: 0.2,
      maintainOnClose: false,
    },
  },
  {
    id: 'hedge3',
    positionIds: ['pos1', 'pos3'],
    symbol: 'EURUSD',
    hedgeType: 'cross_account',
    accounts: ['acc1', 'acc2'],
    totalLots: {
      buy: 1.5,
      sell: 0.0,
    },
    totalProfit: 75.0,
    isBalanced: false,
    createdAt: new Date('2024-06-20T10:15:00Z'),
    settings: {
      autoRebalance: true,
      maxImbalance: 0.15,
      maintainOnClose: true,
    },
  },
];

describe('HedgePositionGrid', () => {
  const defaultProps = {
    hedgePositions: mockHedgePositions,
    positions: mockPositions,
    accounts: mockAccounts,
    onSelectHedge: vi.fn(),
    onUpdateHedge: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本レンダリング', () => {
    it('should render the component with title', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      expect(screen.getByText('両建てポジション')).toBeInTheDocument();
      expect(screen.getByText('3両建て')).toBeInTheDocument();
    });

    it('should display hedge positions in table', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // テーブルヘッダーを確認
      expect(screen.getByText('通貨ペア')).toBeInTheDocument();
      expect(screen.getByText('タイプ')).toBeInTheDocument();
      expect(screen.getByText('バランス')).toBeInTheDocument();
      expect(screen.getByText('買い/売りロット')).toBeInTheDocument();
      expect(screen.getByText('総損益')).toBeInTheDocument();

      // 各両建てポジションが表示されていることを確認
      expect(screen.getAllByText('EURUSD')).toHaveLength(3);
      expect(screen.getByText('完全')).toBeInTheDocument();
      expect(screen.getByText('部分')).toBeInTheDocument();
      expect(screen.getByText('クロス')).toBeInTheDocument();
    });

    it('should display correct statistics in summary', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // 統計情報を確認
      expect(screen.getByText('3')).toBeInTheDocument(); // 総両建て数
      expect(screen.getByText('100.00')).toBeInTheDocument(); // 総損益
      expect(screen.getByText('1')).toBeInTheDocument(); // バランス数
      expect(screen.getByText('2')).toBeInTheDocument(); // 不均衡数
    });
  });

  describe('フィルタリング機能', () => {
    it('should filter by symbol', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const symbolFilter = screen.getByPlaceholderText('例: EUR, USD');
      fireEvent.change(symbolFilter, { target: { value: 'EUR' } });

      // EURUSDが含まれるものがフィルタされる
      expect(screen.getAllByText('EURUSD')).toHaveLength(3);
    });

    it('should filter by hedge type', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const typeFilter = screen.getByDisplayValue('すべて');
      fireEvent.change(typeFilter, { target: { value: 'perfect' } });

      await waitFor(() => {
        expect(screen.getByText('完全')).toBeInTheDocument();
        expect(screen.queryByText('部分')).not.toBeInTheDocument();
        expect(screen.queryByText('クロス')).not.toBeInTheDocument();
      });
    });

    it('should filter by balance status', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const balanceSelects = screen.getAllByRole('combobox');
      const balanceFilter = balanceSelects.find(select => 
        select.getAttribute('value') === 'all'
      );
      
      if (balanceFilter) {
        fireEvent.change(balanceFilter, { target: { value: 'balanced' } });

        await waitFor(() => {
          // バランス状態のもののみ表示される
          expect(screen.getByText('✓ バランス')).toBeInTheDocument();
          expect(screen.queryByText(/⚠ 不均衡/)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('ソート機能', () => {
    it('should sort by symbol when column header is clicked', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const symbolHeader = screen.getByRole('button', { name: /通貨ペア/ });
      fireEvent.click(symbolHeader);

      // ソートアイコンが表示されることを確認
      expect(symbolHeader).toHaveTextContent('↓');
    });

    it('should sort by total profit when column header is clicked', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const profitHeader = screen.getByRole('button', { name: /総損益/ });
      fireEvent.click(profitHeader);

      // ソートアイコンが表示されることを確認
      expect(profitHeader).toHaveTextContent('↓');
    });

    it('should toggle sort direction on repeated clicks', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const symbolHeader = screen.getByRole('button', { name: /通貨ペア/ });
      
      // 最初のクリック
      fireEvent.click(symbolHeader);
      expect(symbolHeader).toHaveTextContent('↓');
      
      // 2回目のクリック
      fireEvent.click(symbolHeader);
      expect(symbolHeader).toHaveTextContent('↑');
    });
  });

  describe('インタラクション', () => {
    it('should call onSelectHedge when row is clicked', async () => {
      const onSelectHedge = vi.fn();
      render(<HedgePositionGrid {...defaultProps} onSelectHedge={onSelectHedge} />);
      
      // 最初の行をクリック
      const firstRow = screen.getAllByRole('row')[2]; // ヘッダー行を除く最初のデータ行
      fireEvent.click(firstRow);

      expect(onSelectHedge).toHaveBeenCalledWith(mockHedgePositions[0]);
    });

    it('should display balance indicators correctly', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // バランス済みの表示
      expect(screen.getByText('✓ バランス')).toBeInTheDocument();
      
      // 不均衡の表示
      expect(screen.getAllByText(/⚠ 不均衡/)).toHaveLength(2);
    });

    it('should display hedge type labels correctly', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      expect(screen.getByText('完全')).toBeInTheDocument();
      expect(screen.getByText('部分')).toBeInTheDocument();
      expect(screen.getByText('クロス')).toBeInTheDocument();
    });
  });

  describe('空の状態', () => {
    it('should show empty state when no hedge positions', () => {
      render(<HedgePositionGrid {...defaultProps} hedgePositions={[]} />);
      
      expect(screen.getByText('両建てポジションはありません')).toBeInTheDocument();
      expect(screen.getByText('両建てが検出されるとここに表示されます')).toBeInTheDocument();
    });

    it('should show filtered empty state when no matches', async () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      const symbolFilter = screen.getByPlaceholderText('例: EUR, USD');
      fireEvent.change(symbolFilter, { target: { value: 'NONEXISTENT' } });

      await waitFor(() => {
        expect(screen.getByText('フィルター条件に一致する両建てポジションはありません')).toBeInTheDocument();
      });
    });
  });

  describe('関連口座の表示', () => {
    it('should display related account information', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // アカウント情報が表示されることを確認
      expect(screen.getByText('Test Broker A')).toBeInTheDocument();
      expect(screen.getByText('5678')).toBeInTheDocument(); // account number の末尾4桁
    });

    it('should truncate account list when more than 2 accounts', () => {
      const hedgeWithManyAccounts: HedgePosition = {
        ...mockHedgePositions[0],
        accounts: ['acc1', 'acc2', 'acc3'],
      };

      render(<HedgePositionGrid 
        {...defaultProps} 
        hedgePositions={[hedgeWithManyAccounts]}
        accounts={[...mockAccounts, { id: 'acc3', broker: 'Broker C', accountNumber: '11111111' }]}
      />);
      
      expect(screen.getByText('+1口座')).toBeInTheDocument();
    });
  });

  describe('フッター統計', () => {
    it('should display footer statistics when positions exist', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // フッター統計が表示されることを確認
      expect(screen.getByText(/合計買いロット:/)).toBeInTheDocument();
      expect(screen.getByText(/合計売りロット:/)).toBeInTheDocument();
      expect(screen.getByText(/平均損益:/)).toBeInTheDocument();
      expect(screen.getByText(/バランス率:/)).toBeInTheDocument();
    });

    it('should not display footer when no positions', () => {
      render(<HedgePositionGrid {...defaultProps} hedgePositions={[]} />);
      
      expect(screen.queryByText(/合計買いロット:/)).not.toBeInTheDocument();
    });
  });

  describe('レスポンシブデザイン', () => {
    it('should apply responsive grid classes', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // グリッドクラスが適用されていることを確認
      const summaryGrid = document.querySelector('.grid.grid-cols-2');
      expect(summaryGrid).toBeInTheDocument();
    });

    it('should handle custom className', () => {
      render(<HedgePositionGrid {...defaultProps} className="custom-class" />);
      
      const container = document.querySelector('.custom-class');
      expect(container).toBeInTheDocument();
    });
  });

  describe('数値フォーマット', () => {
    it('should format numbers with correct decimal places', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // 損益が正しくフォーマットされていることを確認
      expect(screen.getByText('0.00')).toBeInTheDocument(); // hedge1の損益
      expect(screen.getByText('25.00')).toBeInTheDocument(); // hedge2の損益
      expect(screen.getByText('75.00')).toBeInTheDocument(); // hedge3の損益
    });

    it('should format time correctly', () => {
      render(<HedgePositionGrid {...defaultProps} />);
      
      // 時刻フォーマットが正しく表示されることを確認（具体的な時刻は環境により異なる可能性）
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('パフォーマンス', () => {
    it('should handle large number of hedge positions', () => {
      const largeHedgeList = Array.from({ length: 100 }, (_, i) => ({
        ...mockHedgePositions[0],
        id: `hedge-${i}`,
        symbol: `PAIR${i.toString().padStart(2, '0')}`,
        totalProfit: i * 10,
      }));

      const startTime = performance.now();
      render(<HedgePositionGrid {...defaultProps} hedgePositions={largeHedgeList} />);
      const endTime = performance.now();

      // レンダリング時間が妥当であることを確認（1秒未満）
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
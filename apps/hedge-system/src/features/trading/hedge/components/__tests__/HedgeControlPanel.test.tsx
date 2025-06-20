import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HedgeControlPanel, HedgeAction, HedgeSettings } from '../HedgeControlPanel';
import { HedgePosition } from '../../types';

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: any) => (
    <div data-testid="tabs" data-value={value} onChange={onValueChange}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: any) => (
    <button data-testid={`tab-trigger-${value}`}>{children}</button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-testid="button"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid="switch"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      data-testid="input"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => (
    <label data-testid="label" {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    open ? <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>{children}</div> : null
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}));

describe('HedgeControlPanel', () => {
  const mockHedgePosition: HedgePosition = {
    id: 'hedge-1',
    positionIds: ['pos-1', 'pos-2'],
    symbol: 'EURUSD',
    hedgeType: 'perfect',
    accounts: ['account-1', 'account-2'],
    totalLots: {
      buy: 1.0,
      sell: 1.0,
    },
    totalProfit: 150.50,
    isBalanced: true,
    createdAt: new Date('2023-01-01T10:00:00Z'),
    lastRebalanced: new Date('2023-01-02T15:30:00Z'),
    settings: {
      autoRebalance: false,
      maxImbalance: 10,
      maintainOnClose: true,
    },
  };

  const mockUnbalancedHedge: HedgePosition = {
    ...mockHedgePosition,
    id: 'hedge-2',
    totalLots: {
      buy: 1.0,
      sell: 0.5,
    },
    isBalanced: false,
  };

  const mockOnExecuteAction = vi.fn();
  const mockOnUpdateSettings = vi.fn();

  const defaultProps = {
    selectedHedge: mockHedgePosition,
    onExecuteAction: mockOnExecuteAction,
    onUpdateSettings: mockOnUpdateSettings,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without selected hedge', () => {
      render(
        <HedgeControlPanel
          {...defaultProps}
          selectedHedge={null}
        />
      );

      expect(screen.getByText('両建てポジションを選択してください')).toBeInTheDocument();
    });

    it('should render with selected hedge', () => {
      render(<HedgeControlPanel {...defaultProps} />);

      expect(screen.getByText('🎯 両建て制御パネル')).toBeInTheDocument();
      expect(screen.getByText('完全両建て')).toBeInTheDocument();
    });

    it('should display imbalance warning for unbalanced hedge', () => {
      render(
        <HedgeControlPanel
          {...defaultProps}
          selectedHedge={mockUnbalancedHedge}
        />
      );

      expect(screen.getByText('不均衡')).toBeInTheDocument();
    });
  });

  describe('Control Actions', () => {
    it('should handle dissolve action', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const dissolveButton = screen.getByText('両建て解除');
      fireEvent.click(dissolveButton);

      // Should open confirmation dialog
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('両建て解除')).toBeInTheDocument();

      // Confirm action
      const confirmButton = screen.getByText('実行');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExecuteAction).toHaveBeenCalledWith({
          type: 'dissolve',
          hedgeId: 'hedge-1',
          params: {},
        });
      });
    });

    it('should handle close buy action', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const closeBuyButton = screen.getByText('買い決済');
      fireEvent.click(closeBuyButton);

      const confirmButton = screen.getByText('実行');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExecuteAction).toHaveBeenCalledWith({
          type: 'close_buy',
          hedgeId: 'hedge-1',
          params: {},
        });
      });
    });

    it('should handle close sell action', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const closeSellButton = screen.getByText('売り決済');
      fireEvent.click(closeSellButton);

      const confirmButton = screen.getByText('実行');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExecuteAction).toHaveBeenCalledWith({
          type: 'close_sell',
          hedgeId: 'hedge-1',
          params: {},
        });
      });
    });

    it('should handle add hedge with lots parameter', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      // Set lots parameter
      const lotsInput = screen.getByPlaceholderText('0.10');
      fireEvent.change(lotsInput, { target: { value: '0.5' } });

      const addHedgeButton = screen.getByText('追加両建て実行');
      fireEvent.click(addHedgeButton);

      const confirmButton = screen.getByText('実行');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExecuteAction).toHaveBeenCalledWith({
          type: 'add_hedge',
          hedgeId: 'hedge-1',
          params: { lots: 0.5 },
        });
      });
    });

    it('should handle rebalance action', async () => {
      render(
        <HedgeControlPanel
          {...defaultProps}
          selectedHedge={mockUnbalancedHedge}
        />
      );

      const rebalanceButton = screen.getByText('リバランス実行');
      fireEvent.click(rebalanceButton);

      const confirmButton = screen.getByText('実行');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExecuteAction).toHaveBeenCalledWith({
          type: 'rebalance',
          hedgeId: 'hedge-2',
          params: {},
        });
      });
    });

    it('should disable actions when executing', () => {
      render(
        <HedgeControlPanel
          {...defaultProps}
          isExecuting={true}
        />
      );

      const dissolveButton = screen.getByText('両建て解除');
      expect(dissolveButton).toBeDisabled();
    });
  });

  describe('Settings Management', () => {
    it('should update auto rebalance setting', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      // Switch to settings tab
      const settingsTab = screen.getByTestId('tab-trigger-settings');
      fireEvent.click(settingsTab);

      const autoRebalanceSwitch = screen.getByLabelText('自動リバランス');
      fireEvent.click(autoRebalanceSwitch);

      await waitFor(() => {
        expect(mockOnUpdateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            autoRebalance: true,
          })
        );
      });
    });

    it('should update max imbalance setting', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      // Switch to settings tab
      const settingsTab = screen.getByTestId('tab-trigger-settings');
      fireEvent.click(settingsTab);

      const maxImbalanceInput = screen.getByDisplayValue('10');
      fireEvent.change(maxImbalanceInput, { target: { value: '15' } });

      await waitFor(() => {
        expect(mockOnUpdateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            maxImbalance: 15,
          })
        );
      });
    });

    it('should update maintain on close setting', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      // Switch to settings tab
      const settingsTab = screen.getByTestId('tab-trigger-settings');
      fireEvent.click(settingsTab);

      const maintainOnCloseSwitch = screen.getByLabelText('決済時の両建て維持');
      fireEvent.click(maintainOnCloseSwitch);

      await waitFor(() => {
        expect(mockOnUpdateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            maintainOnClose: false,
          })
        );
      });
    });
  });

  describe('Status Display', () => {
    it('should display hedge status information', () => {
      render(<HedgeControlPanel {...defaultProps} />);

      // Switch to status tab
      const statusTab = screen.getByTestId('tab-trigger-status');
      fireEvent.click(statusTab);

      expect(screen.getByText('EURUSD')).toBeInTheDocument();
      expect(screen.getByText('perfect')).toBeInTheDocument();
      expect(screen.getByText('1 lots')).toBeInTheDocument();
      expect(screen.getByText('+150.50')).toBeInTheDocument();
    });

    it('should display related accounts and positions', () => {
      render(<HedgeControlPanel {...defaultProps} />);

      // Switch to status tab
      const statusTab = screen.getByTestId('tab-trigger-status');
      fireEvent.click(statusTab);

      expect(screen.getByText('account-1')).toBeInTheDocument();
      expect(screen.getByText('account-2')).toBeInTheDocument();
      expect(screen.getByText('pos-1')).toBeInTheDocument();
      expect(screen.getByText('pos-2')).toBeInTheDocument();
    });

    it('should calculate and display imbalance ratio', () => {
      render(
        <HedgeControlPanel
          {...defaultProps}
          selectedHedge={mockUnbalancedHedge}
        />
      );

      // Switch to status tab
      const statusTab = screen.getByTestId('tab-trigger-status');
      fireEvent.click(statusTab);

      // Imbalance = |1.0 - 0.5| / (1.0 + 0.5) * 100 = 33.3%
      expect(screen.getByText('33.3%')).toBeInTheDocument();
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show warning for dissolve action', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const dissolveButton = screen.getByText('両建て解除');
      fireEvent.click(dissolveButton);

      expect(screen.getByText('⚠️ この操作により、すべての関連ポジションが決済されます。')).toBeInTheDocument();
    });

    it('should close dialog on cancel', async () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const dissolveButton = screen.getByText('両建て解除');
      fireEvent.click(dissolveButton);

      const cancelButton = screen.getByText('キャンセル');
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle action execution failure gracefully', async () => {
      const mockOnExecuteActionWithError = vi.fn().mockRejectedValue(new Error('Execution failed'));
      
      render(
        <HedgeControlPanel
          {...defaultProps}
          onExecuteAction={mockOnExecuteActionWithError}
        />
      );

      const dissolveButton = screen.getByText('両建て解除');
      fireEvent.click(dissolveButton);

      const confirmButton = screen.getByText('実行');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExecuteActionWithError).toHaveBeenCalled();
      });

      // Dialog should close even on error
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });

    it('should disable add hedge button when no lots specified', () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const addHedgeButton = screen.getByText('追加両建て実行');
      expect(addHedgeButton).toBeDisabled();
    });

    it('should disable rebalance button for balanced hedge', () => {
      render(<HedgeControlPanel {...defaultProps} />);

      const rebalanceButton = screen.getByText('リバランス実行');
      expect(rebalanceButton).toBeDisabled();
    });
  });
});
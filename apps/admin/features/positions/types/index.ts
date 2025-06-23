// ポジション管理機能で使用する型定義

// 共通型の再エクスポート
export type {
  Position,
  CreatePositionInput,
  UpdatePositionInput,
  PositionStatus
} from '@repo/shared-types';

// フィルター・ソート用の型定義
export type PositionFilter = {
  status?: string | 'all';
  symbol?: string;
};

export type PositionSortField = 'createdAt' | 'updatedAt' | 'symbol' | 'pnl';
export type SortOrder = 'asc' | 'desc';

export type PositionSort = {
  field: PositionSortField;
  order: SortOrder;
};

// コンポーネント用のプロパティ型
export interface PositionListProps {
  viewMode?: 'table' | 'cards';
}

export interface PositionCardProps {
  position: Position;
}

export interface PositionActionsProps {
  position: Position;
}

export interface PositionDetailProps {
  position: Position;
  open: boolean;
  onClose: () => void;
}

// フック用の型定義
export interface UsePositionsReturn {
  positions: Position[];
  loading: boolean;
  error: Error | null;
  refreshPositions: () => Promise<void>;
}

export interface UsePositionActionsReturn {
  closePosition: (positionId: string) => Promise<void>;
  updateStopLoss: (positionId: string, stopLoss: number) => Promise<void>;
  loading: boolean;
}

// UI表示用のヘルパー型
export type StatusBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

// P&L計算用の型
export interface PositionPnL {
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
}
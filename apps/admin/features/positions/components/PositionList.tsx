'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Input } from '@repo/ui/components/ui/input';
import { Position, PositionStatus } from '@repo/shared-types';
import { usePositions } from '../hooks/usePositions';
import { PositionCard } from './PositionCard';
import { PositionActions } from './PositionActions';
import { formatCurrency, formatDateTime } from '../../../lib/utils';

interface PositionListProps {
  viewMode?: 'table' | 'cards';
}

export function PositionList({ viewMode = 'table' }: PositionListProps) {
  const { positions, loading, error, refreshPositions } = usePositions();
  const [statusFilter, setStatusFilter] = useState<PositionStatus | 'all'>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'symbol' | 'pnl'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedPositions = useMemo(() => {
    let filtered = positions;

    // ステータスフィルター
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // シンボルフィルター
    if (symbolFilter) {
      filtered = filtered.filter(p => 
        p.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
      );
    }

    // ソート
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt) : new Date(0);
          bValue = b.createdAt ? new Date(b.createdAt) : new Date(0);
          break;
        case 'updatedAt':
          aValue = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
          bValue = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'pnl':
          aValue = calculatePnL(a);
          bValue = calculatePnL(b);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [positions, statusFilter, symbolFilter, sortBy, sortOrder]);

  const calculatePnL = (position: Position): number => {
    if (!position.entryPrice || position.status !== PositionStatus.OPEN) return 0;
    // 簡易PnL計算（実際の実装では現在価格が必要）
    return 0;
  };

  const getStatusBadgeVariant = (status: PositionStatus) => {
    switch (status) {
      case PositionStatus.OPEN: return 'default';
      case PositionStatus.PENDING: return 'secondary';
      case PositionStatus.CLOSING: return 'outline';
      case PositionStatus.CLOSED: return 'outline';
      case PositionStatus.STOPPED: return 'destructive';
      case PositionStatus.CANCELED: return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            エラーが発生しました: {error.message}
          </div>
          <div className="text-center mt-4">
            <Button onClick={refreshPositions}>再試行</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* フィルター・ソートコントロール */}
      <Card>
        <CardHeader>
          <CardTitle>ポジション管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="pending">待機中</SelectItem>
                <SelectItem value="open">オープン</SelectItem>
                <SelectItem value="closing">決済中</SelectItem>
                <SelectItem value="closed">クローズ済み</SelectItem>
                <SelectItem value="stopped">ロスカット</SelectItem>
                <SelectItem value="canceled">キャンセル</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="シンボル検索"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="w-40"
            />

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="ソート" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">更新日時</SelectItem>
                <SelectItem value="createdAt">作成日時</SelectItem>
                <SelectItem value="symbol">シンボル</SelectItem>
                <SelectItem value="pnl">損益</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '昇順' : '降順'}
            </Button>

            <Button onClick={refreshPositions}>
              更新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ポジション一覧 */}
      {viewMode === 'table' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ポジションID</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>シンボル</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>エントリー価格</TableHead>
                <TableHead>現在価格</TableHead>
                <TableHead>損益</TableHead>
                <TableHead>作成日時</TableHead>
                <TableHead>アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPositions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="font-mono text-sm">
                    {position.id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(position.status)}>
                      {position.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {position.symbol}
                  </TableCell>
                  <TableCell>
                    {position.volume.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {position.entryPrice ? formatCurrency(position.entryPrice) : '-'}
                  </TableCell>
                  <TableCell>
                    {/* 現在価格表示（実装要） */}
                    -
                  </TableCell>
                  <TableCell>
                    {/* 損益表示（実装要） */}
                    -
                  </TableCell>
                  <TableCell>
                    {formatDateTime(position.createdAt)}
                  </TableCell>
                  <TableCell>
                    <PositionActions position={position} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedPositions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>
      )}

      {filteredAndSortedPositions.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              条件に一致するポジションがありません
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
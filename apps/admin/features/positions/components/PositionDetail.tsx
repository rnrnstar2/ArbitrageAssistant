'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Separator } from '@repo/ui/components/ui/separator';
import { X } from 'lucide-react';
import { Position, PositionStatus } from '@repo/shared-types';
import { formatCurrency, formatDateTime } from '../../../lib/utils';

interface PositionDetailProps {
  position: Position;
  open: boolean;
  onClose: () => void;
}

export function PositionDetail({ position, open, onClose }: PositionDetailProps) {
  const getStatusColor = (status: PositionStatus) => {
    switch (status) {
      case PositionStatus.OPEN: return 'bg-green-100 text-green-800';
      case PositionStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
      case PositionStatus.CLOSING: return 'bg-blue-100 text-blue-800';
      case PositionStatus.CLOSED: return 'bg-gray-100 text-gray-800';
      case PositionStatus.STOPPED: return 'bg-red-100 text-red-800';
      case PositionStatus.CANCELED: return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const calculatePnL = () => {
    // 実際の実装では現在価格が必要
    // ここでは仮の計算を行う
    if (!position.entryPrice || position.status !== PositionStatus.OPEN) {
      return null;
    }
    // 仮の現在価格（実際には外部から取得）
    const currentPrice = position.entryPrice * 1.002; // 0.2%上昇と仮定
    const pnl = (currentPrice - position.entryPrice) * position.volume;
    return pnl;
  };

  const pnl = calculatePnL();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              ポジション詳細 - {position.symbol}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            ポジションID: {position.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                基本情報
                <Badge className={getStatusColor(position.status)}>
                  {position.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">シンボル</div>
                  <div className="text-lg font-semibold">{position.symbol}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">数量</div>
                  <div className="text-lg font-semibold">{position.volume.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">ユーザーID</div>
                  <div className="font-mono text-sm">{position.userId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">実行タイプ</div>
                  <div>{position.executionType}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 価格情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">価格情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">エントリー価格</div>
                  <div className="text-lg font-semibold">
                    {position.entryPrice ? formatCurrency(position.entryPrice) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">決済価格</div>
                  <div className="text-lg font-semibold">
                    {position.exitPrice ? formatCurrency(position.exitPrice) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">トレール幅</div>
                  <div className="text-lg font-semibold">
                    {position.trailWidth ? `${position.trailWidth} pips` : '-'}
                  </div>
                </div>
              </div>

              {pnl !== null && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium text-gray-500">未実現損益（概算）</div>
                    <div className={`text-lg font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(pnl)}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* トレール設定 */}
          {position.trailWidth && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">トレール設定</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <div className="text-sm font-medium text-gray-500">トレール幅</div>
                  <div className="text-lg font-semibold">{position.trailWidth}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 日時情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">日時情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">作成日時</div>
                  <div>{position.createdAt ? formatDateTime(position.createdAt) : '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">更新日時</div>
                  <div>{position.updatedAt ? formatDateTime(position.updatedAt) : '-'}</div>
                </div>
                {position.entryTime && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">エントリー日時</div>
                    <div>{formatDateTime(position.entryTime)}</div>
                  </div>
                )}
                {position.exitTime && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">決済日時</div>
                    <div>{formatDateTime(position.exitTime)}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 決済理由 */}
          {position.exitReason && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">決済理由</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {position.exitReason}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 所有者情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">その他</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <div className="text-sm font-medium text-gray-500">所有者</div>
                <div className="font-mono text-sm">{position.userId}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
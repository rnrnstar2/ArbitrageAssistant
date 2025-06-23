'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Strategy, Position } from '@repo/shared-types';
import { formatCurrency, formatDateTime } from '../../../lib/utils';

interface StrategyDetailProps {
  strategy: Strategy;
  positions: Position[];
  open: boolean;
  onClose: () => void;
}

export function StrategyDetail({ strategy, positions, open, onClose }: StrategyDetailProps) {
  const activePositions = positions.filter(p => ['pending', 'open'].includes(p.status));
  const closedPositions = positions.filter(p => p.status === 'closed');
  const stoppedPositions = positions.filter(p => p.status === 'stopped');

  const totalPnL = closedPositions.reduce((sum, p) => {
    if (p.entryPrice && p.exitPrice) {
      const pnl = (p.exitPrice - p.entryPrice) * p.volume;
      return sum + pnl;
    }
    return sum;
  }, 0);

  const winRate = closedPositions.length > 0 
    ? (closedPositions.filter(p => {
        if (p.entryPrice && p.exitPrice) {
          return (p.exitPrice - p.entryPrice) > 0;
        }
        return false;
      }).length / closedPositions.length) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{strategy.name} - 詳細</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 戦略設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">戦略設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">戦略ID</div>
                  <div className="font-mono text-sm">{strategy.strategyId}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">トレール幅</div>
                  <div className="font-semibold">{strategy.trailWidth} pips</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">対象シンボル</div>
                  <div className="font-semibold">{strategy.symbol || '指定なし'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">最大リスク</div>
                  <div className="font-semibold">
                    {strategy.maxRisk ? `¥${strategy.maxRisk.toLocaleString()}` : '制限なし'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* パフォーマンス統計 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">パフォーマンス統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">総ポジション数</div>
                  <div className="text-2xl font-bold">{positions.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">アクティブ</div>
                  <div className="text-2xl font-bold text-blue-600">{activePositions.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">累計損益</div>
                  <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ¥{totalPnL.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">勝率</div>
                  <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ポジション一覧 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">関連ポジション</CardTitle>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  この戦略に関連するポジションはありません
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {positions.map((position) => (
                    <div
                      key={position.positionId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <Badge variant={
                          position.status === 'open' ? 'default' :
                          position.status === 'pending' ? 'secondary' :
                          position.status === 'closed' ? 'outline' :
                          position.status === 'stopped' ? 'destructive' : 'outline'
                        }>
                          {position.status}
                        </Badge>
                        <div>
                          <div className="font-semibold">{position.symbol}</div>
                          <div className="text-sm text-gray-500">
                            数量: {position.volume.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {position.entryPrice && (
                          <div className="font-semibold">
                            {formatCurrency(position.entryPrice)}
                          </div>
                        )}
                        <div className="text-sm text-gray-500">
                          {formatDateTime(position.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
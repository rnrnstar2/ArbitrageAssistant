'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@repo/ui/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Eye, Play, Pause } from 'lucide-react';
import { Strategy } from '@repo/shared-types';
import { useStrategyActions } from '../hooks/useStrategyActions';
import { usePositions } from '../../positions/hooks/usePositions';
import { StrategyDetail } from './StrategyDetail';
import { formatDateTime } from '../../../lib/utils';

interface StrategyCardProps {
  strategy: Strategy;
  onEdit: (strategy: Strategy) => void;
}

export function StrategyCard({ strategy, onEdit }: StrategyCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { deleteStrategy, loading } = useStrategyActions();
  const { positions } = usePositions();

  // この戦略に紐づくポジション
  const strategyPositions = positions.filter(p => p.strategyId === strategy.strategyId);
  const activePositions = strategyPositions.filter(p => ['pending', 'open'].includes(p.status));
  const totalPnL = strategyPositions
    .filter(p => p.status === 'closed')
    .reduce((sum, p) => {
      if (p.entryPrice && p.exitPrice) {
        const pnl = (p.exitPrice - p.entryPrice) * p.volume;
        return sum + pnl;
      }
      return sum;
    }, 0);

  const handleDelete = async () => {
    if (activePositions.length > 0) {
      alert('アクティブなポジションがある戦略は削除できません');
      return;
    }

    if (confirm(`戦略「${strategy.name}」を削除しますか？`)) {
      try {
        await deleteStrategy(strategy.strategyId);
      } catch (error) {
        console.error('Failed to delete strategy:', error);
        alert('戦略の削除に失敗しました');
      }
    }
  };

  return (
    <>
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">
              {strategy.name}
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowDetail(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  詳細表示
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(strategy)}>
                  <Edit className="h-4 w-4 mr-2" />
                  編集
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={activePositions.length > 0 || loading}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="text-sm text-gray-500 font-mono">
            ID: {strategy.strategyId.substring(0, 8)}...
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* 戦略設定 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">トレール幅</div>
              <div className="font-semibold">{strategy.trailWidth} pips</div>
            </div>
            
            {strategy.symbol && (
              <div>
                <div className="text-gray-500">対象シンボル</div>
                <div className="font-semibold">{strategy.symbol}</div>
              </div>
            )}
            
            {strategy.maxRisk && (
              <div>
                <div className="text-gray-500">最大リスク</div>
                <div className="font-semibold">¥{strategy.maxRisk.toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* ポジション統計 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">アクティブポジション</span>
              <Badge variant={activePositions.length > 0 ? 'default' : 'secondary'}>
                {activePositions.length}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">総ポジション数</span>
              <span className="font-medium">{strategyPositions.length}</span>
            </div>
            
            {strategyPositions.length > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">累計損益</span>
                <span className={`font-medium ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{totalPnL.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* 作成日時 */}
          <div className="text-xs text-gray-500 pt-2 border-t">
            作成: {formatDateTime(strategy.createdAt)}
          </div>

          {/* アクションボタン */}
          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetail(true)}
            >
              <Eye className="h-4 w-4 mr-1" />
              詳細
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={() => onEdit(strategy)}
            >
              <Edit className="h-4 w-4 mr-1" />
              編集
            </Button>
          </div>
        </CardContent>
      </Card>

      <StrategyDetail
        strategy={strategy}
        positions={strategyPositions}
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
}
'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@repo/ui/components/ui/dropdown-menu';
import { MoreHorizontal, X, Edit, Eye } from 'lucide-react';
import { Position, PositionStatus } from '@repo/shared-types';
import { usePositionActions } from '../hooks/usePositionActions';
import { PositionDetail } from './PositionDetail';

interface PositionActionsProps {
  position: Position;
}

export function PositionActions({ position }: PositionActionsProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { closePosition, loading } = usePositionActions();

  const handleClosePosition = async () => {
    if (confirm('このポジションを決済しますか？')) {
      try {
        await closePosition(position.positionId);
      } catch (error) {
        console.error('Failed to close position:', error);
        alert('ポジションの決済に失敗しました');
      }
    }
  };

  const canClose = position.status === PositionStatus.OPEN;
  const canModify = position.status === PositionStatus.OPEN;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetail(true)}
        >
          <Eye className="h-4 w-4 mr-1" />
          詳細
        </Button>

        {canClose && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClosePosition}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-1" />
            決済
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canModify && (
              <DropdownMenuItem onClick={() => {}}>
                <Edit className="h-4 w-4 mr-2" />
                ストップロス変更
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowDetail(true)}>
              <Eye className="h-4 w-4 mr-2" />
              詳細表示
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PositionDetail
        position={position}
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
}
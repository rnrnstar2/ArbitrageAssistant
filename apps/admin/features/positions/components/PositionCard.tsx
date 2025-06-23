'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Position, PositionStatus } from '@repo/shared-types';
import { PositionActions } from './PositionActions';
import { formatCurrency, formatDateTime } from '../../../lib/utils';

interface PositionCardProps {
  position: Position;
}

export function PositionCard({ position }: PositionCardProps) {
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

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">
            {position.symbol}
          </CardTitle>
          <Badge className={getStatusColor(position.status)}>
            {position.status}
          </Badge>
        </div>
        <div className="text-sm text-gray-500 font-mono">
          ID: {position.id.substring(0, 8)}...
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-500">数量</div>
            <div className="font-semibold">{position.volume.toFixed(2)}</div>
          </div>
          
          <div>
            <div className="text-gray-500">エントリー価格</div>
            <div className="font-semibold">
              {position.entryPrice ? formatCurrency(position.entryPrice) : '-'}
            </div>
          </div>
          
          {position.trailWidth && position.trailWidth > 0 && (
            <div>
              <div className="text-gray-500">トレール幅</div>
              <div className="font-semibold">{position.trailWidth} pips</div>
            </div>
          )}
        </div>

        {position.entryTime && (
          <div className="text-xs text-gray-500">
            エントリー: {formatDateTime(position.entryTime)}
          </div>
        )}

        {position.exitTime && (
          <div className="text-xs text-gray-500">
            決済: {formatDateTime(position.exitTime)}
          </div>
        )}

        <div className="pt-2 border-t">
          <PositionActions position={position} />
        </div>
      </CardContent>
    </Card>
  );
}
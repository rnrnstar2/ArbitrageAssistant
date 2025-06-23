"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Position } from '@repo/shared-types';

export const TrailMonitor: React.FC = () => {
  const [trailPositions, setTrailPositions] = useState<Position[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const updateTrailPositions = async () => {
      try {
        // Mock trail positions data
        const mockPositions: Position[] = [
          {
            id: 'pos1',
            userId: 'user1',
            accountId: '12345678',
            executionType: 'ENTRY' as any,
            status: 'OPEN' as any,
            symbol: 'USDJPY' as any,
            volume: 0.1,
            entryPrice: 150.25,
            trailWidth: 20,
            triggerActionIds: JSON.stringify(['action1', 'action2']),
            createdAt: new Date().toISOString()
          },
          {
            id: 'pos2',
            userId: 'user1',
            accountId: '87654321',
            executionType: 'ENTRY' as any,
            status: 'OPEN' as any,
            symbol: 'EURUSD' as any,
            volume: 0.2,
            entryPrice: 1.0850,
            trailWidth: 15,
            triggerActionIds: JSON.stringify(['action3']),
            createdAt: new Date().toISOString()
          }
        ];
        setTrailPositions(mockPositions);

        // Mock price updates
        const mockPrices = new Map([
          ['USDJPY', 150.45],
          ['EURUSD', 1.0875]
        ]);
        setPriceUpdates(mockPrices);
      } catch (error) {
        console.error('Failed to update trail positions:', error);
      }
    };

    const interval = setInterval(updateTrailPositions, 2000);
    updateTrailPositions();

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">トレール監視</h3>
      
      {trailPositions.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          トレール監視中のポジションはありません
        </div>
      ) : (
        <div className="space-y-3">
          {trailPositions.map(position => (
            <div key={position.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{position.symbol}</div>
                  <div className="text-sm text-gray-500">
                    ポジション: {position.id.slice(-8)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">トレール幅</div>
                  <div className="font-bold text-blue-600">
                    {position.trailWidth} pips
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">エントリー価格</div>
                  <div className="font-medium">{position.entryPrice}</div>
                </div>
                <div>
                  <div className="text-gray-500">現在価格</div>
                  <div className="font-medium">
                    {priceUpdates.get(position.symbol) || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">価格差</div>
                  <div className="font-medium">
                    {position.entryPrice && priceUpdates.get(position.symbol)
                      ? Math.abs(priceUpdates.get(position.symbol)! - position.entryPrice).toFixed(4)
                      : '-'
                    }
                  </div>
                </div>
              </div>
              
              {position.triggerActionIds && (
                <div className="mt-2 text-xs text-gray-500">
                  トリガーアクション: {JSON.parse(position.triggerActionIds).length}個
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
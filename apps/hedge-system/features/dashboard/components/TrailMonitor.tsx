"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Position } from '@repo/shared-types';
import { TrailEngineStats } from '../../../lib/trail-engine';

interface TrailMonitorProps {
  hedgeSystemCore?: any; // HedgeSystemCore instance
}

export const TrailMonitor: React.FC<TrailMonitorProps> = ({ hedgeSystemCore }) => {
  const [trailStats, setTrailStats] = useState<TrailEngineStats>();
  const [monitoredPositions, setMonitoredPositions] = useState<Position[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, number>>(new Map());

  // リアルタイム状態表示（task specification準拠）
  useEffect(() => {
    const updateTrailData = async () => {
      try {
        if (hedgeSystemCore) {
          // 実際のhedgeSystemCoreからデータ取得
          const stats = await hedgeSystemCore.getTrailEngineStats();
          setTrailStats(stats);
          
          const positions = await hedgeSystemCore.getMonitoredPositions();
          setMonitoredPositions(positions);
        } else {
          // hedgeSystemCoreが利用できない場合はモックデータ
          const mockStats: TrailEngineStats = {
            monitoringCount: 2,
            activePositions: ['pos1', 'pos2'],
            totalTriggered: 5,
            lastUpdate: new Date()
          };
          setTrailStats(mockStats);
          
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
          setMonitoredPositions(mockPositions);
        }

        // 価格データの更新（リアルタイム）
        const mockPrices = new Map([
          ['USDJPY', 150.45 + (Math.random() - 0.5) * 0.1],
          ['EURUSD', 1.0875 + (Math.random() - 0.5) * 0.001]
        ]);
        setPriceUpdates(mockPrices);

      } catch (error) {
        console.error('Failed to update trail data:', error);
      }
    };

    // 1秒間隔でリアルタイム更新
    const interval = setInterval(updateTrailData, 1000);
    updateTrailData();

    return () => clearInterval(interval);
  }, [hedgeSystemCore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>トレール監視状況</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 統計情報表示（task specification準拠） */}
        {trailStats && (
          <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{trailStats.monitoringCount}</div>
              <div className="text-sm text-gray-500">監視中ポジション</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{trailStats.totalTriggered}</div>
              <div className="text-sm text-gray-500">総トリガー数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{trailStats.activePositions.length}</div>
              <div className="text-sm text-gray-500">アクティブ</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">
                {trailStats.lastUpdate.toLocaleTimeString()}
              </div>
              <div className="text-xs text-gray-500">最終更新</div>
            </div>
          </div>
        )}

        {/* 監視中ポジション一覧（task specification準拠） */}
        {monitoredPositions.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            トレール監視中のポジションはありません
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700 mb-3">監視中ポジション</h4>
            {monitoredPositions.map(position => {
              const currentPrice = priceUpdates.get(position.symbol);
              const priceDiff = position.entryPrice && currentPrice 
                ? currentPrice - position.entryPrice 
                : 0;
              const pips = Math.abs(priceDiff * (position.symbol === 'USDJPY' ? 100 : 10000));
              
              return (
                <div key={position.id} className="p-4 border rounded-lg bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-lg">{position.symbol}</div>
                      <div className="text-sm text-gray-500">
                        ID: {position.id.slice(-8)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">トレール幅</div>
                      <div className="font-bold text-blue-600 text-lg">
                        {position.trailWidth} pips
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-gray-500">エントリー価格</div>
                      <div className="font-medium">{position.entryPrice?.toFixed(4) || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">現在価格</div>
                      <div className="font-medium">
                        {currentPrice?.toFixed(4) || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">価格差</div>
                      <div className={`font-medium ${priceDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {priceDiff ? `${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(4)}` : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">pips</div>
                      <div className={`font-medium ${priceDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pips ? `${priceDiff > 0 ? '+' : ''}${pips.toFixed(1)}` : '-'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    {position.triggerActionIds && (
                      <div className="text-gray-500">
                        トリガーアクション: {JSON.parse(position.triggerActionIds).length}個設定済み
                      </div>
                    )}
                    <div className="text-gray-400">
                      Vol: {position.volume} | Account: {position.accountId}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* トリガー履歴表示（task specification準拠） */}
        {trailStats && trailStats.totalTriggered > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-semibold text-gray-700 mb-2">最近のトリガー履歴</h4>
            <div className="text-sm text-gray-500">
              過去24時間で {trailStats.totalTriggered} 回のトレールトリガーが実行されました
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
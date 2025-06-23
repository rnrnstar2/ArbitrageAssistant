'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Play, Pause, Square, RefreshCw, AlertTriangle } from 'lucide-react';

export function QuickActions() {
  const handleStartTrading = () => {
    // 取引開始処理
  };

  const handleStopTrading = () => {
    // 取引停止処理
  };

  const handleEmergencyStop = () => {
    if (confirm('緊急停止を実行しますか？全てのポジションが強制決済されます。')) {
      // 緊急停止処理
    }
  };

  const handleRefresh = () => {
    // システムリフレッシュ
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>クイックアクション</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          className="w-full" 
          variant="default"
          onClick={handleStartTrading}
        >
          <Play className="h-4 w-4 mr-2" />
          取引開始
        </Button>

        <Button 
          className="w-full" 
          variant="outline"
          onClick={handleStopTrading}
        >
          <Pause className="h-4 w-4 mr-2" />
          取引停止
        </Button>

        <Button 
          className="w-full" 
          variant="destructive"
          onClick={handleEmergencyStop}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          緊急停止
        </Button>

        <div className="border-t pt-3">
          <Button 
            className="w-full" 
            variant="ghost"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            システム再読み込み
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
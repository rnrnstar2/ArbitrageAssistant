"use client";

import { RefreshCw, Settings } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { useSystem } from '../context/SystemContext';

export function ControlBar() {
  const { isRefreshing, handleRefresh, setShowSettings } = useSystem();

  return (
    <div className="flex items-center justify-end gap-2 pb-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        更新
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSettings(true)}
      >
        <Settings className="h-4 w-4 mr-2" />
        設定
      </Button>
    </div>
  );
}
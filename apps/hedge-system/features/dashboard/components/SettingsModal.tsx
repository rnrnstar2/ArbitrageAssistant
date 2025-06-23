"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { useSystem } from '../context/SystemContext';

export function SettingsModal() {
  const { showSettings, setShowSettings } = useSystem();

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>システム設定</CardTitle>
          <CardDescription>基本設定の変更</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">WebSocketポート</label>
            <input 
              type="number" 
              defaultValue="8080"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">接続監視間隔 (秒)</label>
            <input 
              type="number" 
              defaultValue="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              キャンセル
            </Button>
            <Button className="bg-a8-primary hover:bg-a8-primary-hover text-white" onClick={() => setShowSettings(false)}>
              保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
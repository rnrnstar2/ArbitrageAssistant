"use client";

import { Shield, Server, RefreshCw, Power, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';

export function QuickActionPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-a8-primary" />
          緊急操作
        </CardTitle>
        <CardDescription>
          システム制御とトラブルシューティング
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 border-a8-primary text-a8-primary hover:bg-a8-accent">
            <Server className="h-4 w-4 mr-2" />
            WebSocket再起動
          </Button>
          <Button variant="outline" className="h-12 border-a8-primary text-a8-primary hover:bg-a8-accent">
            <RefreshCw className="h-4 w-4 mr-2" />
            全EA再接続
          </Button>
          <Button className="h-12 bg-a8-primary hover:bg-a8-primary-hover text-white">
            <Power className="h-4 w-4 mr-2" />
            緊急停止
          </Button>
          <Button variant="outline" className="h-12 border-a8-secondary text-a8-secondary hover:bg-orange-50">
            <Clock className="h-4 w-4 mr-2" />
            ログ出力
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
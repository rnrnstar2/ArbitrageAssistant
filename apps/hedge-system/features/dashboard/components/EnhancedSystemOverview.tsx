"use client";

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  Play, 
  Square,
  Eye,
  DollarSign,
  BarChart3,
  Zap,
  RefreshCw,
  Settings
} from 'lucide-react';
import { ActionExecutionPanel } from './ActionExecutionPanel';

interface BrokerAccount {
  id: string;
  brokerName: string;
  accountNumber: string;
  serverName: string;
  platform: 'MT4' | 'MT5';
  isConnected: boolean;
  balance: number;
  credit: number;
  equity: number;
  freeMargin: number;
  positions: number;
  lastUpdate: string;
  connectionId?: string;
}

interface PriceData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  lastUpdate: string;
}

interface TrailPosition {
  id: string;
  accountId: string;
  symbol: string;
  volume: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  trailWidth: number;
  triggerActions: number;
}

interface SystemOverviewData {
  wsServerRunning: boolean;
  wsUptime: number;
  wsErrors: number;
  brokerAccounts: BrokerAccount[];
  activePrices: PriceData[];
  trailPositions: TrailPosition[];
  executingActions: number;
  recentTriggers: number;
  lastActivity: string | null;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  action: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

export const EnhancedSystemOverview: React.FC = () => {
  const [systemData, setSystemData] = useState<SystemOverviewData>({
    wsServerRunning: false,
    wsUptime: 0,
    wsErrors: 0,
    brokerAccounts: [],
    activePrices: [],
    trailPositions: [],
    executingActions: 0,
    recentTriggers: 0,
    lastActivity: null,
  });

  const [selectedAccount, setSelectedAccount] = useState<BrokerAccount | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<TrailPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showActionPanel, setShowActionPanel] = useState(false);

  // モックデータ生成（実際の実装時は削除）
  const generateMockData = (): SystemOverviewData => {
    const brokers = ['AXIORY', 'XM', 'TitanFX', 'FXGT', 'Exness'];
    const symbols = ['USDJPY', 'EURUSD', 'GBPUSD', 'AUDUSD', 'XAUUSD'];
    
    const brokerAccounts: BrokerAccount[] = brokers.slice(0, 4).map((broker, i) => ({
      id: `acc-${i + 1}`,
      brokerName: broker,
      accountNumber: `${(Math.random() * 100000000).toFixed(0)}`,
      serverName: `${broker}-Live`,
      platform: i % 2 === 0 ? 'MT4' : 'MT5',
      isConnected: Math.random() > 0.2,
      balance: 50000 + Math.random() * 50000,
      credit: 25000 + Math.random() * 25000,
      equity: 45000 + Math.random() * 60000,
      freeMargin: 30000 + Math.random() * 40000,
      positions: Math.floor(Math.random() * 5),
      lastUpdate: new Date().toISOString(),
      connectionId: Math.random() > 0.3 ? `conn-${i + 1}` : undefined,
    }));

    const activePrices: PriceData[] = symbols.map(symbol => ({
      symbol,
      bid: symbol === 'USDJPY' ? 150.25 + (Math.random() - 0.5) * 0.5 :
           symbol === 'XAUUSD' ? 2050 + (Math.random() - 0.5) * 20 :
           1.0850 + (Math.random() - 0.5) * 0.02,
      ask: 0, // will be calculated
      spread: symbol === 'USDJPY' ? 1.2 + Math.random() * 0.8 :
              symbol === 'XAUUSD' ? 0.5 + Math.random() * 0.3 :
              1.1 + Math.random() * 0.9,
      lastUpdate: new Date().toISOString(),
    }));

    activePrices.forEach(price => {
      const pipValue = price.symbol === 'USDJPY' ? 0.01 : 
                      price.symbol === 'XAUUSD' ? 0.1 : 0.0001;
      price.ask = price.bid + (price.spread * pipValue);
    });

    const trailPositions: TrailPosition[] = [];
    brokerAccounts.forEach(account => {
      for (let i = 0; i < account.positions; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const priceData = activePrices.find(p => p.symbol === symbol);
        const entryPrice = priceData ? priceData.bid + (Math.random() - 0.5) * 0.01 : 150;
        
        trailPositions.push({
          id: `pos-${account.id}-${i}`,
          accountId: account.id,
          symbol,
          volume: 0.1 + Math.random() * 0.9,
          entryPrice,
          currentPrice: priceData?.bid || entryPrice,
          pnl: -500 + Math.random() * 2000,
          trailWidth: 10 + Math.floor(Math.random() * 30),
          triggerActions: Math.floor(Math.random() * 3),
        });
      }
    });

    return {
      wsServerRunning: true,
      wsUptime: Math.floor(Math.random() * 86400),
      wsErrors: Math.floor(Math.random() * 3),
      brokerAccounts,
      activePrices,
      trailPositions,
      executingActions: Math.floor(Math.random() * 3),
      recentTriggers: Math.floor(Math.random() * 10),
      lastActivity: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const updateSystemData = async () => {
      try {
        // WebSocketサーバー状態取得
        const wsState = await invoke('get_websocket_server_status') as any;
        
        // モックデータで更新（実際の実装時はAPIから取得）
        const mockData = generateMockData();
        setSystemData({
          ...mockData,
          wsServerRunning: wsState.is_running,
          wsUptime: wsState.uptime_seconds || 0,
          wsErrors: wsState.errors || 0,
        });

      } catch (error) {
        console.error('Failed to update system data:', error);
        // エラー時もモックデータを使用
        setSystemData(generateMockData());
      }
    };

    const interval = setInterval(updateSystemData, 1000);
    updateSystemData();

    return () => clearInterval(interval);
  }, []);

  const handleToggleWebSocket = async () => {
    setIsLoading(true);
    try {
      if (systemData.wsServerRunning) {
        await invoke('stop_websocket_server');
      } else {
        await invoke('start_websocket_server', {
          port: 8080,
          host: '127.0.0.1',
          authToken: 'hedge-system-default-token'
        });
      }
    } catch (error) {
      console.error('Failed to toggle WebSocket server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = () => {
    console.log('Manual sync triggered');
    // TODO: 手動同期処理
  };

  const handleEmergencyStop = () => {
    console.log('Emergency stop triggered');
    // TODO: 緊急停止処理
  };

  const quickActions: QuickAction[] = [
    {
      id: 'sync',
      label: '手動同期',
      icon: RefreshCw,
      action: handleManualSync,
      variant: 'outline'
    },
    {
      id: 'emergency',
      label: '緊急停止',
      icon: AlertCircle,
      action: handleEmergencyStop,
      variant: 'destructive'
    },
    {
      id: 'settings',
      label: '設定',
      icon: Settings,
      action: () => console.log('Settings'),
      variant: 'outline'
    }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPrice = (symbol: string, price: number) => {
    const decimals = symbol === 'USDJPY' ? 3 : 
                    symbol === 'XAUUSD' ? 2 : 5;
    return price.toFixed(decimals);
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const connectedAccounts = systemData.brokerAccounts.filter(acc => acc.isConnected);
  const totalEquity = connectedAccounts.reduce((sum, acc) => sum + acc.equity, 0);
  const totalPositions = connectedAccounts.reduce((sum, acc) => sum + acc.positions, 0);

  return (
    <div className="space-y-6">
      {/* システム状態ヘッダー */}
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                {systemData.wsServerRunning ? (
                  <Wifi className="h-6 w-6 text-green-500" />
                ) : (
                  <WifiOff className="h-6 w-6 text-red-500" />
                )}
                <div>
                  <div className="text-xl font-bold text-gray-900">
                    Hedge System Monitor
                  </div>
                  <div className="text-sm text-gray-500">
                    {systemData.wsServerRunning ? `稼働中 (${formatUptime(systemData.wsUptime)})` : 'システム停止中'}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{connectedAccounts.length}/{systemData.brokerAccounts.length}</div>
                  <div className="text-xs text-gray-500">EA接続</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEquity)}</div>
                  <div className="text-xs text-gray-500">総資金</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{totalPositions}</div>
                  <div className="text-xs text-gray-500">総ポジション</div>
                </div>
                <div className="text-center cursor-pointer" onClick={() => setShowActionPanel(true)}>
                  <div className="text-2xl font-bold text-purple-600 hover:text-purple-700 transition-colors">
                    {systemData.executingActions}
                  </div>
                  <div className="text-xs text-gray-500">実行中 (クリック)</div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {quickActions.map(action => (
                <Button
                  key={action.id}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={action.action}
                  className="flex items-center space-x-1"
                >
                  <action.icon className="h-4 w-4" />
                  <span>{action.label}</span>
                </Button>
              ))}
              
              <Button
                variant={systemData.wsServerRunning ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleWebSocket}
                disabled={isLoading}
              >
                {systemData.wsServerRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    停止
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    開始
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 証券会社別EA接続状況 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {systemData.brokerAccounts.map(account => (
          <Card key={account.id} className={`transition-all hover:shadow-md ${
            account.isConnected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant={account.isConnected ? 'default' : 'secondary'}>
                    {account.platform}
                  </Badge>
                  <div className={`w-2 h-2 rounded-full ${
                    account.isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(account)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{account.brokerName} 詳細</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">口座番号:</span>
                          <div className="font-mono">{account.accountNumber}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">サーバー:</span>
                          <div className="font-mono">{account.serverName}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">残高:</span>
                          <div className="font-bold text-green-600">{formatCurrency(account.balance)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">クレジット:</span>
                          <div className="font-bold text-blue-600">{formatCurrency(account.credit)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">有効証拠金:</span>
                          <div className="font-bold">{formatCurrency(account.equity)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">余剰証拠金:</span>
                          <div className="font-bold">{formatCurrency(account.freeMargin)}</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          最終更新: {new Date(account.lastUpdate).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <CardTitle className="text-lg">{account.brokerName}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">有効証拠金</span>
                  <span className="font-bold text-green-600">{formatCurrency(account.equity)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">クレジット</span>
                  <span className="font-bold text-blue-600">{formatCurrency(account.credit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ポジション</span>
                  <Badge variant="outline">{account.positions}件</Badge>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">口座: {account.accountNumber}</span>
                  <span className={account.isConnected ? 'text-green-600' : 'text-red-600'}>
                    {account.isConnected ? '接続中' : '未接続'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* リアルタイム価格とトレール監視 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* リアルタイム価格 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>リアルタイム価格</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemData.activePrices.slice(0, 5).map(price => (
                <div key={price.symbol} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="font-medium">{price.symbol}</div>
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      {formatPrice(price.symbol, price.bid)} / {formatPrice(price.symbol, price.ask)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Spread: {price.spread.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* トレール監視 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>トレール監視 ({systemData.trailPositions.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemData.trailPositions.slice(0, 4).map(position => (
                <Dialog key={position.id}>
                  <DialogTrigger asChild>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100">
                      <div>
                        <div className="font-medium">{position.symbol}</div>
                        <div className="text-xs text-gray-500">
                          Vol: {position.volume.toFixed(2)} | Trail: {position.trailWidth}pips
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {position.triggerActions}アクション待機
                        </div>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{position.symbol} ポジション詳細</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">ボリューム:</span>
                          <div className="font-bold">{position.volume.toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">エントリー価格:</span>
                          <div className="font-mono">{formatPrice(position.symbol, position.entryPrice)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">現在価格:</span>
                          <div className="font-mono">{formatPrice(position.symbol, position.currentPrice)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">損益:</span>
                          <div className={`font-bold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(position.pnl)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">トレール幅:</span>
                          <div className="font-bold text-blue-600">{position.trailWidth} pips</div>
                        </div>
                        <div>
                          <span className="text-gray-500">トリガーアクション:</span>
                          <div className="font-bold">{position.triggerActions}件</div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
              {systemData.trailPositions.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  監視中のポジションはありません
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* アラートとシステム警告 */}
      {(systemData.wsErrors > 0 || systemData.executingActions > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemData.wsErrors > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium text-red-700">システム警告</div>
                    <div className="text-sm text-red-600">
                      WebSocketエラーが{systemData.wsErrors}件発生
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {systemData.executingActions > 0 && (
            <Card className="border-orange-200 bg-orange-50 cursor-pointer hover:shadow-md transition-all" onClick={() => setShowActionPanel(true)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-orange-500 animate-pulse" />
                    <div>
                      <div className="font-medium text-orange-700">アクション実行中</div>
                      <div className="text-sm text-orange-600">
                        {systemData.executingActions}件のアクションを処理中 - クリックで詳細
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 animate-pulse">
                    処理中
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* アクション実行パネル */}
      <ActionExecutionPanel 
        isVisible={showActionPanel} 
        onClose={() => setShowActionPanel(false)} 
      />
    </div>
  );
};
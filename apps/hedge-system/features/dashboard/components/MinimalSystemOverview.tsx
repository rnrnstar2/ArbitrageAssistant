"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/ui/table';
import { 
  DollarSign,
  TrendingUp,
  BarChart3
} from 'lucide-react';


interface BrokerAccount {
  id: string;
  brokerName: string;
  accountNumber: string;
  platform: 'MT4' | 'MT5';
  isConnected: boolean;
  balance: number;
  credit: number;
  equity: number;
  positions: number;
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

export const MinimalSystemOverview: React.FC = () => {
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [trailPositions, setTrailPositions] = useState<TrailPosition[]>([]);

  // 固定ダミーデータ
  const MOCK_DATA = {
    brokerAccounts: [
      {
        id: 'acc-1',
        brokerName: 'XM',
        accountNumber: '123456789',
        platform: 'MT5' as const,
        isConnected: true,
        balance: 50000,
        credit: 25000,
        equity: 75000,
        positions: 1,
        lastUpdate: '2025-06-24T10:30:00.000Z',
      },
      {
        id: 'acc-2',
        brokerName: 'BigBoss',
        accountNumber: '123456790',
        platform: 'MT5' as const,
        isConnected: true,
        balance: 60000,
        credit: 30000,
        equity: 90000,
        positions: 2,
        lastUpdate: '2025-06-24T10:30:15.000Z',
      },
      {
        id: 'acc-3',
        brokerName: 'FXGT',
        accountNumber: '123456791',
        platform: 'MT5' as const,
        isConnected: true,
        balance: 70000,
        credit: 35000,
        equity: 105000,
        positions: 3,
        lastUpdate: '2025-06-24T10:30:30.000Z',
      },
      {
        id: 'acc-4',
        brokerName: 'Vantage',
        accountNumber: '123456792',
        platform: 'MT5' as const,
        isConnected: true,
        balance: 80000,
        credit: 40000,
        equity: 120000,
        positions: 4,
        lastUpdate: '2025-06-24T10:30:45.000Z',
      }
    ],
    trailPositions: [
      {
        id: 'pos-acc-1-1',
        accountId: 'acc-1',
        symbol: 'USDJPY',
        volume: 0.5,
        entryPrice: 150.20,
        currentPrice: 150.25,
        pnl: 250,
        trailWidth: 20,
        triggerActions: 1,
      },
      {
        id: 'pos-acc-2-1',
        accountId: 'acc-2',
        symbol: 'EURUSD',
        volume: 1.0,
        entryPrice: 1.0840,
        currentPrice: 1.0850,
        pnl: 100,
        trailWidth: 15,
        triggerActions: 0,
      },
      {
        id: 'pos-acc-2-2',
        accountId: 'acc-2',
        symbol: 'XAUUSD',
        volume: 0.1,
        entryPrice: 2045.00,
        currentPrice: 2050.50,
        pnl: 550,
        trailWidth: 30,
        triggerActions: 2,
      },
      {
        id: 'pos-acc-3-1',
        accountId: 'acc-3',
        symbol: 'GBPUSD',
        volume: 0.8,
        entryPrice: 1.2640,
        currentPrice: 1.2650,
        pnl: 80,
        trailWidth: 25,
        triggerActions: 1,
      },
      {
        id: 'pos-acc-3-2',
        accountId: 'acc-3',
        symbol: 'AUDUSD',
        volume: 1.2,
        entryPrice: 0.6740,
        currentPrice: 0.6750,
        pnl: 120,
        trailWidth: 18,
        triggerActions: 0,
      },
      {
        id: 'pos-acc-3-3',
        accountId: 'acc-3',
        symbol: 'USDJPY',
        volume: 0.3,
        entryPrice: 150.00,
        currentPrice: 150.25,
        pnl: 75,
        trailWidth: 35,
        triggerActions: 1,
      },
      {
        id: 'pos-acc-4-1',
        accountId: 'acc-4',
        symbol: 'EURUSD',
        volume: 1.5,
        entryPrice: 1.0830,
        currentPrice: 1.0850,
        pnl: 300,
        trailWidth: 22,
        triggerActions: 2,
      },
      {
        id: 'pos-acc-4-2',
        accountId: 'acc-4',
        symbol: 'XAUUSD',
        volume: 0.2,
        entryPrice: 2040.00,
        currentPrice: 2050.50,
        pnl: 210,
        trailWidth: 40,
        triggerActions: 1,
      },
      {
        id: 'pos-acc-4-3',
        accountId: 'acc-4',
        symbol: 'GBPUSD',
        volume: 0.7,
        entryPrice: 1.2630,
        currentPrice: 1.2650,
        pnl: 140,
        trailWidth: 28,
        triggerActions: 0,
      },
      {
        id: 'pos-acc-4-4',
        accountId: 'acc-4',
        symbol: 'AUDUSD',
        volume: 1.0,
        entryPrice: 0.6730,
        currentPrice: 0.6750,
        pnl: 200,
        trailWidth: 32,
        triggerActions: 1,
      }
    ]
  };

  useEffect(() => {
    // 初回データ設定
    setBrokerAccounts(MOCK_DATA.brokerAccounts);
    setTrailPositions(MOCK_DATA.trailPositions);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">口座・ポジション監視</h1>
      
      {/* 各口座のまとまり */}
      <div className="space-y-6">
        {brokerAccounts.filter(acc => acc.isConnected).map(account => {
          const accountPositions = trailPositions.filter(pos => pos.accountId === account.id);
          
          return (
            <Card key={account.id} className="border-green-200 bg-green-50/20">
              <CardHeader className="pb-4">
                {/* 口座基本情報 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Badge variant="default" className="text-sm px-3 py-1">
                      {account.platform}
                    </Badge>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <CardTitle className="text-2xl">{account.brokerName}</CardTitle>
                  </div>
                  <div className="text-sm text-gray-500">
                    最終更新: {new Date(account.lastUpdate).toLocaleTimeString()}
                  </div>
                </div>
                
                <div className="text-lg text-gray-600 mb-4">口座: {account.accountNumber}</div>
                
                {/* 口座金額情報 */}
                <div className="grid grid-cols-3 gap-6 bg-white rounded-lg p-4 border">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm text-gray-600 font-medium">残高</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(account.balance)}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-5 w-5 text-orange-500 mr-2" />
                      <span className="text-sm text-gray-600 font-medium">クレジット</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{formatCurrency(account.credit)}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <BarChart3 className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600 font-medium">証拠金</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(account.equity)}</div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* ポジション一覧 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">保有ポジション</h3>
                    <span className="text-sm text-gray-600">{accountPositions.length}件</span>
                  </div>
                  
                  {accountPositions.length > 0 ? (
                    <div className="bg-white rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-semibold text-gray-900">銘柄</TableHead>
                            <TableHead className="font-semibold text-gray-900 text-right">ロット</TableHead>
                            <TableHead className="font-semibold text-gray-900 text-right">エントリー価格</TableHead>
                            <TableHead className="font-semibold text-gray-900 text-right">現在価格</TableHead>
                            <TableHead className="font-semibold text-gray-900 text-right">損益</TableHead>
                            <TableHead className="font-semibold text-gray-900 text-right">トレール幅</TableHead>
                            <TableHead className="font-semibold text-gray-900 text-center">アクション</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accountPositions.map(position => (
                            <TableRow key={position.id} className="hover:bg-gray-50/50">
                              <TableCell className="font-medium text-gray-900">{position.symbol}</TableCell>
                              <TableCell className="text-right text-gray-700">{position.volume.toFixed(2)}</TableCell>
                              <TableCell className="text-right text-gray-700">
                                {position.entryPrice.toFixed(position.symbol === 'USDJPY' ? 3 : 5)}
                              </TableCell>
                              <TableCell className="text-right text-gray-700">
                                {position.currentPrice.toFixed(position.symbol === 'USDJPY' ? 3 : 5)}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                              </TableCell>
                              <TableCell className="text-right text-gray-700">{position.trailWidth} pips</TableCell>
                              <TableCell className="text-center">
                                {position.triggerActions > 0 ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {position.triggerActions}件待機
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
                      この口座にはポジションがありません
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
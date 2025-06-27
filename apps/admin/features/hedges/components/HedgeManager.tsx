'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { GripVertical, TrendingUp, TrendingDown, ArrowRightLeft, AlertTriangle, CheckCircle, RefreshCw, BarChart } from 'lucide-react';

// Mock data types
interface HedgePair {
  id: string;
  accountPair: [string, string];
  symbol: string;
  buyPosition: {
    id: string;
    volume: number;
    entryPrice: number;
    currentPrice: number;
    profit: number;
  };
  sellPosition: {
    id: string;
    volume: number;
    entryPrice: number;
    currentPrice: number;
    profit: number;
  };
  netProfit: number;
  status: 'active' | 'closed' | 'partial';
  creditUtilization: number;
  createdAt: string;
}

interface NetPosition {
  symbol: string;
  netVolume: number;
  netValue: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  unrealizedPnL: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(value);
};

const formatVolume = (value: number) => {
  return new Intl.NumberFormat('ja-JP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Credit Utilization Chart Component
const CreditUtilizationChart: React.FC<{ 
  data: Array<{ label: string; used: number; total: number; color: string }> 
}> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.total));
  
  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const usedPercentage = (item.used / item.total) * 100;
        const isHighUtilization = usedPercentage > 80;
        
        return (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(item.used)} / {formatCurrency(item.total)}
                </span>
                <span className={`text-sm font-semibold ${
                  isHighUtilization ? 'text-red-600' : 'text-green-600'
                }`}>
                  {usedPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${
                  isHighUtilization ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(usedPercentage, 100)}%` }}
              />
            </div>
            {isHighUtilization && (
              <div className="flex items-center text-xs text-red-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                高使用率
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Sortable Hedge Pair Item
const SortableHedgePairItem: React.FC<{ hedgePair: HedgePair; onOptimize: (id: string) => void }> = ({ 
  hedgePair, 
  onOptimize 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: hedgePair.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isProfit = hedgePair.netProfit > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab hover:cursor-grabbing text-gray-400"
            >
              <GripVertical className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{hedgePair.symbol}</h3>
              <p className="text-sm text-muted-foreground">
                {hedgePair.accountPair[0]} ⇄ {hedgePair.accountPair[1]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hedgePair.status === 'active' ? 'default' : 'secondary'}>
              {hedgePair.status === 'active' ? 'アクティブ' : '部分決済'}
            </Badge>
            <Badge variant={isProfit ? 'default' : 'destructive'}>
              {isProfit ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {formatCurrency(hedgePair.netProfit)}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">買いポジション</p>
            <div className="bg-green-50 p-2 rounded">
              <p className="text-sm font-medium">{formatVolume(hedgePair.buyPosition.volume)}</p>
              <p className="text-xs text-muted-foreground">
                エントリー: {hedgePair.buyPosition.entryPrice}
              </p>
              <p className="text-xs text-green-600">
                {formatCurrency(hedgePair.buyPosition.profit)}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">売りポジション</p>
            <div className="bg-red-50 p-2 rounded">
              <p className="text-sm font-medium">{formatVolume(hedgePair.sellPosition.volume)}</p>
              <p className="text-xs text-muted-foreground">
                エントリー: {hedgePair.sellPosition.entryPrice}
              </p>
              <p className="text-xs text-red-600">
                {formatCurrency(hedgePair.sellPosition.profit)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">クレジット使用率:</span>
            <span className={`text-sm font-medium ${
              hedgePair.creditUtilization > 0.8 ? 'text-red-600' : 'text-green-600'
            }`}>
              {(hedgePair.creditUtilization * 100).toFixed(1)}%
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOptimize(hedgePair.id)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            最適化
          </Button>
        </div>
      </div>
    </div>
  );
};

// Net Position Card
const NetPositionCard: React.FC<{ netPosition: NetPosition }> = ({ netPosition }) => {
  const isNetLong = netPosition.netVolume > 0;
  const isProfit = netPosition.unrealizedPnL > 0;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{netPosition.symbol}</CardTitle>
          <Badge variant={isNetLong ? 'default' : 'destructive'}>
            {isNetLong ? 'ネットロング' : 'ネットショート'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ネットボリューム</p>
            <p className="text-xl font-semibold">{formatVolume(Math.abs(netPosition.netVolume))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ネット評価額</p>
            <p className="text-xl font-semibold">{formatCurrency(netPosition.netValue)}</p>
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">含み損益</span>
          <span className={`text-lg font-semibold ${
            isProfit ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(netPosition.unrealizedPnL)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span>買い総量: {formatVolume(netPosition.totalBuyVolume)}</span>
          </div>
          <div>
            <span>売り総量: {formatVolume(netPosition.totalSellVolume)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const HedgeManager: React.FC = () => {
  const [hedgePairs, setHedgePairs] = useState<HedgePair[]>([]);
  const [netPositions, setNetPositions] = useState<NetPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Mock data initialization
  useEffect(() => {
    const loadMockData = async () => {
      try {
        setLoading(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockHedgePairs: HedgePair[] = [
          {
            id: 'hedge-1',
            accountPair: ['XM-001', 'Exness-002'],
            symbol: 'USDJPY',
            buyPosition: {
              id: 'pos-1',
              volume: 1.0,
              entryPrice: 148.50,
              currentPrice: 149.20,
              profit: 7000
            },
            sellPosition: {
              id: 'pos-2',
              volume: 1.0,
              entryPrice: 149.00,
              currentPrice: 149.20,
              profit: -2000
            },
            netProfit: 5000,
            status: 'active',
            creditUtilization: 0.65,
            createdAt: '2025-01-28T10:00:00Z'
          },
          {
            id: 'hedge-2',
            accountPair: ['TitanFX-003', 'FXGT-004'],
            symbol: 'EURUSD',
            buyPosition: {
              id: 'pos-3',
              volume: 0.5,
              entryPrice: 1.0850,
              currentPrice: 1.0875,
              profit: 1250
            },
            sellPosition: {
              id: 'pos-4',
              volume: 0.5,
              entryPrice: 1.0870,
              currentPrice: 1.0875,
              profit: -250
            },
            netProfit: 1000,
            status: 'active',
            creditUtilization: 0.45,
            createdAt: '2025-01-28T11:30:00Z'
          },
          {
            id: 'hedge-3',
            accountPair: ['IC Markets-005', 'Pepperstone-006'],
            symbol: 'XAUUSD',
            buyPosition: {
              id: 'pos-5',
              volume: 0.1,
              entryPrice: 2650.0,
              currentPrice: 2645.0,
              profit: -500
            },
            sellPosition: {
              id: 'pos-6',
              volume: 0.1,
              entryPrice: 2640.0,
              currentPrice: 2645.0,
              profit: -500
            },
            netProfit: -1000,
            status: 'partial',
            creditUtilization: 0.85,
            createdAt: '2025-01-28T09:15:00Z'
          }
        ];

        const mockNetPositions: NetPosition[] = [
          {
            symbol: 'USDJPY',
            netVolume: 0.0,
            netValue: 0,
            totalBuyVolume: 1.0,
            totalSellVolume: 1.0,
            unrealizedPnL: 5000
          },
          {
            symbol: 'EURUSD',
            netVolume: 0.0,
            netValue: 0,
            totalBuyVolume: 0.5,
            totalSellVolume: 0.5,
            unrealizedPnL: 1000
          },
          {
            symbol: 'XAUUSD',
            netVolume: 0.0,
            netValue: 0,
            totalBuyVolume: 0.1,
            totalSellVolume: 0.1,
            unrealizedPnL: -1000
          }
        ];

        setHedgePairs(mockHedgePairs);
        setNetPositions(mockNetPositions);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadMockData();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setHedgePairs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });

      console.log('🔄 Hedge pair reordered:', { from: active.id, to: over.id });
    }
  };

  const handleOptimize = (hedgePairId: string) => {
    console.log('⚡ Optimizing hedge pair:', hedgePairId);
    // Implementation for optimization logic
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('🔄 Data refreshed');
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const creditUtilizationData = [
    { label: 'XM-001', used: 650000, total: 1000000, color: '#3b82f6' },
    { label: 'Exness-002', used: 450000, total: 750000, color: '#10b981' },
    { label: 'TitanFX-003', used: 850000, total: 1000000, color: '#ef4444' },
    { label: 'FXGT-004', used: 300000, total: 500000, color: '#f59e0b' },
  ];

  const totalStats = {
    totalPairs: hedgePairs.length,
    activePairs: hedgePairs.filter(p => p.status === 'active').length,
    totalProfit: hedgePairs.reduce((sum, p) => sum + p.netProfit, 0),
    avgCreditUtilization: hedgePairs.reduce((sum, p) => sum + p.creditUtilization, 0) / hedgePairs.length,
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">エラーが発生しました</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error.message}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              再読み込み
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">両建て管理</h1>
          <p className="text-muted-foreground">動的組み替えとクレジット最適化による効率的な両建て管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総ペア数</p>
                <p className="text-2xl font-bold">{totalStats.totalPairs}</p>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">アクティブペア</p>
                <p className="text-2xl font-bold text-green-600">{totalStats.activePairs}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総利益</p>
                <p className={`text-2xl font-bold ${
                  totalStats.totalProfit > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(totalStats.totalProfit)}
                </p>
              </div>
              {totalStats.totalProfit > 0 ? (
                <TrendingUp className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均使用率</p>
                <p className={`text-2xl font-bold ${
                  totalStats.avgCreditUtilization > 0.8 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {(totalStats.avgCreditUtilization * 100).toFixed(1)}%
                </p>
              </div>
              <BarChart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>両建てペア一覧</CardTitle>
              <p className="text-sm text-muted-foreground">
                ドラッグ&ドロップで優先順位を変更できます
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  読み込み中...
                </div>
              ) : hedgePairs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  両建てペアが登録されていません
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={hedgePairs.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {hedgePairs.map((hedgePair) => (
                        <SortableHedgePairItem
                          key={hedgePair.id}
                          hedgePair={hedgePair}
                          onOptimize={handleOptimize}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>

          {/* Net Positions */}
          <Card>
            <CardHeader>
              <CardTitle>ネットポジション</CardTitle>
              <p className="text-sm text-muted-foreground">
                各シンボルの実質的なエクスポージャー
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {netPositions.map((netPosition) => (
                  <NetPositionCard
                    key={netPosition.symbol}
                    netPosition={netPosition}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>クレジット活用率</CardTitle>
              <p className="text-sm text-muted-foreground">
                各口座のクレジット使用状況
              </p>
            </CardHeader>
            <CardContent>
              <CreditUtilizationChart data={creditUtilizationData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最適化提案</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  TitanFX-003の使用率が85%を超えています。クレジット配分の見直しを検討してください。
                </AlertDescription>
              </Alert>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  EURUSD両建てペアのバランスが良好です。現在の設定を維持することを推奨します。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>リアルタイム監視</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">価格更新</span>
                  <Badge variant="outline" className="bg-green-50">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
                    リアルタイム
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">残高同期</span>
                  <Badge variant="outline" className="bg-green-50">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                    同期済み
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">最終更新</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString('ja-JP')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
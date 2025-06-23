'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Progress } from '@repo/ui/components/ui/progress';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  RefreshCw,
  BarChart3,
  Clock
} from 'lucide-react';
import type { WithdrawalDashboardData, WithdrawalRisk } from '@repo/shared-types';

interface WithdrawalDashboardProps {
  className?: string;
}

// 模擬データ
const createMockWithdrawalData = (): WithdrawalDashboardData => ({
  accounts: [
    {
      id: 'account-1',
      broker: 'OANDA',
      accountNumber: '101-004-1234567-001',
      withdrawalScore: 85,
      riskLevel: 'SAFE',
      recommendations: ['✅ 出金可能レベルです'],
      metrics: {
        totalVolume: 45.2,
        systemRatio: 0.65,
        manualRatio: 0.35,
        lastManualTrade: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2時間前
      }
    },
    {
      id: 'account-2',
      broker: 'XM',
      accountNumber: '12345678',
      withdrawalScore: 42,
      riskLevel: 'CAUTION',
      recommendations: [
        '⚠️ システム取引比率が高すぎます（85%以上）',
        '💡 小ロットでの手動スキャルピングを推奨',
        '🎯 異なる時間帯での手動取引を推奨'
      ],
      metrics: {
        totalVolume: 23.8,
        systemRatio: 0.85,
        manualRatio: 0.15,
        lastManualTrade: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8時間前
      }
    },
    {
      id: 'account-3',
      broker: 'FXGT',
      accountNumber: '987654321',
      withdrawalScore: 25,
      riskLevel: 'DANGER',
      recommendations: [
        '🚨 出金リスク高 - 手動取引を増やしてください',
        '⚠️ システム取引比率が高すぎます（90%以上）',
        '📊 取引量が不足しています',
        '💰 あと65.2ロットの取引が必要です'
      ],
      metrics: {
        totalVolume: 34.8,
        systemRatio: 0.92,
        manualRatio: 0.08,
        lastManualTrade: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24時間前
      }
    }
  ]
});

const getRiskLevelColor = (risk: WithdrawalRisk): string => {
  switch (risk) {
    case 'SAFE': return 'text-green-600 bg-green-50 border-green-200';
    case 'CAUTION': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'DANGER': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getRiskIcon = (risk: WithdrawalRisk) => {
  switch (risk) {
    case 'SAFE': return <CheckCircle className="h-4 w-4" />;
    case 'CAUTION': return <AlertTriangle className="h-4 w-4" />;
    case 'DANGER': return <Shield className="h-4 w-4" />;
    default: return null;
  }
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const formatTimeSince = (date: Date): string => {
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return '1時間以内';
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
};

export function WithdrawalDashboard({ className }: WithdrawalDashboardProps) {
  const [data, setData] = useState<WithdrawalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // データ読み込み
  useEffect(() => {
    loadWithdrawalData();
    
    // 定期更新（5分ごと）
    const interval = setInterval(loadWithdrawalData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadWithdrawalData = async () => {
    try {
      setLoading(true);
      
      // TODO: 実際のAPI呼び出し
      // const response = await fetch('/api/withdrawal-analysis');
      // const withdrawalData = await response.json();
      
      // 模擬データ使用
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockData = createMockWithdrawalData();
      
      setData(mockData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load withdrawal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadWithdrawalData();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">出金監視データを読み込み中...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>出金監視データの読み込みに失敗しました。</AlertDescription>
      </Alert>
    );
  }

  const stats = {
    total: data.accounts.length,
    safe: data.accounts.filter(a => a.riskLevel === 'SAFE').length,
    caution: data.accounts.filter(a => a.riskLevel === 'CAUTION').length,
    danger: data.accounts.filter(a => a.riskLevel === 'DANGER').length,
    averageScore: Math.round(data.accounts.reduce((sum, a) => sum + a.withdrawalScore, 0) / data.accounts.length)
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">出金監視ダッシュボード</h1>
          <p className="text-sm text-gray-600">
            最終更新: {lastUpdate.toLocaleString('ja-JP')}
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">総アカウント数</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">安全</p>
                <p className="text-2xl font-bold text-green-600">{stats.safe}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">注意</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.caution}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">危険</p>
                <p className="text-2xl font-bold text-red-600">{stats.danger}</p>
              </div>
              <Shield className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">平均スコア</p>
                <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
                  {stats.averageScore}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* メインコンテンツ */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="details">詳細</TabsTrigger>
          <TabsTrigger value="recommendations">推奨アクション</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.accounts.map((account) => (
              <Card key={account.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{account.broker}</CardTitle>
                      <p className="text-sm text-gray-600">{account.accountNumber}</p>
                    </div>
                    <Badge className={`${getRiskLevelColor(account.riskLevel)} flex items-center gap-1`}>
                      {getRiskIcon(account.riskLevel)}
                      {account.riskLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* スコア */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">出金安全度</span>
                        <span className={`text-lg font-bold ${getScoreColor(account.withdrawalScore)}`}>
                          {account.withdrawalScore}/100
                        </span>
                      </div>
                      <Progress value={account.withdrawalScore} className="h-2" />
                    </div>

                    {/* 取引比率 */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">システム取引</p>
                        <p className="font-medium">{(account.metrics.systemRatio * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">手動取引</p>
                        <p className="font-medium">{(account.metrics.manualRatio * 100).toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* 取引量・最終手動取引 */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">総取引量</p>
                        <p className="font-medium">{account.metrics.totalVolume} lots</p>
                      </div>
                      <div>
                        <p className="text-gray-600">最終手動取引</p>
                        <p className="font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {account.metrics.lastManualTrade ? 
                            formatTimeSince(account.metrics.lastManualTrade) : 
                            'なし'
                          }
                        </p>
                      </div>
                    </div>

                    {/* 推奨（最初の1つだけ表示） */}
                    {account.recommendations.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-1">推奨アクション</p>
                        <p className="text-sm">{account.recommendations[0]}</p>
                        {account.recommendations.length > 1 && (
                          <p className="text-xs text-gray-500 mt-1">
                            他 {account.recommendations.length - 1} 件
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>詳細分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {data.accounts.map((account) => (
                  <div key={account.id} className="border-b pb-6 last:border-b-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">
                        {account.broker} - {account.accountNumber}
                      </h3>
                      <Badge className={getRiskLevelColor(account.riskLevel)}>
                        {account.riskLevel}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">出金安全度</p>
                        <div className="flex items-center gap-2">
                          <Progress value={account.withdrawalScore} className="flex-1 h-2" />
                          <span className={`font-bold ${getScoreColor(account.withdrawalScore)}`}>
                            {account.withdrawalScore}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">取引比率分析</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>システム:</span>
                            <span className="font-medium">{(account.metrics.systemRatio * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>手動:</span>
                            <span className="font-medium">{(account.metrics.manualRatio * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-gray-600 mb-1">取引統計</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>総取引量:</span>
                            <span className="font-medium">{account.metrics.totalVolume} lots</span>
                          </div>
                          <div className="flex justify-between">
                            <span>最終手動:</span>
                            <span className="font-medium">
                              {account.metrics.lastManualTrade ? 
                                formatTimeSince(account.metrics.lastManualTrade) : 
                                'なし'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <div className="space-y-6">
            {data.accounts.map((account) => (
              account.recommendations.length > 0 && (
                <Card key={account.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {account.broker} - {account.accountNumber}
                      </CardTitle>
                      <Badge className={getRiskLevelColor(account.riskLevel)}>
                        {account.riskLevel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {account.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <p className="text-sm">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
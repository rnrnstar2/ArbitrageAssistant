"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Progress } from "@repo/ui/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { RefreshCwIcon, TrendingUpIcon, ClockIcon, BarChart3Icon, PieChartIcon } from "lucide-react";

interface RotationData {
  symbol: string;
  totalPositions: number;
  closedPositions: number;
  rotationRate: number;
  averageHoldingTime: number;
  efficiency: number;
  trend: "up" | "down" | "stable";
}

interface TimeSeriesData {
  date: string;
  opened: number;
  closed: number;
  rotationRate: number;
}

interface EfficiencyMetrics {
  overallRotationRate: number;
  optimalRate: number;
  efficiency: number;
  improvement: number;
  topPerformers: string[];
  underPerformers: string[];
}

export function PositionRotationChart() {
  const [rotationData, setRotationData] = useState<RotationData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [efficiencyMetrics, setEfficiencyMetrics] = useState<EfficiencyMetrics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [selectedView, setSelectedView] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRotationData();
  }, [selectedPeriod]);

  const fetchRotationData = async () => {
    setIsLoading(true);
    try {
      // TODO: 実際のAPIコールを実装
      // const data = await PositionManagementService.getRotationAnalysis(selectedPeriod);
      
      // モックデータ
      setRotationData([
        { symbol: "EURUSD", totalPositions: 15, closedPositions: 12, rotationRate: 80, averageHoldingTime: 2.3, efficiency: 92, trend: "up" },
        { symbol: "GBPUSD", totalPositions: 12, closedPositions: 8, rotationRate: 67, averageHoldingTime: 3.1, efficiency: 78, trend: "stable" },
        { symbol: "USDJPY", totalPositions: 18, closedPositions: 16, rotationRate: 89, averageHoldingTime: 1.9, efficiency: 95, trend: "up" },
        { symbol: "USDCHF", totalPositions: 8, closedPositions: 5, rotationRate: 63, averageHoldingTime: 4.2, efficiency: 65, trend: "down" },
        { symbol: "AUDUSD", totalPositions: 10, closedPositions: 9, rotationRate: 90, averageHoldingTime: 2.1, efficiency: 88, trend: "up" },
      ]);

      setTimeSeriesData([
        { date: "6/13", opened: 8, closed: 6, rotationRate: 75 },
        { date: "6/14", opened: 12, closed: 10, rotationRate: 83 },
        { date: "6/15", opened: 15, closed: 11, rotationRate: 73 },
        { date: "6/16", opened: 9, closed: 13, rotationRate: 81 },
        { date: "6/17", opened: 11, closed: 9, rotationRate: 82 },
        { date: "6/18", opened: 14, closed: 12, rotationRate: 86 },
        { date: "6/19", opened: 10, closed: 8, rotationRate: 80 },
      ]);

      setEfficiencyMetrics({
        overallRotationRate: 77.8,
        optimalRate: 85,
        efficiency: 91.5,
        improvement: 7.2,
        topPerformers: ["USDJPY", "AUDUSD", "EURUSD"],
        underPerformers: ["USDCHF"],
      });
    } catch (error) {
      console.error("Error fetching rotation data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUpIcon className="h-4 w-4 text-green-500" />;
      case "down": return <TrendingUpIcon className="h-4 w-4 text-red-500 rotate-180" />;
      default: return <span className="h-4 w-4 text-gray-400">→</span>;
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600";
    if (efficiency >= 75) return "text-yellow-600";
    return "text-red-600";
  };

  const getEfficiencyBadge = (efficiency: number): "default" | "secondary" | "destructive" => {
    if (efficiency >= 90) return "default";
    if (efficiency >= 75) return "secondary";
    return "destructive";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="text-gray-500">ポジション回転率分析を読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>ポジション回転率分析</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1日</SelectItem>
                <SelectItem value="7d">7日</SelectItem>
                <SelectItem value="30d">30日</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchRotationData}>
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedView} onValueChange={setSelectedView}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="details">詳細分析</TabsTrigger>
            <TabsTrigger value="trends">トレンド</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* 全体メトリクス */}
            {efficiencyMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <RefreshCwIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">全体回転率</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {efficiencyMetrics.overallRotationRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    目標: {efficiencyMetrics.optimalRate}%
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3Icon className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">効率性</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {efficiencyMetrics.efficiency.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    前期比: +{efficiencyMetrics.improvement.toFixed(1)}%
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUpIcon className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-600">優秀ペア</span>
                  </div>
                  <div className="text-lg font-bold text-purple-600">
                    {efficiencyMetrics.topPerformers.length}
                  </div>
                  <div className="text-xs text-gray-500">
                    {efficiencyMetrics.topPerformers.join(", ")}
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <ClockIcon className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-600">改善余地</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {(efficiencyMetrics.optimalRate - efficiencyMetrics.overallRotationRate).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    改善ポテンシャル
                  </div>
                </div>
              </div>
            )}

            {/* 通貨ペア別パフォーマンス */}
            <div className="space-y-3">
              <h4 className="font-medium">通貨ペア別回転効率</h4>
              {rotationData.map((item) => (
                <div key={item.symbol} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{item.symbol}</span>
                      {getTrendIcon(item.trend)}
                      <Badge variant={getEfficiencyBadge(item.efficiency)}>
                        効率{item.efficiency}%
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {item.rotationRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.closedPositions}/{item.totalPositions}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>回転率</span>
                      <Progress value={item.rotationRate} className="w-32" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>平均保有時間: {item.averageHoldingTime.toFixed(1)}日</span>
                      <span className={getEfficiencyColor(item.efficiency)}>
                        効率性: {item.efficiency}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 詳細統計 */}
              <div className="space-y-3">
                <h4 className="font-medium">詳細統計</h4>
                <div className="space-y-2">
                  {rotationData.map((item) => (
                    <div key={item.symbol} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{item.symbol}</span>
                        <span className={`text-sm ${getEfficiencyColor(item.efficiency)}`}>
                          {item.efficiency}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>総ポジション: {item.totalPositions}</div>
                        <div>決済済み: {item.closedPositions}</div>
                        <div>平均保有: {item.averageHoldingTime.toFixed(1)}日</div>
                        <div>回転率: {item.rotationRate.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* パフォーマンス分析 */}
              <div className="space-y-3">
                <h4 className="font-medium">パフォーマンス分析</h4>
                <div className="space-y-2">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="font-medium text-green-800 mb-1">優秀なペア</div>
                    <div className="text-sm text-green-700">
                      {efficiencyMetrics?.topPerformers.map(symbol => {
                        const data = rotationData.find(d => d.symbol === symbol);
                        return (
                          <div key={symbol} className="flex justify-between">
                            <span>{symbol}</span>
                            <span>{data?.rotationRate.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="font-medium text-yellow-800 mb-1">改善が必要</div>
                    <div className="text-sm text-yellow-700">
                      {efficiencyMetrics?.underPerformers.map(symbol => {
                        const data = rotationData.find(d => d.symbol === symbol);
                        return (
                          <div key={symbol} className="flex justify-between">
                            <span>{symbol}</span>
                            <span>{data?.rotationRate.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded">
                    <div className="font-medium text-blue-800 mb-1">改善提案</div>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div>• 保有期間を3日以下に最適化</div>
                      <div>• 低効率ペアの決済ルール強化</div>
                      <div>• トレール設定による効率向上</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            {/* 時系列チャート（簡易版） */}
            <div className="space-y-3">
              <h4 className="font-medium">回転率トレンド（過去7日）</h4>
              <div className="space-y-2">
                {timeSeriesData.map((item, index) => (
                  <div key={item.date} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{item.date}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-blue-600">
                        開始: {item.opened}
                      </span>
                      <span className="text-sm text-green-600">
                        決済: {item.closed}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Progress value={item.rotationRate} className="w-16" />
                        <span className="text-sm font-medium w-12">
                          {item.rotationRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* トレンド分析 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-medium text-blue-800 mb-2">トレンド分析</h5>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• 回転率は過去7日間で安定した80%前後を維持</p>
                <p>• USDJPY、AUDUSDが継続的に高効率を達成</p>
                <p>• USDCHFは改善傾向にあるが、さらなる最適化が必要</p>
                <p>• 全体として効率的なポジション管理が実現されている</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
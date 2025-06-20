"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Progress } from "@repo/ui/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { TrendingDownIcon, AlertTriangleIcon, DollarSignIcon, ClockIcon } from "lucide-react";

interface SwapCostData {
  symbol: string;
  totalCost: number;
  dailyCost: number;
  positionCount: number;
  averageHoldingDays: number;
  savingsPotential: number;
}

interface SwapSavingsData {
  totalSaved: number;
  byCloseType: {
    dailyRotation: number;
    profitTaking: number;
    riskManagement: number;
  };
  monthlyTrend: Array<{
    month: string;
    saved: number;
    cost: number;
  }>;
}

export function SwapCostAnalysis() {
  const [swapCosts, setSwapCosts] = useState<SwapCostData[]>([]);
  const [swapSavings, setSwapSavings] = useState<SwapSavingsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("costs");

  useEffect(() => {
    fetchSwapData();
  }, []);

  const fetchSwapData = async () => {
    setIsLoading(true);
    try {
      // TODO: 実際のAPIコールを実装
      // const costs = await PositionManagementService.getSwapCostAnalysis();
      // const savings = await PositionManagementService.getSwapSavingsData();
      
      // モックデータ
      setSwapCosts([
        { symbol: "EURUSD", totalCost: 45.67, dailyCost: 2.3, positionCount: 3, averageHoldingDays: 4.2, savingsPotential: 15.2 },
        { symbol: "GBPUSD", totalCost: 32.45, dailyCost: 1.8, positionCount: 2, averageHoldingDays: 5.1, savingsPotential: 12.8 },
        { symbol: "USDJPY", totalCost: 28.90, dailyCost: 1.5, positionCount: 4, averageHoldingDays: 3.8, savingsPotential: 8.9 },
        { symbol: "USDCHF", totalCost: 15.23, dailyCost: 0.9, positionCount: 1, averageHoldingDays: 6.2, savingsPotential: 6.1 },
        { symbol: "AUDUSD", totalCost: 12.78, dailyCost: 0.7, positionCount: 2, averageHoldingDays: 3.5, savingsPotential: 4.3 },
      ]);

      setSwapSavings({
        totalSaved: 234.56,
        byCloseType: {
          dailyRotation: 145.23,
          profitTaking: 56.78,
          riskManagement: 32.55,
        },
        monthlyTrend: [
          { month: "1月", saved: 78.45, cost: 123.67 },
          { month: "2月", saved: 92.34, cost: 134.23 },
          { month: "3月", saved: 89.12, cost: 145.89 },
          { month: "4月", saved: 112.67, cost: 156.78 },
          { month: "5月", saved: 134.56, cost: 167.45 },
          { month: "6月", saved: 156.78, cost: 178.90 },
        ],
      });
    } catch (error) {
      console.error("Error fetching swap data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalSwapCost = () => swapCosts.reduce((sum, item) => sum + item.totalCost, 0);
  const getTotalSavingsPotential = () => swapCosts.reduce((sum, item) => sum + item.savingsPotential, 0);

  const getCostSeverity = (dailyCost: number) => {
    if (dailyCost > 2) return "high";
    if (dailyCost > 1) return "medium";
    return "low";
  };

  const getCostColor = (severity: string) => {
    switch (severity) {
      case "high": return "text-red-600";
      case "medium": return "text-yellow-600";
      default: return "text-green-600";
    }
  };

  const getCostBadgeVariant = (severity: string): "default" | "secondary" | "destructive" => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "default";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="text-gray-500">スワップコスト分析を読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>スワップコスト分析</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchSwapData}>
            更新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="costs">現在のコスト</TabsTrigger>
            <TabsTrigger value="savings">節約実績</TabsTrigger>
            <TabsTrigger value="optimization">最適化提案</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4">
            {/* 全体サマリー */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingDownIcon className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-600">総スワップコスト</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  -${getTotalSwapCost().toFixed(2)}
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-600">削減可能額</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  ${getTotalSavingsPotential().toFixed(2)}
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <ClockIcon className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600">オープンポジション</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {swapCosts.reduce((sum, item) => sum + item.positionCount, 0)}
                </div>
              </div>
            </div>

            {/* 通貨ペア別詳細 */}
            <div className="space-y-3">
              <h4 className="font-medium">通貨ペア別スワップコスト</h4>
              {swapCosts.map((item) => {
                const severity = getCostSeverity(item.dailyCost);
                return (
                  <div key={item.symbol} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{item.symbol}</span>
                        <Badge variant={getCostBadgeVariant(severity)}>
                          {severity === "high" ? "高コスト" : severity === "medium" ? "中コスト" : "低コスト"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          -${item.totalCost.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">
                          日次: -${item.dailyCost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">ポジション数</div>
                        <div className="font-medium">{item.positionCount}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">平均保有期間</div>
                        <div className="font-medium">{item.averageHoldingDays.toFixed(1)}日</div>
                      </div>
                      <div>
                        <div className="text-gray-500">削減可能額</div>
                        <div className="font-medium text-green-600">
                          ${item.savingsPotential.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">削減率</div>
                        <div className="font-medium">
                          {((item.savingsPotential / item.totalCost) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="savings" className="space-y-4">
            {swapSavings && (
              <>
                {/* 節約実績サマリー */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSignIcon className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">総節約額</span>
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    +${swapSavings.totalSaved.toFixed(2)}
                  </div>
                </div>

                {/* 節約方法別内訳 */}
                <div className="space-y-3">
                  <h4 className="font-medium">節約方法別内訳</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>日次ポジション整理</span>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={(swapSavings.byCloseType.dailyRotation / swapSavings.totalSaved) * 100} 
                          className="w-20" 
                        />
                        <span className="font-medium text-green-600">
                          +${swapSavings.byCloseType.dailyRotation.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>利益確定決済</span>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={(swapSavings.byCloseType.profitTaking / swapSavings.totalSaved) * 100} 
                          className="w-20" 
                        />
                        <span className="font-medium text-green-600">
                          +${swapSavings.byCloseType.profitTaking.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>リスク管理決済</span>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={(swapSavings.byCloseType.riskManagement / swapSavings.totalSaved) * 100} 
                          className="w-20" 
                        />
                        <span className="font-medium text-green-600">
                          +${swapSavings.byCloseType.riskManagement.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 月次トレンド */}
                <div className="space-y-3">
                  <h4 className="font-medium">月次節約トレンド</h4>
                  <div className="space-y-2">
                    {swapSavings.monthlyTrend.map((trend) => (
                      <div key={trend.month} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium">{trend.month}</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500">
                            コスト: ${trend.cost.toFixed(2)}
                          </span>
                          <span className="font-medium text-green-600">
                            節約: +${trend.saved.toFixed(2)}
                          </span>
                          <span className="text-sm">
                            ({((trend.saved / trend.cost) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <div className="space-y-4">
              <h4 className="font-medium">最適化提案</h4>
              
              {/* 高優先度提案 */}
              <div className="space-y-3">
                {swapCosts
                  .filter(item => getCostSeverity(item.dailyCost) === "high")
                  .map((item) => (
                    <div key={item.symbol} className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium text-red-800">{item.symbol} - 緊急対応推奨</h5>
                          <p className="text-sm text-red-700 mt-1">
                            日次コスト${item.dailyCost.toFixed(2)}は許容範囲を超えています
                          </p>
                          <ul className="text-sm text-red-700 mt-2 space-y-1">
                            <li>• 即座にポジション整理を実行</li>
                            <li>• ${item.savingsPotential.toFixed(2)}の節約が可能</li>
                            <li>• 平均保有期間を{item.averageHoldingDays.toFixed(1)}日から3日以下に短縮</li>
                          </ul>
                        </div>
                        <Button variant="destructive" size="sm">
                          今すぐ整理
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* 中優先度提案 */}
                {swapCosts
                  .filter(item => getCostSeverity(item.dailyCost) === "medium")
                  .map((item) => (
                    <div key={item.symbol} className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium text-yellow-800">{item.symbol} - 最適化推奨</h5>
                          <p className="text-sm text-yellow-700 mt-1">
                            保有期間の最適化で${item.savingsPotential.toFixed(2)}の節約が可能
                          </p>
                          <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                            <li>• 5日以内にポジション整理を検討</li>
                            <li>• トレール設定による利益確保を併用</li>
                          </ul>
                        </div>
                        <Button variant="outline" size="sm">
                          整理予約
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* 全体最適化提案 */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h5 className="font-medium text-blue-800 mb-2">システム全体の最適化</h5>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• 日次自動整理ルールを設定: ${getTotalSavingsPotential().toFixed(2)}/月の追加節約</p>
                    <p>• アラート通知で手動整理のタイミング最適化</p>
                    <p>• 両建てペアの同期決済で効率向上</p>
                  </div>
                  <div className="mt-3 space-x-2">
                    <Button variant="outline" size="sm">
                      自動ルール設定
                    </Button>
                    <Button variant="outline" size="sm">
                      アラート設定
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
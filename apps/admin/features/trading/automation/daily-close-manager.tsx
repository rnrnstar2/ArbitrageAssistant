"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Switch } from "@repo/ui/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  ClockIcon, 
  DollarSignIcon, 
  PlayIcon, 
  PauseIcon, 
  SettingsIcon, 
  TrendingUpIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  CalendarIcon,
  CheckIcon,
  XIcon
} from "lucide-react";
import { Position } from "../../monitoring/types";
import { CloseRecommendation } from "../close/types";
import { PositionManagementService } from "../services/position-management-service";

interface SwapCostInfo {
  positionId: string;
  dailySwapCost: number;
  weeklySwapCost: number;
  cumulativeSwapCost: number;
  swapRate: number;
}

interface DailyCloseSettings {
  autoEnabled: boolean;
  executionTime: string; // "HH:mm" format
  minSwapCostThreshold: number;
  minHoldingDays: number;
  rebuildAfterClose: boolean;
  rebuildDelayMinutes: number;
  notificationEnabled: boolean;
  dryRunMode: boolean;
}

interface DailyCloseProposal {
  id: string;
  position: Position;
  swapInfo: SwapCostInfo;
  recommendation: CloseRecommendation;
  action: "close_only" | "close_and_rebuild";
  estimatedSavings: number;
  priority: "low" | "medium" | "high";
  selected: boolean;
}

export function DailyCloseManager() {
  const [proposals, setProposals] = useState<DailyCloseProposal[]>([]);
  const [settings, setSettings] = useState<DailyCloseSettings>({
    autoEnabled: false,
    executionTime: "23:30",
    minSwapCostThreshold: 5.0,
    minHoldingDays: 1,
    rebuildAfterClose: true,
    rebuildDelayMinutes: 30,
    notificationEnabled: true,
    dryRunMode: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecutionTime, setLastExecutionTime] = useState<Date | null>(null);
  const [nextExecutionTime, setNextExecutionTime] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDailyCloseProposals();
    calculateNextExecutionTime();
    
    // 30秒ごとに更新
    const interval = setInterval(() => {
      fetchDailyCloseProposals();
      calculateNextExecutionTime();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [settings.executionTime]);

  const fetchDailyCloseProposals = async () => {
    setIsLoading(true);
    try {
      // 既存のクローズ推奨機能を使用
      const recommendations = await PositionManagementService.getDailyCloseRecommendations();
      
      // スワップコスト情報を追加計算
      const proposalsWithSwapInfo: DailyCloseProposal[] = [];
      
      for (const recommendation of recommendations) {
        const position = await getPositionById(recommendation.positionId);
        if (!position) continue;

        const swapInfo = calculateSwapCostInfo(position);
        
        // スワップコストが閾値を超える場合のみ含める
        if (swapInfo.dailySwapCost >= settings.minSwapCostThreshold) {
          proposalsWithSwapInfo.push({
            id: `daily-${recommendation.positionId}`,
            position,
            swapInfo,
            recommendation,
            action: settings.rebuildAfterClose ? "close_and_rebuild" : "close_only",
            estimatedSavings: calculateEstimatedSavings(swapInfo, recommendation),
            priority: determinePriority(swapInfo, recommendation),
            selected: false,
          });
        }
      }

      setProposals(proposalsWithSwapInfo);
    } catch (error) {
      console.error("Error fetching daily close proposals:", error);
      toast({
        title: "エラー",
        description: "日次整理提案の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPositionById = async (positionId: string): Promise<Position | null> => {
    // TODO: 実際のポジション取得処理を実装
    // モックデータを返す
    const mockPosition: Position = {
      id: positionId,
      accountId: "acc1",
      symbol: "EURUSD",
      type: "buy",
      lots: 1.0,
      openPrice: 1.0850,
      currentPrice: 1.0865,
      profit: 15.0,
      openTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updateTime: new Date(),
    };
    return mockPosition;
  };

  const calculateSwapCostInfo = (position: Position): SwapCostInfo => {
    // 仮のスワップレート計算（実際はブローカーAPIから取得）
    const swapRates: { [symbol: string]: number } = {
      "EURUSD": -0.5,
      "GBPUSD": -0.8,
      "USDJPY": -0.3,
      "AUDUSD": -0.6,
      "USDCAD": -0.4,
    };

    const baseSwapRate = swapRates[position.symbol] || -0.5;
    const swapRate = position.type === "buy" ? baseSwapRate : -baseSwapRate;
    const dailySwapCost = Math.abs(swapRate * position.lots);
    const holdingDays = Math.ceil((Date.now() - position.openTime.getTime()) / (1000 * 60 * 60 * 24));

    return {
      positionId: position.id,
      dailySwapCost,
      weeklySwapCost: dailySwapCost * 7,
      cumulativeSwapCost: dailySwapCost * holdingDays,
      swapRate,
    };
  };

  const calculateEstimatedSavings = (swapInfo: SwapCostInfo, recommendation: CloseRecommendation): number => {
    // 今後1週間のスワップコスト節約額を計算
    return swapInfo.weeklySwapCost;
  };

  const determinePriority = (swapInfo: SwapCostInfo, recommendation: CloseRecommendation): "low" | "medium" | "high" => {
    if (swapInfo.dailySwapCost > 10 || recommendation.priority === "high") return "high";
    if (swapInfo.dailySwapCost > 5 || recommendation.priority === "medium") return "medium";
    return "low";
  };

  const calculateNextExecutionTime = () => {
    const now = new Date();
    const [hours, minutes] = settings.executionTime.split(":").map(Number);
    const nextExecution = new Date();
    nextExecution.setHours(hours, minutes, 0, 0);
    
    // 今日の実行時刻が過ぎている場合は明日に設定
    if (nextExecution <= now) {
      nextExecution.setDate(nextExecution.getDate() + 1);
    }
    
    setNextExecutionTime(nextExecution);
  };

  const executeManualClose = async () => {
    const selectedProposals = proposals.filter(p => p.selected);
    if (selectedProposals.length === 0) {
      toast({
        title: "選択エラー",
        description: "決済するポジションを選択してください",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      for (const proposal of selectedProposals) {
        if (settings.dryRunMode) {
          console.log("DRY RUN: Would close position", proposal.position.id);
          await new Promise(resolve => setTimeout(resolve, 500)); // 処理時間をシミュレート
        } else {
          // 実際の決済処理
          await PositionManagementService.closePosition({
            positionId: proposal.position.id,
            closePrice: proposal.position.currentPrice,
            closeType: "market",
          });

          // 再構築が設定されている場合
          if (proposal.action === "close_and_rebuild") {
            await new Promise(resolve => setTimeout(resolve, settings.rebuildDelayMinutes * 60 * 1000));
            // TODO: 再構築処理を実装
          }
        }
      }

      setLastExecutionTime(new Date());
      toast({
        title: "実行完了",
        description: `${selectedProposals.length} ポジションの日次整理を${settings.dryRunMode ? "シミュレート" : "実行"}しました`,
      });

      // 提案リストを再取得
      await fetchDailyCloseProposals();
    } catch (error) {
      console.error("Error executing daily close:", error);
      toast({
        title: "実行エラー",
        description: "日次整理の実行に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleProposalSelection = (proposalId: string) => {
    setProposals(proposals.map(p => 
      p.id === proposalId ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAllProposals = () => {
    const hasUnselected = proposals.some(p => !p.selected);
    setProposals(proposals.map(p => ({ ...p, selected: hasUnselected })));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600 bg-red-50 border-red-200";
      case "medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default: return "text-green-600 bg-green-50 border-green-200";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high": return <AlertTriangleIcon className="h-4 w-4 text-red-500" />;
      case "medium": return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      default: return <CheckIcon className="h-4 w-4 text-green-500" />;
    }
  };

  const selectedCount = proposals.filter(p => p.selected).length;
  const totalSavings = proposals.filter(p => p.selected).reduce((sum, p) => sum + p.estimatedSavings, 0);

  return (
    <div className="space-y-6">
      {/* ヘッダー & 設定 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5" />
              <span>日次ポジション整理</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDailyCloseProposals}
                disabled={isLoading}
              >
                <RefreshCwIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
              >
                <SettingsIcon className="h-4 w-4" />
                設定
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 自動実行設定 */}
            <div className="space-y-4">
              <h3 className="font-medium">自動実行設定</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm">自動実行</label>
                  <Switch 
                    checked={settings.autoEnabled}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, autoEnabled: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm">実行時刻</label>
                  <Select 
                    value={settings.executionTime}
                    onValueChange={(value) => 
                      setSettings({ ...settings, executionTime: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="22:00">22:00</SelectItem>
                      <SelectItem value="22:30">22:30</SelectItem>
                      <SelectItem value="23:00">23:00</SelectItem>
                      <SelectItem value="23:30">23:30</SelectItem>
                      <SelectItem value="00:00">00:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">ドライランモード</label>
                  <Switch 
                    checked={settings.dryRunMode}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, dryRunMode: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 実行状況 */}
            <div className="space-y-4">
              <h3 className="font-medium">実行状況</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">次回実行時刻</div>
                  <div className="font-medium">
                    {nextExecutionTime ? nextExecutionTime.toLocaleString() : "設定なし"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">前回実行時刻</div>
                  <div className="font-medium">
                    {lastExecutionTime ? lastExecutionTime.toLocaleString() : "未実行"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">自動実行状態</div>
                  <div className="flex items-center space-x-2">
                    {settings.autoEnabled ? (
                      <PlayIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <PauseIcon className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={settings.autoEnabled ? "text-green-600" : "text-gray-500"}>
                      {settings.autoEnabled ? "有効" : "無効"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 統計情報 */}
            <div className="space-y-4">
              <h3 className="font-medium">統計情報</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">対象ポジション</div>
                  <div className="text-2xl font-bold text-blue-600">{proposals.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">選択中</div>
                  <div className="text-2xl font-bold text-green-600">{selectedCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">予想節約額</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${totalSavings.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日次整理提案リスト */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>整理対象ポジション</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllProposals}
              >
                {proposals.every(p => p.selected) ? "全選択解除" : "全選択"}
              </Button>
              <Button
                onClick={executeManualClose}
                disabled={selectedCount === 0 || isExecuting}
                className="min-w-24"
              >
                {isExecuting ? "実行中..." : `実行 (${selectedCount})`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              提案を読み込み中...
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              現在、日次整理が必要なポジションはありません
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((proposal) => (
                <Card 
                  key={proposal.id}
                  className={`border-l-4 ${getPriorityColor(proposal.priority)} ${proposal.selected ? 'ring-2 ring-blue-200' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={proposal.selected}
                        onCheckedChange={() => toggleProposalSelection(proposal.id)}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getPriorityIcon(proposal.priority)}
                          <span className="font-medium">
                            {proposal.position.symbol} 
                            {proposal.position.type === "buy" ? " 買い" : " 売り"} 
                            {proposal.position.lots}lot
                          </span>
                          <Badge variant="outline">{proposal.priority === "high" ? "高優先度" : proposal.priority === "medium" ? "中優先度" : "低優先度"}</Badge>
                          <Badge variant="secondary">
                            {proposal.action === "close_and_rebuild" ? "決済→再構築" : "決済のみ"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-gray-500">現在損益</div>
                            <div className={`font-medium ${proposal.position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${proposal.position.profit.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">日次スワップ</div>
                            <div className="font-medium text-red-600">
                              -${proposal.swapInfo.dailySwapCost.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">累積スワップ</div>
                            <div className="font-medium text-red-600">
                              -${proposal.swapInfo.cumulativeSwapCost.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">保有日数</div>
                            <div className="font-medium">
                              {proposal.recommendation.holdingDays}日
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">週間節約見込み</div>
                            <div className="font-medium text-green-600">
                              +${proposal.estimatedSavings.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          開始: {proposal.position.openTime.toLocaleDateString()} | 
                          現在価格: {proposal.position.currentPrice.toFixed(5)} | 
                          スワップレート: {proposal.swapInfo.swapRate.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 実行サマリー */}
      {selectedCount > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-blue-900">
                  {selectedCount} ポジションを選択中
                </div>
                <div className="text-sm text-blue-700">
                  予想節約額: ${totalSavings.toFixed(2)} / 週
                  {settings.dryRunMode && (
                    <Badge variant="secondary" className="ml-2">ドライランモード</Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={executeManualClose}
                disabled={isExecuting}
                size="lg"
              >
                {isExecuting ? "実行中..." : "日次整理を実行"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
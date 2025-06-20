"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, TargetIcon, ClockIcon } from "lucide-react";
import { ClosingSummary } from "../close/types";

interface DailyCloseSummaryProps {
  onDateRangeChange?: (from: Date, to: Date) => void;
}

export function DailyCloseSummary({ onDateRangeChange }: DailyCloseSummaryProps) {
  const [dateFrom, setDateFrom] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7日前
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [summary, setSummary] = useState<ClosingSummary>({
    dailyCloseCount: 0,
    totalProfit: 0,
    swapSaved: 0,
    averageHoldingPeriod: 0,
    successRate: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
    onDateRangeChange?.(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      // TODO: 実際のAPIコールを実装
      // const result = await PositionManagementService.getClosingSummary(dateFrom, dateTo);
      
      // モックデータ
      setSummary({
        dailyCloseCount: 24,
        totalProfit: 1247.56,
        swapSaved: 89.23,
        averageHoldingPeriod: 3.2,
        successRate: 87.5,
      });
    } catch (error) {
      console.error("Error fetching closing summary:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const isPositive = amount >= 0;
    return (
      <span className={isPositive ? "text-green-600" : "text-red-600"}>
        {isPositive ? "+" : ""}${amount.toFixed(2)}
      </span>
    );
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 75) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>決済サマリー</CardTitle>
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateFrom, "MM/dd")} - {format(dateTo, "MM/dd")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex">
                  <div className="p-3">
                    <div className="text-sm font-medium mb-2">開始日</div>
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(date)}
                      initialFocus
                    />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium mb-2">終了日</div>
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(date)}
                      initialFocus
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={fetchSummary} disabled={isLoading}>
              更新
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 決済回数 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <TargetIcon className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-500">決済回数</span>
              </div>
              <div className="text-2xl font-bold">{summary.dailyCloseCount}</div>
              <div className="text-xs text-gray-500">
                1日平均: {(summary.dailyCloseCount / Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)))).toFixed(1)}
              </div>
            </div>

            {/* 総損益 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {summary.totalProfit >= 0 ? (
                  <TrendingUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-gray-500">総損益</span>
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalProfit)}
              </div>
              <div className="text-xs text-gray-500">
                平均: {formatCurrency(summary.totalProfit / Math.max(1, summary.dailyCloseCount))}
              </div>
            </div>

            {/* スワップ節約額 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-500">スワップ節約</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                +${summary.swapSaved.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">
                コスト削減効果
              </div>
            </div>

            {/* 平均保有期間 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-gray-500">平均保有期間</span>
              </div>
              <div className="text-2xl font-bold">{summary.averageHoldingPeriod.toFixed(1)}</div>
              <div className="text-xs text-gray-500">日</div>
            </div>

            {/* 成功率 */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center space-x-2">
                <TargetIcon className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-500">決済成功率</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`text-2xl font-bold ${getSuccessRateColor(summary.successRate)}`}>
                  {summary.successRate.toFixed(1)}%
                </div>
                <Badge variant={summary.successRate >= 90 ? "default" : summary.successRate >= 75 ? "secondary" : "destructive"}>
                  {summary.successRate >= 90 ? "優秀" : summary.successRate >= 75 ? "良好" : "要改善"}
                </Badge>
              </div>
            </div>

            {/* 効果指標 */}
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm text-gray-500">日次整理効果</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>利益率向上:</span>
                  <span className="text-green-600">
                    +{((summary.swapSaved / Math.max(1, Math.abs(summary.totalProfit))) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>効率的保有期間:</span>
                  <span className={summary.averageHoldingPeriod <= 5 ? "text-green-600" : "text-yellow-600"}>
                    {summary.averageHoldingPeriod <= 5 ? "最適" : "要最適化"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 詳細分析へのリンク */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              期間: {format(dateFrom, "yyyy/MM/dd")} - {format(dateTo, "yyyy/MM/dd")}
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm">
                詳細レポート
              </Button>
              <Button variant="outline" size="sm">
                CSV出力
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
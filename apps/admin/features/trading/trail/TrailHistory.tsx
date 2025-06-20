"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui/components/ui/dropdown-menu";
import { Download, RefreshCw, Trash2, TrendingUp, Target, StopCircle, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { 
  TrailHistoryEntry, 
  TrailHistoryFilters, 
  TrailHistoryResponse, 
  TrailHistoryStats 
} from "./types";
import { trailLogManager } from "./TrailLogManager";

interface TrailHistoryProps {
  refreshTrigger?: number;
  accounts: Array<{
    id: string;
    broker: string;
    accountNumber: string;
  }>;
}

const ACTION_TYPE_COLORS = {
  start: "bg-blue-100 text-blue-800",
  update: "bg-yellow-100 text-yellow-800",
  stop: "bg-gray-100 text-gray-800",
  triggered: "bg-green-100 text-green-800",
};

const ACTION_TYPE_LABELS = {
  start: "開始",
  update: "更新",
  stop: "停止",
  triggered: "発動",
};

const ACTION_TYPE_ICONS = {
  start: Play,
  update: RefreshCw,
  stop: StopCircle,
  triggered: Target,
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number, decimals: number = 2) => {
  return new Intl.NumberFormat('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export function TrailHistory({ refreshTrigger, accounts }: TrailHistoryProps) {
  const [data, setData] = useState<TrailHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TrailHistoryFilters>({
    limit: 50,
    offset: 0,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("all");
  const [selectedActionType, setSelectedActionType] = useState<string>("all");
  const [selectedSuccess, setSelectedSuccess] = useState<string>("all");
  const [profitMin, setProfitMin] = useState<string>("");
  const [profitMax, setProfitMax] = useState<string>("");

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      const result = trailLogManager.getHistory(filters);
      setData(result);
    } catch (error) {
      console.error('Failed to load trail history:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const newFilters: TrailHistoryFilters = {
      ...filters,
      accountIds: selectedAccount !== "all" ? [selectedAccount] : undefined,
      symbols: selectedSymbol !== "all" ? [selectedSymbol] : undefined,
      actionTypes: selectedActionType !== "all" ? [selectedActionType] : undefined,
      success: selectedSuccess !== "all" ? selectedSuccess === "true" : undefined,
      profitRange: profitMin || profitMax ? {
        min: profitMin ? parseFloat(profitMin) : undefined,
        max: profitMax ? parseFloat(profitMax) : undefined,
      } : undefined,
    };
    setFilters(newFilters);
  }, [selectedAccount, selectedSymbol, selectedActionType, selectedSuccess, profitMin, profitMax]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const getAccountInfo = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? `${account.broker} - ${account.accountNumber}` : accountId;
  };

  const formatDateTime = (date: Date) => {
    return {
      date: date.toLocaleDateString("ja-JP"),
      time: date.toLocaleTimeString("ja-JP"),
      relative: formatDistanceToNow(date, { addSuffix: true, locale: ja }),
    };
  };

  const uniqueSymbols = Array.from(
    new Set(data?.items?.map(item => item.symbol) || [])
  ).sort();

  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    const exportData = trailLogManager.exportHistory(filters);
    if (!exportData.length) {
      alert('エクスポートするデータがありません');
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `trail_history_${timestamp}`;

    try {
      switch (format) {
        case 'csv':
          exportToCSV(exportData, filename);
          break;
        case 'json':
          exportToJSON(exportData, filename);
          break;
        default:
          alert('サポートされていない形式です');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポート中にエラーが発生しました');
    }
  };

  const exportToCSV = (data: TrailHistoryEntry[], filename: string) => {
    const headers = [
      'タイムスタンプ',
      'アクション',
      'ポジションID', 
      'アカウント',
      '通貨ペア',
      '価格',
      '損益',
      '最大利益',
      '旧ストップロス',
      '新ストップロス',
      'トレール距離',
      '成功',
      'エラー'
    ];

    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        item.timestamp.toISOString(),
        item.actionType,
        item.positionId,
        getAccountInfo(item.accountId),
        item.symbol,
        item.price,
        item.profit,
        item.maxProfit,
        item.oldStopLoss || '',
        item.newStopLoss || '',
        item.trailDistance,
        item.success ? '成功' : '失敗',
        item.error || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  const exportToJSON = (data: TrailHistoryEntry[], filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.json`;
    link.click();
  };

  const handleClearHistory = () => {
    if (confirm('トレール履歴をすべて削除しますか？この操作は取り消せません。')) {
      trailLogManager.clearHistory();
      loadData();
    }
  };

  return (
    <div className="space-y-4">
      {/* 統計情報 */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{data.stats.totalActions}</div>
                  <div className="text-sm text-gray-600">総アクション数</div>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {(data.stats.successRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">成功率</div>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.stats.averageProfit)}
                  </div>
                  <div className="text-sm text-gray-600">平均損益</div>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {(data.stats.triggerRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">発動率</div>
                </div>
                <StopCircle className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle>トレール履歴</CardTitle>
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    エクスポート
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    CSV形式
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    JSON形式
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? "簡易フィルター" : "詳細フィルター"}
              </Button>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                更新
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearHistory}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                クリア
              </Button>
            </div>
          </div>

          {/* フィルター */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="account-select">アカウント</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのアカウント</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.broker} - {account.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="symbol-select">通貨ペア</Label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ての通貨ペア</SelectItem>
                  {uniqueSymbols.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="action-type-select">アクション</Label>
              <Select value={selectedActionType} onValueChange={setSelectedActionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのアクション</SelectItem>
                  <SelectItem value="start">開始</SelectItem>
                  <SelectItem value="update">更新</SelectItem>
                  <SelectItem value="stop">停止</SelectItem>
                  <SelectItem value="triggered">発動</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="success-select">結果</Label>
              <Select value={selectedSuccess} onValueChange={setSelectedSuccess}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="true">成功</SelectItem>
                  <SelectItem value="false">失敗</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 詳細フィルター */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="profit-min">最小損益</Label>
                <Input
                  id="profit-min"
                  type="number"
                  placeholder="例: -10000"
                  value={profitMin}
                  onChange={(e) => setProfitMin(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="profit-max">最大損益</Label>
                <Input
                  id="profit-max"
                  type="number"
                  placeholder="例: 50000"
                  value={profitMax}
                  onChange={(e) => setProfitMax(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : !data?.items?.length ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>トレール履歴がありません</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日時</TableHead>
                    <TableHead>アクション</TableHead>
                    <TableHead>ポジション</TableHead>
                    <TableHead>価格・損益</TableHead>
                    <TableHead>ストップロス</TableHead>
                    <TableHead>トレール情報</TableHead>
                    <TableHead>結果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const dateTime = formatDateTime(item.timestamp);
                    const ActionIcon = ACTION_TYPE_ICONS[item.actionType];
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="text-sm">
                            <div>{dateTime.date}</div>
                            <div className="text-gray-500">{dateTime.time}</div>
                            <div className="text-xs text-gray-400">{dateTime.relative}</div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <ActionIcon className="h-4 w-4" />
                            <Badge 
                              className={ACTION_TYPE_COLORS[item.actionType]}
                              variant="secondary"
                            >
                              {ACTION_TYPE_LABELS[item.actionType]}
                            </Badge>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-mono text-xs text-gray-500">
                              {item.positionId.slice(-8)}
                            </div>
                            <div>{getAccountInfo(item.accountId)}</div>
                            <div className="font-mono font-semibold">{item.symbol}</div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-mono">
                              価格: {formatNumber(item.price, 5)}
                            </div>
                            <div className={`font-semibold ${
                              item.profit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              損益: {formatCurrency(item.profit)}
                            </div>
                            <div className="text-xs text-gray-500">
                              最大: {formatCurrency(item.maxProfit)}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm font-mono">
                            {item.oldStopLoss && (
                              <div className="text-gray-500">
                                旧: {formatNumber(item.oldStopLoss, 5)}
                              </div>
                            )}
                            {item.newStopLoss && (
                              <div className="font-semibold">
                                新: {formatNumber(item.newStopLoss, 5)}
                              </div>
                            )}
                            {!item.oldStopLoss && !item.newStopLoss && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              タイプ: 
                              <Badge variant="outline" className="ml-1">
                                {item.trailSettings.type}
                              </Badge>
                            </div>
                            <div>距離: {formatNumber(item.trailDistance, 2)}</div>
                            {item.reason && (
                              <div className="text-xs text-gray-500 mt-1">
                                {item.reason}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge
                            variant={item.success ? "default" : "destructive"}
                          >
                            {item.success ? "成功" : "失敗"}
                          </Badge>
                          {item.error && (
                            <div className="text-xs text-red-600 mt-1">
                              {item.error}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* ページネーション */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">
                    {data.total}件中 {(data.currentPage - 1) * (filters.limit || 50) + 1}-
                    {Math.min(data.currentPage * (filters.limit || 50), data.total)}件を表示
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!data.hasPreviousPage}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        offset: Math.max(0, (prev.offset || 0) - (prev.limit || 50))
                      }))}
                    >
                      前へ
                    </Button>
                    <span className="text-sm">
                      {data.currentPage} / {data.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!data.hasNextPage}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        offset: (prev.offset || 0) + (prev.limit || 50)
                      }))}
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
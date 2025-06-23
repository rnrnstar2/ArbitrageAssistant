"use client";

import { useState, useEffect } from "react";
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
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { CloseHistoryDisplay, CloseHistoryFilters, CloseHistoryStats } from "../types/types";
import { useCloseHistory } from "../hooks/useCloseHistory";
// MVP: エクスポート機能は削除

interface CloseHistoryTableProps {
  refreshTrigger?: number;
  accounts: Array<{
    id: string;
    broker: string;
    accountNumber: string;
  }>;
}

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  executed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const STATUS_LABELS = {
  pending: "実行中",
  executed: "完了",
  failed: "失敗",
};

const CLOSE_TYPE_LABELS = {
  market: "成行",
  limit: "指値",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPips = (value: number) => {
  return `${value.toFixed(1)} pips`;
};

export function CloseHistoryTable({ refreshTrigger, accounts }: CloseHistoryTableProps) {
  const [filters, setFilters] = useState<CloseHistoryFilters>({
    limit: 50,
    offset: 0,
    sortBy: 'executedAt',
    sortOrder: 'desc',
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [profitMin, setProfitMin] = useState<string>("");
  const [profitMax, setProfitMax] = useState<string>("");

  const { data, loading, error, refetch } = useCloseHistory(filters);

  useEffect(() => {
    const newFilters: CloseHistoryFilters = {
      ...filters,
      accountIds: selectedAccount !== "all" ? [selectedAccount] : undefined,
      symbols: selectedSymbol !== "all" ? [selectedSymbol] : undefined,
      statuses: selectedStatus !== "all" ? [selectedStatus as "failed" | "pending" | "executed"] : undefined,
      profitRange: profitMin && profitMax ? {
        min: parseFloat(profitMin),
        max: parseFloat(profitMax),
      } : undefined,
    };
    setFilters(newFilters);
  }, [selectedAccount, selectedSymbol, selectedStatus, profitMin, profitMax]);

  useEffect(() => {
    refetch();
  }, [refreshTrigger, refetch]);

  const getAccountInfo = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? `${account.broker} - ${account.accountNumber}` : accountId;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("ja-JP"),
      time: date.toLocaleTimeString("ja-JP"),
      relative: formatDistanceToNow(date, { addSuffix: true, locale: ja }),
    };
  };

  const uniqueSymbols = Array.from(
    new Set(data?.items?.map(item => item.symbol) || [])
  ).sort();

  // MVP: エクスポート機能は削除

  return (
    <div className="space-y-4">
      {/* 統計情報 - 一時的に無効化
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data.stats.totalTrades}</div>
            <div className="text-sm text-gray-600">総決済数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.stats.totalReturn)}
            </div>
            <div className="text-sm text-gray-600">総損益</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {(data.stats.successRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">成功率</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {data.stats.averageHoldingDays.toFixed(1)}日
            </div>
            <div className="text-sm text-gray-600">平均保有期間</div>
          </CardContent>
        </Card>
      </div>
      */}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle>決済履歴</CardTitle>
            <div className="flex items-center space-x-2">
              {/* MVP: エクスポート機能は削除 */}
              <Button 
                variant="outline" 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? "簡易フィルター" : "詳細フィルター"}
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                更新
              </Button>
            </div>
          </div>

          {/* フィルター */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label htmlFor="status-select">ステータス</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのステータス</SelectItem>
                  <SelectItem value="executed">完了</SelectItem>
                  <SelectItem value="pending">実行中</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
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
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              エラーが発生しました: {error}
            </div>
          ) : !data?.items?.length ? (
            <div className="text-center py-8 text-gray-500">
              決済履歴がありません
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>決済日時</TableHead>
                    <TableHead>アカウント</TableHead>
                    <TableHead>通貨ペア</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead>ロット</TableHead>
                    <TableHead>価格</TableHead>
                    <TableHead>損益</TableHead>
                    <TableHead>保有期間</TableHead>
                    <TableHead>決済タイプ</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const executedDateTime = item.executedAt 
                      ? formatDateTime(item.executedAt.toISOString()) 
                      : null;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {executedDateTime ? (
                            <div className="text-sm">
                              <div>{executedDateTime.date}</div>
                              <div className="text-gray-500">{executedDateTime.time}</div>
                              <div className="text-xs text-gray-400">{executedDateTime.relative}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{getAccountInfo(item.accountId)}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{item.symbol}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.type === "buy" ? "default" : "secondary"}>
                            {item.type === "buy" ? "買い" : "売り"}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.lots}</TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">
                            <div>開値: {item.openPrice.toFixed(5)}</div>
                            <div>決済: {item.closePrice.toFixed(5)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className={`font-semibold ${
                              item.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(item.totalReturn)}
                            </div>
                            <div className="text-xs text-gray-500">
                              損益: {formatCurrency(item.profit)}
                            </div>
                            {item.swapCost > 0 && (
                              <div className="text-xs text-gray-500">
                                スワップ: -{formatCurrency(item.swapCost)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{item.holdingDays}日</div>
                            {item.dailyReturn !== 0 && (
                              <div className="text-xs text-gray-500">
                                日次: {formatCurrency(item.dailyReturn)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {CLOSE_TYPE_LABELS[item.closeType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={STATUS_COLORS[item.status]}
                            variant="secondary"
                          >
                            {STATUS_LABELS[item.status]}
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
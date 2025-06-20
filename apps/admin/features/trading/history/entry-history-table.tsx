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
import { TradingService } from "../services/trading-service";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

interface EntryHistoryItem {
  id: string;
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  price?: number;
  status: "pending" | "executed" | "failed" | "timeout";
  createdAt: string;
  executedAt?: string;
  resultPositionId?: string;
  error?: string;
}

interface EntryHistoryTableProps {
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
  timeout: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS = {
  pending: "実行中",
  executed: "完了",
  failed: "失敗",
  timeout: "タイムアウト",
};

export function EntryHistoryTable({ refreshTrigger, accounts }: EntryHistoryTableProps) {
  const [entries, setEntries] = useState<EntryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");

  const loadEntryHistory = async () => {
    try {
      setLoading(true);
      const accountId = selectedAccount === "all" ? undefined : selectedAccount;
      const history = await TradingService.getEntryHistory(accountId);
      setEntries(history as EntryHistoryItem[]);
    } catch (error) {
      console.error("Error loading entry history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntryHistory();
  }, [selectedAccount, refreshTrigger]);

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>エントリー履歴</CardTitle>
        <div className="flex items-center space-x-2">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[200px]">
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
          <Button variant="outline" onClick={loadEntryHistory}>
            更新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">読み込み中...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-4 text-gray-500">エントリー履歴がありません</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>アカウント</TableHead>
                <TableHead>通貨ペア</TableHead>
                <TableHead>方向</TableHead>
                <TableHead>ロット</TableHead>
                <TableHead>価格</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>実行時刻</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const createdDateTime = formatDateTime(entry.createdAt);
                const executedDateTime = entry.executedAt ? formatDateTime(entry.executedAt) : null;
                
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="text-sm">
                        <div>{createdDateTime.date}</div>
                        <div className="text-gray-500">{createdDateTime.time}</div>
                        <div className="text-xs text-gray-400">{createdDateTime.relative}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{getAccountInfo(entry.accountId)}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{entry.symbol}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.type === "buy" ? "default" : "secondary"}>
                        {entry.type === "buy" ? "買い" : "売り"}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.lots}</TableCell>
                    <TableCell>
                      {entry.price ? (
                        <span className="font-mono">{entry.price.toFixed(5)}</span>
                      ) : (
                        <span className="text-gray-500">成行</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={STATUS_COLORS[entry.status]}
                        variant="secondary"
                      >
                        {STATUS_LABELS[entry.status]}
                      </Badge>
                      {entry.error && (
                        <div className="text-xs text-red-600 mt-1">
                          {entry.error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {executedDateTime ? (
                        <div className="text-sm">
                          <div>{executedDateTime.time}</div>
                          <div className="text-xs text-gray-400">{executedDateTime.relative}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.resultPositionId && (
                        <Button variant="outline" size="sm">
                          ポジション表示
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
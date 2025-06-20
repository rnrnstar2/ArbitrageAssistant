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
import { 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Filter,
  Eye,
  TrendingUp,
  Clock,
  DollarSign
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

import { 
  LossCutHistoryRecord, 
  LossCutFilter,
  lossCutHistoryManager 
} from "./LossCutHistoryManager";
import { LossCutDetailViewer } from "./LossCutDetailViewer";
import { LossCutAnalytics } from "./LossCutAnalytics";

interface LossCutHistoryProps {
  accounts: Array<{
    id: string;
    broker: string;
    accountNumber: string;
  }>;
}

const TRIGGER_TYPE_LABELS = {
  losscut_occurred: "ロスカット発生",
  margin_critical: "証拠金危険",
  manual_trigger: "手動トリガー",
};

const TRIGGER_TYPE_COLORS = {
  losscut_occurred: "bg-red-100 text-red-800",
  margin_critical: "bg-orange-100 text-orange-800",
  manual_trigger: "bg-blue-100 text-blue-800",
};

const SEVERITY_COLORS = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export function LossCutHistory({ accounts }: LossCutHistoryProps) {
  const [records, setRecords] = useState<LossCutHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<LossCutHistoryRecord | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // フィルター状態
  const [filter, setFilter] = useState<LossCutFilter>({});
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedTriggerType, setSelectedTriggerType] = useState<string>("all");
  const [dateFromValue, setDateFromValue] = useState<string>("");
  const [dateToValue, setDateToValue] = useState<string>("");
  const [searchText, setSearchText] = useState("");

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      const currentFilter: LossCutFilter = {
        accountIds: selectedAccount === "all" ? undefined : [selectedAccount],
        triggerTypes: selectedTriggerType === "all" ? undefined : [selectedTriggerType],
        dateRange: dateFromValue && dateToValue ? {
          start: new Date(dateFromValue),
          end: new Date(dateToValue)
        } : undefined,
      };

      const history = await lossCutHistoryManager.getHistory(currentFilter);
      
      // 検索テキストでフィルタリング
      let filteredHistory = history;
      if (searchText) {
        filteredHistory = history.filter(record =>
          record.id.toLowerCase().includes(searchText.toLowerCase()) ||
          record.accountId.toLowerCase().includes(searchText.toLowerCase()) ||
          record.lessons.some(lesson => 
            lesson.toLowerCase().includes(searchText.toLowerCase())
          )
        );
      }
      
      setRecords(filteredHistory);
    } catch (error) {
      console.error("ロスカット履歴取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedAccount, selectedTriggerType, dateFromValue, dateToValue]);

  const handleSearch = () => {
    loadHistory();
  };

  const handleExport = async (format: 'json' | 'csv' | 'excel') => {
    try {
      const currentFilter: LossCutFilter = {
        accountIds: selectedAccount === "all" ? undefined : [selectedAccount],
        triggerTypes: selectedTriggerType === "all" ? undefined : [selectedTriggerType],
        dateRange: dateFromValue && dateToValue ? {
          start: new Date(dateFromValue),
          end: new Date(dateToValue)
        } : undefined,
      };

      const blob = await lossCutHistoryManager.exportHistory(format, currentFilter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `losscut-history-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("エクスポートエラー:", error);
    }
  };

  const getAccountInfo = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? `${account.broker} - ${account.accountNumber}` : accountId;
  };

  const getSeverity = (record: LossCutHistoryRecord): keyof typeof SEVERITY_COLORS => {
    const marginLevel = record.triggerEvent.marginLevel;
    if (marginLevel < 20) return 'critical';
    if (marginLevel < 50) return 'high';
    if (marginLevel < 100) return 'medium';
    return 'low';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateTime = (date: Date) => {
    return {
      date: date.toLocaleDateString("ja-JP"),
      time: date.toLocaleTimeString("ja-JP"),
      relative: formatDistanceToNow(date, { addSuffix: true, locale: ja }),
    };
  };

  if (selectedRecord) {
    return (
      <LossCutDetailViewer
        record={selectedRecord}
        accounts={accounts}
        onClose={() => setSelectedRecord(null)}
      />
    );
  }

  if (showAnalytics) {
    return (
      <LossCutAnalytics
        records={records}
        onClose={() => setShowAnalytics(false)}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle>ロスカット履歴</CardTitle>
          <Badge variant="outline">{records.length}件</Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAnalytics(true)}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            分析表示
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            フィルター
          </Button>
          
          <Select onValueChange={(value) => handleExport(value as 'json' | 'csv' | 'excel')}>
            <SelectTrigger className="w-[100px]">
              <Download className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={loadHistory}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {showFilters && (
        <CardContent className="border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">アカウント</label>
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
              <label className="text-sm font-medium mb-1 block">トリガータイプ</label>
              <Select value={selectedTriggerType} onValueChange={setSelectedTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのタイプ</SelectItem>
                  {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">期間</label>
              <div className="flex space-x-2">
                <Input
                  type="date"
                  value={dateFromValue}
                  onChange={(e) => setDateFromValue(e.target.value)}
                  placeholder="開始日"
                  className="w-full"
                />
                <Input
                  type="date"
                  value={dateToValue}
                  onChange={(e) => setDateToValue(e.target.value)}
                  placeholder="終了日"
                  className="w-full"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">検索</label>
              <div className="flex space-x-1">
                <Input
                  placeholder="ID、アカウント、学習事項..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="sm" onClick={handleSearch}>
                  検索
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>履歴を読み込み中...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>ロスカット履歴がありません</p>
            <p className="text-sm mt-1">現在の設定でロスカットイベントは記録されていません</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>発生時刻</TableHead>
                <TableHead>アカウント</TableHead>
                <TableHead>トリガー</TableHead>
                <TableHead>重要度</TableHead>
                <TableHead>マージンレベル</TableHead>
                <TableHead>損失額</TableHead>
                <TableHead>復旧時間</TableHead>
                <TableHead>実行アクション</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const dateTime = formatDateTime(record.timestamp);
                const severity = getSeverity(record);
                const successfulActions = record.executedActions.filter(a => a.status === 'success').length;
                
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="text-sm">
                        <div>{dateTime.date}</div>
                        <div className="text-gray-500">{dateTime.time}</div>
                        <div className="text-xs text-gray-400">{dateTime.relative}</div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">{getAccountInfo(record.accountId)}</div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        className={TRIGGER_TYPE_COLORS[record.triggerEvent.type]}
                        variant="secondary"
                      >
                        {TRIGGER_TYPE_LABELS[record.triggerEvent.type]}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        className={SEVERITY_COLORS[severity]}
                        variant="secondary"
                      >
                        {severity === 'critical' && '緊急'}
                        {severity === 'high' && '高'}
                        {severity === 'medium' && '中'}
                        {severity === 'low' && '低'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-mono">
                          {record.triggerEvent.marginLevel.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          フリー: {formatCurrency(record.triggerEvent.freeMargin)}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-mono text-red-600">
                          {formatCurrency(record.triggerEvent.totalLoss)}
                        </div>
                        <div className="text-xs text-green-600">
                          軽減: {formatCurrency(record.outcome.damageMinimized)}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <Clock className="h-3 w-3 mr-1" />
                        {Math.round(record.outcome.recoveryTime)}分
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div>
                          {successfulActions}/{record.executedActions.length} 成功
                        </div>
                        <div className="text-xs text-gray-500">
                          コスト: {formatCurrency(record.outcome.totalCost)}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        詳細
                      </Button>
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
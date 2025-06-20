"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Progress } from "@repo/ui/components/ui/progress";
import { 
  ArrowLeft,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  TrendingUp,
  FileText,
  Calendar
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ja } from "date-fns/locale";

import { LossCutHistoryRecord, ActionExecutionRecord } from "./LossCutHistoryManager";

interface LossCutDetailViewerProps {
  record: LossCutHistoryRecord;
  accounts: Array<{
    id: string;
    broker: string;
    accountNumber: string;
  }>;
  onClose: () => void;
}

const TRIGGER_TYPE_LABELS = {
  losscut_occurred: "ロスカット発生",
  margin_critical: "証拠金危険",
  manual_trigger: "手動トリガー",
};

const STATUS_COLORS = {
  success: "text-green-600",
  failed: "text-red-600",
  partial: "text-orange-600",
};

const STATUS_ICONS = {
  success: CheckCircle,
  failed: XCircle,
  partial: AlertTriangle,
};

const STATUS_LABELS = {
  success: "成功",
  failed: "失敗",
  partial: "部分的",
};

export function LossCutDetailViewer({ record, accounts, onClose }: LossCutDetailViewerProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'timeline' | 'actions' | 'lessons'>('overview');

  const getAccountInfo = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? `${account.broker} - ${account.accountNumber}` : accountId;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateTime = (date: Date) => {
    return {
      full: format(date, 'yyyy年MM月dd日 HH:mm:ss', { locale: ja }),
      relative: formatDistanceToNow(date, { addSuffix: true, locale: ja }),
    };
  };

  const calculateActionDuration = (action: ActionExecutionRecord) => {
    const duration = action.endTime.getTime() - action.startTime.getTime();
    return Math.round(duration / 1000); // 秒
  };

  const calculateSuccessRate = () => {
    const total = record.executedActions.length;
    if (total === 0) return 0;
    const successful = record.executedActions.filter(a => a.status === 'success').length;
    return Math.round((successful / total) * 100);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* イベント概要 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
            イベント概要
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">発生時刻</label>
              <div className="text-sm">
                <div>{formatDateTime(record.timestamp).full}</div>
                <div className="text-gray-500">{formatDateTime(record.timestamp).relative}</div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">アカウント</label>
              <div className="text-sm">{getAccountInfo(record.accountId)}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">トリガータイプ</label>
              <Badge variant="outline">
                {TRIGGER_TYPE_LABELS[record.triggerEvent.type]}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">イベントID</label>
              <div className="text-xs font-mono">{record.id}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* トリガー詳細 */}
      <Card>
        <CardHeader>
          <CardTitle>トリガー詳細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">マージンレベル</label>
                <div className="text-2xl font-mono">
                  {record.triggerEvent.marginLevel.toFixed(1)}%
                </div>
                <Progress 
                  value={Math.min(record.triggerEvent.marginLevel, 100)} 
                  className="mt-2"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">フリーマージン</label>
                <div className="text-xl font-mono">
                  {formatCurrency(record.triggerEvent.freeMargin)}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">総損失額</label>
                <div className="text-xl font-mono text-red-600">
                  {formatCurrency(record.triggerEvent.totalLoss)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 結果概要 */}
      <Card>
        <CardHeader>
          <CardTitle>対応結果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-500">損失軽減額</label>
              <div className="text-xl font-mono text-green-600">
                {formatCurrency(record.outcome.damageMinimized)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">復旧時間</label>
              <div className="text-xl font-mono">
                {Math.round(record.outcome.recoveryTime)}分
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">最終マージンレベル</label>
              <div className="text-xl font-mono">
                {record.outcome.finalMarginLevel.toFixed(1)}%
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">総コスト</label>
              <div className="text-xl font-mono">
                {formatCurrency(record.outcome.totalCost)}
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-500">アクション成功率</label>
            <div className="flex items-center mt-2">
              <Progress value={calculateSuccessRate()} className="flex-1" />
              <span className="ml-3 text-sm font-medium">{calculateSuccessRate()}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTimeline = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          タイムライン
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* イベント発生 */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 bg-red-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium">ロスカットイベント発生</div>
              <div className="text-xs text-gray-500">
                {formatDateTime(record.timestamp).full}
              </div>
              <div className="text-sm mt-1">
                マージンレベル: {record.triggerEvent.marginLevel.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* アクション実行 */}
          {record.executedActions
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
            .map((action, index) => {
              const StatusIcon = STATUS_ICONS[action.status];
              return (
                <div key={action.actionId} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        アクション {index + 1}: {action.type}
                      </span>
                      <StatusIcon className={`h-4 w-4 ${STATUS_COLORS[action.status]}`} />
                      <Badge variant="outline" className={STATUS_COLORS[action.status]}>
                        {STATUS_LABELS[action.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      開始: {formatDateTime(action.startTime).full}
                    </div>
                    <div className="text-xs text-gray-500">
                      終了: {formatDateTime(action.endTime).full}
                    </div>
                    <div className="text-xs text-gray-500">
                      実行時間: {calculateActionDuration(action)}秒
                    </div>
                    {action.error && (
                      <div className="text-xs text-red-600 mt-1">
                        エラー: {action.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* 復旧完了 */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium">復旧完了</div>
              <div className="text-sm mt-1">
                最終マージンレベル: {record.outcome.finalMarginLevel.toFixed(1)}%
              </div>
              <div className="text-sm">
                損失軽減: {formatCurrency(record.outcome.damageMinimized)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderActions = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          実行アクション詳細
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {record.executedActions.map((action, index) => {
            const StatusIcon = STATUS_ICONS[action.status];
            return (
              <Card key={action.actionId} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">アクション {index + 1}</span>
                      <Badge variant="outline">{action.type}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StatusIcon className={`h-4 w-4 ${STATUS_COLORS[action.status]}`} />
                      <Badge className={STATUS_COLORS[action.status]}>
                        {STATUS_LABELS[action.status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="font-medium text-gray-500">開始時刻</label>
                      <div>{formatDateTime(action.startTime).full}</div>
                    </div>
                    <div>
                      <label className="font-medium text-gray-500">終了時刻</label>
                      <div>{formatDateTime(action.endTime).full}</div>
                    </div>
                    <div>
                      <label className="font-medium text-gray-500">実行時間</label>
                      <div>{calculateActionDuration(action)}秒</div>
                    </div>
                    <div>
                      <label className="font-medium text-gray-500">アクションID</label>
                      <div className="font-mono text-xs">{action.actionId}</div>
                    </div>
                  </div>
                  
                  {action.result && (
                    <div className="mt-4">
                      <label className="font-medium text-gray-500">実行結果</label>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(action.result, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {action.error && (
                    <div className="mt-4">
                      <label className="font-medium text-gray-500">エラー詳細</label>
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-1">
                        {action.error}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderLessons = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          学習事項・改善提案
        </CardTitle>
      </CardHeader>
      <CardContent>
        {record.lessons.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>学習事項は記録されていません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {record.lessons.map((lesson, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 text-sm">
                  {lesson}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">ロスカット履歴詳細</h1>
                <p className="text-sm text-gray-500">
                  {formatDateTime(record.timestamp).full} - {getAccountInfo(record.accountId)}
                </p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className="text-sm"
            >
              {TRIGGER_TYPE_LABELS[record.triggerEvent.type]}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* タブナビゲーション */}
      <Card>
        <CardContent className="p-0">
          <div className="flex border-b">
            {[
              { key: 'overview', label: '概要', icon: Target },
              { key: 'timeline', label: 'タイムライン', icon: Clock },
              { key: 'actions', label: 'アクション詳細', icon: Activity },
              { key: 'lessons', label: '学習事項', icon: FileText },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedTab(key as typeof selectedTab)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  selectedTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* タブコンテンツ */}
      {selectedTab === 'overview' && renderOverview()}
      {selectedTab === 'timeline' && renderTimeline()}
      {selectedTab === 'actions' && renderActions()}
      {selectedTab === 'lessons' && renderLessons()}
    </div>
  );
}
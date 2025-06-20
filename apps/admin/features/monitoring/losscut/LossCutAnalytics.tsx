"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Progress } from "@repo/ui/components/ui/progress";
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  Target
} from "lucide-react";

import { LossCutHistoryRecord, LossCutAnalytics as AnalyticsData, lossCutHistoryManager } from "./LossCutHistoryManager";

interface LossCutAnalyticsProps {
  records: LossCutHistoryRecord[];
  onClose: () => void;
}

interface StatCard {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  description?: string;
}

const TRIGGER_TYPE_LABELS = {
  losscut_occurred: "ロスカット発生",
  margin_critical: "証拠金危険",
  manual_trigger: "手動トリガー",
};

export function LossCutAnalytics({ records, onClose }: LossCutAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [records, selectedTimeframe]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // 時間枠に基づいてフィルタリング
      let filteredRecords = records;
      if (selectedTimeframe !== 'all') {
        const daysBack = selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        filteredRecords = records.filter(r => r.timestamp >= cutoffDate);
      }

      const analyticsData = await lossCutHistoryManager.getAnalytics({
        dateRange: selectedTimeframe !== 'all' ? {
          start: new Date(Date.now() - getDaysBack() * 24 * 60 * 60 * 1000),
          end: new Date()
        } : undefined
      });

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('分析データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysBack = () => {
    switch (selectedTimeframe) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 365;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatCards = (): StatCard[] => {
    if (!analytics) return [];

    return [
      {
        title: "総発生件数",
        value: analytics.totalOccurrences.toString(),
        icon: AlertTriangle,
        description: `${selectedTimeframe === 'all' ? '全期間' : selectedTimeframe}での総計`,
      },
      {
        title: "平均復旧時間",
        value: `${Math.round(analytics.averageRecoveryTime)}分`,
        icon: Clock,
        description: "アクション開始から復旧完了まで",
      },
      {
        title: "損失軽減総額",
        value: formatCurrency(analytics.totalDamageMinimized),
        icon: DollarSign,
        changeType: 'positive',
        description: "自動対応による損失軽減効果",
      },
      {
        title: "アクション成功率",
        value: formatPercentage(analytics.actionSuccessRate),
        icon: CheckCircle,
        changeType: analytics.actionSuccessRate > 0.8 ? 'positive' : 'negative',
        description: "実行されたアクションの成功率",
      },
    ];
  };

  const renderStatCards = () => {
    const statCards = getStatCards();
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.change && (
                      <div className={`flex items-center text-sm ${
                        stat.changeType === 'positive' ? 'text-green-600' : 
                        stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {stat.changeType === 'positive' ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : stat.changeType === 'negative' ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : null}
                        {stat.change}
                      </div>
                    )}
                    {stat.description && (
                      <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
                    )}
                  </div>
                  <Icon className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderTriggerAnalysis = () => {
    if (!analytics) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="h-5 w-5 mr-2" />
            トリガー種別分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.frequentTriggers.map((trigger, index) => (
              <div key={trigger.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">
                      {TRIGGER_TYPE_LABELS[trigger.type as keyof typeof TRIGGER_TYPE_LABELS] || trigger.type}
                    </div>
                    <div className="text-sm text-gray-500">
                      {trigger.count}件 ({trigger.percentage.toFixed(1)}%)
                    </div>
                  </div>
                </div>
                <div className="w-32">
                  <Progress value={trigger.percentage} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMonthlyTrend = () => {
    if (!analytics) return null;

    const maxCount = Math.max(...analytics.monthlyTrend.map(m => m.count));
    const maxDamage = Math.max(...analytics.monthlyTrend.map(m => m.damageMinimized));

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            月次トレンド
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.monthlyTrend.slice(-6).map((month, index) => (
              <div key={month.month} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{month.month}</span>
                  <div className="flex items-center space-x-4">
                    <span>{month.count}件</span>
                    <span className="text-green-600">
                      {formatCurrency(month.damageMinimized)} 軽減
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>発生件数</span>
                    <span>{month.count}</span>
                  </div>
                  <Progress value={(month.count / maxCount) * 100} className="h-1" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>損失軽減</span>
                    <span>{formatCurrency(month.damageMinimized)}</span>
                  </div>
                  <Progress 
                    value={(month.damageMinimized / maxDamage) * 100} 
                    className="h-1" 
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderRecommendations = () => {
    if (!analytics) return null;

    const recommendations = [];

    // 成功率が低い場合の推奨
    if (analytics.actionSuccessRate < 0.7) {
      recommendations.push({
        type: 'warning',
        title: 'アクション成功率が低下しています',
        description: 'アクション設定の見直しや、ネットワーク接続の確認を推奨します。',
        action: 'アクション設定を確認',
      });
    }

    // 復旧時間が長い場合の推奨
    if (analytics.averageRecoveryTime > 10) {
      recommendations.push({
        type: 'info',
        title: '復旧時間の最適化',
        description: 'より迅速な復旧のため、アクションの並列実行を検討してください。',
        action: '設定を最適化',
      });
    }

    // 頻出トリガーの分析
    const mostFrequentTrigger = analytics.frequentTriggers[0];
    if (mostFrequentTrigger && mostFrequentTrigger.percentage > 60) {
      recommendations.push({
        type: 'suggestion',
        title: `${TRIGGER_TYPE_LABELS[mostFrequentTrigger.type as keyof typeof TRIGGER_TYPE_LABELS]}が多発`,
        description: 'このトリガーの根本原因を分析し、予防策を検討することを推奨します。',
        action: '予防策を検討',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        title: 'システムは正常に動作しています',
        description: '現在の設定とパフォーマンスは良好です。',
        action: '',
      });
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            改善提案
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className={`p-4 rounded-lg border ${
                rec.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                rec.type === 'info' ? 'bg-blue-50 border-blue-200' :
                rec.type === 'suggestion' ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{rec.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  </div>
                  {rec.action && (
                    <Button variant="outline" size="sm" className="ml-4">
                      {rec.action}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

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
                <h1 className="text-xl font-semibold">ロスカット履歴分析</h1>
                <p className="text-sm text-gray-500">
                  パフォーマンス分析と改善提案
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {(['7d', '30d', '90d', 'all'] as const).map((timeframe) => (
                <Button
                  key={timeframe}
                  variant={selectedTimeframe === timeframe ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTimeframe(timeframe)}
                >
                  {timeframe === 'all' ? '全期間' : timeframe}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>分析データを読み込み中...</p>
            </div>
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          {/* 統計カード */}
          {renderStatCards()}
          
          {/* 分析グリッド */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderTriggerAnalysis()}
            {renderMonthlyTrend()}
          </div>
          
          {/* 改善提案 */}
          {renderRecommendations()}
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>分析データがありません</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
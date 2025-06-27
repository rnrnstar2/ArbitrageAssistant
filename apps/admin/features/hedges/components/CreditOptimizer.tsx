'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { Progress } from '@repo/ui/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Target,
  Zap,
  BarChart3,
  ArrowUpDown
} from 'lucide-react';

interface CreditAccount {
  id: string;
  name: string;
  totalCredit: number;
  usedCredit: number;
  availableCredit: number;
  utilizationRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedOptimization?: {
    action: 'reduce' | 'increase' | 'maintain';
    targetUtilization: number;
    reason: string;
  };
}

interface OptimizationSuggestion {
  id: string;
  type: 'rebalance' | 'reduce_exposure' | 'increase_capacity' | 'warning';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: {
    creditSavings?: number;
    riskReduction?: number;
    expectedReturn?: number;
  };
  actions: Array<{
    accountId: string;
    currentAllocation: number;
    suggestedAllocation: number;
  }>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
};

const OptimizationCard: React.FC<{
  suggestion: OptimizationSuggestion;
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
}> = ({ suggestion, onApply, onDismiss }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rebalance': return <ArrowUpDown className="h-5 w-5" />;
      case 'reduce_exposure': return <TrendingDown className="h-5 w-5" />;
      case 'increase_capacity': return <TrendingUp className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-50 text-blue-600">
              {getTypeIcon(suggestion.type)}
            </div>
            <div>
              <CardTitle className="text-lg">{suggestion.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getPriorityColor(suggestion.priority)}>
                  {suggestion.priority === 'high' ? '緊急' : 
                   suggestion.priority === 'medium' ? '重要' : '通常'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {suggestion.type === 'rebalance' ? 'リバランス' :
                   suggestion.type === 'reduce_exposure' ? 'エクスポージャー削減' :
                   suggestion.type === 'increase_capacity' ? '容量拡大' : '警告'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
        
        {/* Impact Metrics */}
        {Object.keys(suggestion.impact).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suggestion.impact.creditSavings && (
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">クレジット節約</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(suggestion.impact.creditSavings)}
                </p>
              </div>
            )}
            {suggestion.impact.riskReduction && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground">リスク削減</p>
                <p className="text-lg font-semibold text-blue-600">
                  {suggestion.impact.riskReduction}%
                </p>
              </div>
            )}
            {suggestion.impact.expectedReturn && (
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-muted-foreground">期待リターン</p>
                <p className="text-lg font-semibold text-yellow-600">
                  {formatCurrency(suggestion.impact.expectedReturn)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Details */}
        {suggestion.actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">推奨アクション:</h4>
            <div className="space-y-2">
              {suggestion.actions.map((action, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{action.accountId}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {action.currentAllocation.toFixed(1)}%
                    </span>
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium text-blue-600">
                      {action.suggestedAllocation.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => onApply(suggestion.id)}>
            <Zap className="h-4 w-4 mr-2" />
            適用
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDismiss(suggestion.id)}>
            無視
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CreditAccountCard: React.FC<{ account: CreditAccount }> = ({ account }) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'high': return '高リスク';
      case 'medium': return '中リスク';
      case 'low': return '低リスク';
      default: return '不明';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{account.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(account.usedCredit)} / {formatCurrency(account.totalCredit)}
            </p>
          </div>
          <Badge className={getRiskColor(account.riskLevel)}>
            {getRiskLabel(account.riskLevel)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">使用率</span>
            <span className={`text-sm font-semibold ${
              account.utilizationRate > 80 ? 'text-red-600' : 
              account.utilizationRate > 60 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {account.utilizationRate.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={account.utilizationRate} 
            className={`h-2 ${
              account.utilizationRate > 80 ? '[&>div]:bg-red-500' :
              account.utilizationRate > 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">使用中</p>
            <p className="font-semibold">{formatCurrency(account.usedCredit)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">利用可能</p>
            <p className="font-semibold text-green-600">{formatCurrency(account.availableCredit)}</p>
          </div>
        </div>

        {account.recommendedOptimization && (
          <Alert>
            <Target className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>推奨:</strong> {account.recommendedOptimization.reason}
              （目標使用率: {account.recommendedOptimization.targetUtilization}%）
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export const CreditOptimizer: React.FC = () => {
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockAccounts: CreditAccount[] = [
          {
            id: 'acc-1',
            name: 'XM-001',
            totalCredit: 1000000,
            usedCredit: 650000,
            availableCredit: 350000,
            utilizationRate: 65,
            riskLevel: 'medium',
            recommendedOptimization: {
              action: 'maintain',
              targetUtilization: 60,
              reason: '適正な使用率を維持'
            }
          },
          {
            id: 'acc-2',
            name: 'Exness-002',
            totalCredit: 750000,
            usedCredit: 300000,
            availableCredit: 450000,
            utilizationRate: 40,
            riskLevel: 'low',
            recommendedOptimization: {
              action: 'increase',
              targetUtilization: 60,
              reason: '容量に余裕があり、より多くの配分が可能'
            }
          },
          {
            id: 'acc-3',
            name: 'TitanFX-003',
            totalCredit: 1000000,
            usedCredit: 850000,
            availableCredit: 150000,
            utilizationRate: 85,
            riskLevel: 'high',
            recommendedOptimization: {
              action: 'reduce',
              targetUtilization: 70,
              reason: '高使用率によるリスク軽減が必要'
            }
          },
          {
            id: 'acc-4',
            name: 'FXGT-004',
            totalCredit: 500000,
            usedCredit: 300000,
            availableCredit: 200000,
            utilizationRate: 60,
            riskLevel: 'medium'
          }
        ];

        const mockSuggestions: OptimizationSuggestion[] = [
          {
            id: 'sug-1',
            type: 'rebalance',
            priority: 'high',
            title: 'TitanFX-003の高使用率解消',
            description: 'TitanFX-003の使用率が85%に達しています。Exness-002への配分移行を推奨します。',
            impact: {
              creditSavings: 150000,
              riskReduction: 25,
              expectedReturn: 50000
            },
            actions: [
              { accountId: 'TitanFX-003', currentAllocation: 85, suggestedAllocation: 70 },
              { accountId: 'Exness-002', currentAllocation: 40, suggestedAllocation: 55 }
            ]
          },
          {
            id: 'sug-2',
            type: 'increase_capacity',
            priority: 'medium',
            title: 'Exness-002の活用促進',
            description: 'Exness-002の使用率が40%と低く、より多くの配分が可能です。',
            impact: {
              expectedReturn: 75000
            },
            actions: [
              { accountId: 'Exness-002', currentAllocation: 40, suggestedAllocation: 60 }
            ]
          },
          {
            id: 'sug-3',
            type: 'warning',
            priority: 'low',
            title: '全体的なバランス監視',
            description: '現在の配分は概ね良好ですが、定期的な見直しを推奨します。',
            impact: {},
            actions: []
          }
        ];

        setAccounts(mockAccounts);
        setSuggestions(mockSuggestions);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleApplySuggestion = async (suggestionId: string) => {
    setOptimizing(true);
    try {
      console.log('⚡ Applying optimization suggestion:', suggestionId);
      
      // Simulate optimization process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Remove applied suggestion
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      
      console.log('✅ Optimization applied successfully');
    } finally {
      setOptimizing(false);
    }
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    console.log('🗑️ Suggestion dismissed:', suggestionId);
  };

  const handleAutoOptimize = async () => {
    setOptimizing(true);
    try {
      console.log('🤖 Running auto-optimization...');
      
      // Simulate auto-optimization
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Apply high priority suggestions automatically
      const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');
      setSuggestions(prev => prev.filter(s => s.priority !== 'high'));
      
      console.log('✅ Auto-optimization completed');
    } finally {
      setOptimizing(false);
    }
  };

  const totalStats = {
    totalCredit: accounts.reduce((sum, acc) => sum + acc.totalCredit, 0),
    totalUsed: accounts.reduce((sum, acc) => sum + acc.usedCredit, 0),
    totalAvailable: accounts.reduce((sum, acc) => sum + acc.availableCredit, 0),
    avgUtilization: accounts.length > 0 ? accounts.reduce((sum, acc) => sum + acc.utilizationRate, 0) / accounts.length : 0,
    highRiskAccounts: accounts.filter(acc => acc.riskLevel === 'high').length
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="h-8 w-8 animate-pulse mx-auto mb-2" />
        分析中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">総クレジット</p>
                <p className="text-2xl font-bold">{formatCurrency(totalStats.totalCredit)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">使用中</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalStats.totalUsed)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">利用可能</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalStats.totalAvailable)}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均使用率</p>
                <p className={`text-2xl font-bold ${
                  totalStats.avgUtilization > 80 ? 'text-red-600' : 
                  totalStats.avgUtilization > 60 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {totalStats.avgUtilization.toFixed(1)}%
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Optimization Suggestions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">最適化提案</h3>
            <Button 
              onClick={handleAutoOptimize}
              disabled={optimizing || suggestions.length === 0}
              size="sm"
            >
              <Zap className="h-4 w-4 mr-2" />
              {optimizing ? '最適化中...' : '自動最適化'}
            </Button>
          </div>
          
          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-green-600">最適化完了</h4>
                <p className="text-muted-foreground">
                  現在の配分は最適化されています。新しい提案があれば自動的に表示されます。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <OptimizationCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={handleApplySuggestion}
                  onDismiss={handleDismissSuggestion}
                />
              ))}
            </div>
          )}
        </div>

        {/* Account Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">口座別詳細</h3>
          <div className="space-y-4">
            {accounts.map((account) => (
              <CreditAccountCard key={account.id} account={account} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
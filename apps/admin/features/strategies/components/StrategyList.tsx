'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Input } from '@repo/ui/components/ui/input';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { 
  Plus, 
  Play, 
  Copy, 
  Filter, 
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Activity
} from 'lucide-react';
import { Strategy, StrategyType, StrategyStatus } from '@repo/shared-types';
import { useStrategies } from '../hooks/useStrategies';
import { useStrategyExecution } from '../hooks/useStrategyExecution';
import { StrategyCard } from './StrategyCard';
import { StrategyForm } from './StrategyForm';

export function StrategyList() {
  const { strategies, loading, error, refreshStrategies } = useStrategies();
  const { executeStrategy, loading: executing } = useStrategyExecution();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<StrategyType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StrategyStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bulk operations
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [showBulkExecuteDialog, setShowBulkExecuteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<Strategy | null>(null);

  // Filtered and sorted strategies
  const filteredStrategies = useMemo(() => {
    let filtered = strategies;

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(s => s.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [strategies, typeFilter, statusFilter, searchQuery]);

  // Helper functions
  const getStatusIcon = (status: StrategyStatus) => {
    switch (status) {
      case StrategyStatus.EXECUTING:
        return <Activity className="h-4 w-4 text-blue-500" />;
      case StrategyStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case StrategyStatus.ERROR:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case StrategyStatus.ACTIVE:
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadgeVariant = (status: StrategyStatus) => {
    switch (status) {
      case StrategyStatus.EXECUTING:
        return 'default';
      case StrategyStatus.COMPLETED:
        return 'outline';
      case StrategyStatus.ERROR:
        return 'destructive';
      case StrategyStatus.ACTIVE:
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Event handlers
  const handleStrategySelect = (strategyId: string, checked: boolean) => {
    if (checked) {
      setSelectedStrategies(prev => [...prev, strategyId]);
    } else {
      setSelectedStrategies(prev => prev.filter(id => id !== strategyId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const executable = filteredStrategies
        .filter(s => s.status === StrategyStatus.ACTIVE)
        .map(s => s.strategyId);
      setSelectedStrategies(executable);
    } else {
      setSelectedStrategies([]);
    }
  };

  const handleBulkExecute = async () => {
    try {
      for (const strategyId of selectedStrategies) {
        await executeStrategy(strategyId);
      }
      setShowBulkExecuteDialog(false);
      setSelectedStrategies([]);
      refreshStrategies();
    } catch (error) {
      console.error('Bulk execution failed:', error);
      alert('一括実行に失敗しました');
    }
  };

  const handleDuplicate = async (strategy: Strategy) => {
    try {
      // This would create a copy of the strategy with a new name
      const newName = `${strategy.name} (コピー)`;
      // Implementation would depend on the actual strategy creation API
      setShowDuplicateDialog(false);
      setDuplicateStrategy(null);
      refreshStrategies();
    } catch (error) {
      console.error('Strategy duplication failed:', error);
      alert('戦略の複製に失敗しました');
    }
  };

  const executableStrategies = filteredStrategies.filter(s => s.status === StrategyStatus.ACTIVE);
  const selectedExecutableCount = selectedStrategies.filter(id => 
    executableStrategies.some(s => s.strategyId === id)
  ).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            エラーが発生しました: {error.message}
          </div>
          <div className="text-center mt-4">
            <Button onClick={refreshStrategies}>再試行</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              戦略管理 ({filteredStrategies.length})
            </CardTitle>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新規戦略作成
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="戦略名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48"
              />
            </div>

            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="タイプ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全タイプ</SelectItem>
                <SelectItem value="ENTRY">エントリー戦略</SelectItem>
                <SelectItem value="EXIT">決済戦略</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ステータス</SelectItem>
                <SelectItem value="ACTIVE">待機中</SelectItem>
                <SelectItem value="EXECUTING">実行中</SelectItem>
                <SelectItem value="COMPLETED">完了</SelectItem>
                <SelectItem value="ERROR">エラー</SelectItem>
                <SelectItem value="PAUSED">一時停止</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedStrategies.length === executableStrategies.length && executableStrategies.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">全選択</span>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedStrategies.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-4">
              <span className="text-sm font-medium">
                {selectedStrategies.length}件選択中
              </span>

              {selectedExecutableCount > 0 && (
                <Dialog open={showBulkExecuteDialog} onOpenChange={setShowBulkExecuteDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Play className="h-4 w-4 mr-1" />
                      一括実行 ({selectedExecutableCount})
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>戦略一括実行</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>選択された{selectedExecutableCount}件の戦略を実行しますか？</p>
                      <div className="space-y-2">
                        {selectedStrategies
                          .map(id => filteredStrategies.find(s => s.strategyId === id))
                          .filter(s => s && s.status === StrategyStatus.ACTIVE)
                          .map(strategy => (
                            <div key={strategy!.strategyId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                              <Badge variant="outline">{strategy!.type}</Badge>
                              <span>{strategy!.name}</span>
                            </div>
                          ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowBulkExecuteDialog(false)}>
                          キャンセル
                        </Button>
                        <Button onClick={handleBulkExecute} disabled={executing}>
                          {executing ? '実行中...' : '実行開始'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedStrategies([])}
              >
                選択解除
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStrategies.map((strategy) => (
          <Card key={strategy.strategyId} className="relative">
            <CardContent className="p-4">
              {/* Selection checkbox */}
              {strategy.status === StrategyStatus.ACTIVE && (
                <div className="absolute top-3 left-3">
                  <Checkbox
                    checked={selectedStrategies.includes(strategy.strategyId)}
                    onCheckedChange={(checked) => 
                      handleStrategySelect(strategy.strategyId, checked as boolean)
                    }
                  />
                </div>
              )}

              {/* Strategy content */}
              <div className="space-y-3 pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{strategy.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {strategy.type === 'ENTRY' ? 'エントリー' : '決済'}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(strategy.status)}>
                        {getStatusIcon(strategy.status)}
                        <span className="ml-1">{strategy.status}</span>
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Strategy details */}
                <div className="text-sm text-gray-600 space-y-1">
                  {strategy.type === 'ENTRY' && (
                    <>
                      <div>対象口座: {(strategy as any).targetAccounts?.length || 0}口座</div>
                      <div>ポジション数: {(strategy as any).positions?.length || 0}</div>
                      <div>デフォルトトレール: {(strategy as any).defaultTrailWidth || 0} pips</div>
                    </>
                  )}
                  {strategy.type === 'EXIT' && (
                    <>
                      <div>決済対象: {(strategy as any).selectedPositions?.length || 0}ポジション</div>
                      <div>トレール幅: {(strategy as any).trailWidth || 0} pips</div>
                    </>
                  )}
                  <div className="text-xs text-gray-500">
                    更新: {new Date(strategy.updatedAt).toLocaleString('ja-JP')}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingStrategy(strategy)}
                    >
                      編集
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDuplicateStrategy(strategy)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      複製
                    </Button>
                  </div>
                  
                  {strategy.status === StrategyStatus.ACTIVE && (
                    <Button
                      size="sm"
                      onClick={() => executeStrategy(strategy.strategyId)}
                      disabled={executing}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      実行
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStrategies.length === 0 && (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <div className="text-gray-500 mb-4">
                {strategies.length === 0 
                  ? '戦略が作成されていません' 
                  : '条件に一致する戦略がありません'
                }
              </div>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {strategies.length === 0 ? '最初の戦略を作成' : '新規戦略作成'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <StrategyForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={() => {
          setShowCreateForm(false);
          refreshStrategies();
        }}
      />

      <StrategyForm
        open={!!editingStrategy}
        strategy={editingStrategy}
        onClose={() => setEditingStrategy(null)}
        onSubmit={() => {
          setEditingStrategy(null);
          refreshStrategies();
        }}
      />

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateStrategy} onOpenChange={() => setDuplicateStrategy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>戦略複製</DialogTitle>
          </DialogHeader>
          {duplicateStrategy && (
            <div className="space-y-4">
              <p>「{duplicateStrategy.name}」を複製しますか？</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDuplicateStrategy(null)}>
                  キャンセル
                </Button>
                <Button onClick={() => handleDuplicate(duplicateStrategy)}>
                  複製作成
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
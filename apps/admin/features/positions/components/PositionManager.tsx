'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { AlertTriangle, Settings, TrendingUp, Shield, Target } from 'lucide-react';
import { Position, PositionStatus, CreateExitStrategyInput } from '@repo/shared-types';
import { usePositions } from '../hooks/usePositions';
import { usePositionActions } from '../hooks/usePositionActions';
import { useStrategyActions } from '../../strategies/hooks/useStrategyActions';
import { PositionCard } from './PositionCard';
import { PositionActions } from './PositionActions';
import { formatCurrency, formatDateTime } from '../../../lib/utils';

interface PositionManagerProps {
  viewMode?: 'table' | 'cards';
  enableBulkActions?: boolean;
  enableStrategyCreation?: boolean;
}

interface TrailSettings {
  enabled: boolean;
  trailWidth: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface LossCutSettings {
  enabled: boolean;
  marginLevel: number; // %
  autoClose: boolean;
  emergencyMode: boolean;
}

export function PositionManager({ 
  viewMode = 'table', 
  enableBulkActions = true,
  enableStrategyCreation = true 
}: PositionManagerProps) {
  const { positions, loading, error, refreshPositions } = usePositions();
  const { updatePosition, loading: updating } = usePositionActions();
  const { createStrategy, loading: creatingStrategy } = useStrategyActions();
  
  // Filters and sorting
  const [statusFilter, setStatusFilter] = useState<PositionStatus | 'all'>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'symbol' | 'pnl' | 'risk'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection for bulk actions
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showTrailDialog, setShowTrailDialog] = useState(false);
  const [showLossCutDialog, setShowLossCutDialog] = useState(false);
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);

  // Trail settings state
  const [trailSettings, setTrailSettings] = useState<TrailSettings>({
    enabled: true,
    trailWidth: 50,
    stopLoss: undefined,
    takeProfit: undefined,
  });

  // Loss cut settings state
  const [lossCutSettings, setLossCutSettings] = useState<LossCutSettings>({
    enabled: true,
    marginLevel: 150, // 150% margin level
    autoClose: true,
    emergencyMode: false,
  });

  // Strategy creation state
  const [strategyName, setStrategyName] = useState('');
  const [primaryPositionId, setPrimaryPositionId] = useState('');
  const [strategyTrailWidth, setStrategyTrailWidth] = useState(50);

  const filteredAndSortedPositions = useMemo(() => {
    let filtered = positions;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Symbol filter
    if (symbolFilter) {
      filtered = filtered.filter(p => 
        p.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'pnl':
          aValue = calculatePnL(a);
          bValue = calculatePnL(b);
          break;
        case 'risk':
          aValue = calculateRiskLevel(a);
          bValue = calculateRiskLevel(b);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [positions, statusFilter, symbolFilter, sortBy, sortOrder]);

  const calculatePnL = (position: Position): number => {
    if (!position.entryPrice || position.status !== PositionStatus.OPEN) return 0;
    // Simplified P&L calculation (actual implementation needs current price)
    return position.profit || 0;
  };

  const calculateRiskLevel = (position: Position): number => {
    // Simplified risk calculation based on position size and market conditions
    if (position.status !== PositionStatus.OPEN) return 0;
    return position.volume * 100; // Basic risk metric
  };

  const getStatusBadgeVariant = (status: PositionStatus) => {
    switch (status) {
      case PositionStatus.OPEN: return 'default';
      case PositionStatus.PENDING: return 'secondary';
      case PositionStatus.CLOSING: return 'outline';
      case PositionStatus.CLOSED: return 'outline';
      case PositionStatus.STOPPED: return 'destructive';
      case PositionStatus.CANCELED: return 'secondary';
      default: return 'outline';
    }
  };

  const getRiskBadgeVariant = (position: Position) => {
    const risk = calculateRiskLevel(position);
    if (risk > 1000) return 'destructive';
    if (risk > 500) return 'secondary';
    return 'outline';
  };

  const handlePositionSelect = (positionId: string, checked: boolean) => {
    if (checked) {
      setSelectedPositions(prev => [...prev, positionId]);
    } else {
      setSelectedPositions(prev => prev.filter(id => id !== positionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const openPositions = filteredAndSortedPositions
        .filter(p => p.status === PositionStatus.OPEN)
        .map(p => p.positionId);
      setSelectedPositions(openPositions);
    } else {
      setSelectedPositions([]);
    }
  };

  const handleApplyTrailSettings = async () => {
    try {
      for (const positionId of selectedPositions) {
        await updatePosition(positionId, {
          trailSettings: {
            enabled: trailSettings.enabled,
            trailType: 'pip',
            trailValue: trailSettings.trailWidth,
          }
        });
      }
      setShowTrailDialog(false);
      setSelectedPositions([]);
      refreshPositions();
    } catch (error) {
      console.error('Failed to apply trail settings:', error);
      alert('トレール設定の適用に失敗しました');
    }
  };

  const handleApplyLossCutSettings = async () => {
    try {
      for (const positionId of selectedPositions) {
        await updatePosition(positionId, {
          lossCutSettings: {
            enabled: lossCutSettings.enabled,
            marginLevel: lossCutSettings.marginLevel,
            autoClose: lossCutSettings.autoClose,
            emergencyMode: lossCutSettings.emergencyMode,
          }
        });
      }
      setShowLossCutDialog(false);
      setSelectedPositions([]);
      refreshPositions();
    } catch (error) {
      console.error('Failed to apply loss cut settings:', error);
      alert('ロスカット設定の適用に失敗しました');
    }
  };

  const handleCreateExitStrategy = async () => {
    if (!strategyName || selectedPositions.length === 0 || !primaryPositionId) {
      alert('戦略名、対象ポジション、主要ポジションを選択してください');
      return;
    }

    try {
      const exitStrategyInput: CreateExitStrategyInput = {
        name: strategyName,
        selectedPositions,
        primaryPositionId,
        trailWidth: strategyTrailWidth,
      };

      await createStrategy(exitStrategyInput);
      setShowStrategyDialog(false);
      setSelectedPositions([]);
      setStrategyName('');
      setPrimaryPositionId('');
      alert('決済戦略が作成されました');
    } catch (error) {
      console.error('Failed to create exit strategy:', error);
      alert('決済戦略の作成に失敗しました');
    }
  };

  const openPositions = filteredAndSortedPositions.filter(p => p.status === PositionStatus.OPEN);
  const selectedOpenPositions = openPositions.filter(p => selectedPositions.includes(p.positionId));

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
            <Button onClick={refreshPositions}>再試行</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and Sort Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            ポジション管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="pending">待機中</SelectItem>
                <SelectItem value="open">オープン</SelectItem>
                <SelectItem value="closing">決済中</SelectItem>
                <SelectItem value="closed">クローズ済み</SelectItem>
                <SelectItem value="stopped">ロスカット</SelectItem>
                <SelectItem value="canceled">キャンセル</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="シンボル検索"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="w-40"
            />

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="ソート" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">更新日時</SelectItem>
                <SelectItem value="createdAt">作成日時</SelectItem>
                <SelectItem value="symbol">シンボル</SelectItem>
                <SelectItem value="pnl">損益</SelectItem>
                <SelectItem value="risk">リスク</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '昇順' : '降順'}
            </Button>

            <Button onClick={refreshPositions}>
              更新
            </Button>
          </div>

          {/* Bulk Action Controls */}
          {enableBulkActions && selectedPositions.length > 0 && (
            <div className="flex flex-wrap gap-2 p-4 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedPositions.length}件選択中:
              </span>
              
              <Dialog open={showTrailDialog} onOpenChange={setShowTrailDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    トレール設定
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>トレール設定</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={trailSettings.enabled}
                        onCheckedChange={(checked) => 
                          setTrailSettings(prev => ({ ...prev, enabled: checked as boolean }))
                        }
                      />
                      <Label>トレール機能を有効化</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>トレール幅 (pips)</Label>
                      <Input
                        type="number"
                        value={trailSettings.trailWidth}
                        onChange={(e) => 
                          setTrailSettings(prev => ({ ...prev, trailWidth: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <Button onClick={handleApplyTrailSettings} disabled={updating}>
                      適用
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showLossCutDialog} onOpenChange={setShowLossCutDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Shield className="h-4 w-4 mr-1" />
                    ロスカット設定
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>ロスカット設定</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={lossCutSettings.enabled}
                        onCheckedChange={(checked) => 
                          setLossCutSettings(prev => ({ ...prev, enabled: checked as boolean }))
                        }
                      />
                      <Label>ロスカット監視を有効化</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>証拠金維持率閾値 (%)</Label>
                      <Input
                        type="number"
                        value={lossCutSettings.marginLevel}
                        onChange={(e) => 
                          setLossCutSettings(prev => ({ ...prev, marginLevel: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={lossCutSettings.autoClose}
                        onCheckedChange={(checked) => 
                          setLossCutSettings(prev => ({ ...prev, autoClose: checked as boolean }))
                        }
                      />
                      <Label>自動決済を有効化</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={lossCutSettings.emergencyMode}
                        onCheckedChange={(checked) => 
                          setLossCutSettings(prev => ({ ...prev, emergencyMode: checked as boolean }))
                        }
                      />
                      <Label>緊急モード</Label>
                    </div>
                    <Button onClick={handleApplyLossCutSettings} disabled={updating}>
                      適用
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {enableStrategyCreation && (
                <Dialog open={showStrategyDialog} onOpenChange={setShowStrategyDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Target className="h-4 w-4 mr-1" />
                      決済戦略作成
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>決済戦略作成</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>戦略名</Label>
                        <Input
                          value={strategyName}
                          onChange={(e) => setStrategyName(e.target.value)}
                          placeholder="例: USD/JPY決済戦略"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>主要ポジション</Label>
                        <Select value={primaryPositionId} onValueChange={setPrimaryPositionId}>
                          <SelectTrigger>
                            <SelectValue placeholder="主要ポジションを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedOpenPositions.map((position) => (
                              <SelectItem key={position.positionId} value={position.positionId}>
                                {position.symbol} {position.volume} {position.direction === 'BUY' ? '買' : '売'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>トレール幅 (pips)</Label>
                        <Input
                          type="number"
                          value={strategyTrailWidth}
                          onChange={(e) => setStrategyTrailWidth(Number(e.target.value))}
                        />
                      </div>
                      <Button onClick={handleCreateExitStrategy} disabled={creatingStrategy}>
                        戦略作成
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position List */}
      {viewMode === 'table' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {enableBulkActions && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPositions.length === openPositions.length && openPositions.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>ポジションID</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>シンボル</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>エントリー価格</TableHead>
                <TableHead>現在価格</TableHead>
                <TableHead>損益</TableHead>
                <TableHead>リスク</TableHead>
                <TableHead>作成日時</TableHead>
                <TableHead>アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPositions.map((position) => (
                <TableRow key={position.positionId}>
                  {enableBulkActions && (
                    <TableCell>
                      {position.status === PositionStatus.OPEN && (
                        <Checkbox
                          checked={selectedPositions.includes(position.positionId)}
                          onCheckedChange={(checked) => 
                            handlePositionSelect(position.positionId, checked as boolean)
                          }
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">
                    {position.positionId.substring(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(position.status)}>
                      {position.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {position.symbol}
                  </TableCell>
                  <TableCell>
                    {position.volume.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {position.entryPrice ? formatCurrency(position.entryPrice) : '-'}
                  </TableCell>
                  <TableCell>
                    {position.currentPrice ? formatCurrency(position.currentPrice) : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={calculatePnL(position) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(calculatePnL(position))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRiskBadgeVariant(position)}>
                      {calculateRiskLevel(position) > 1000 && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {calculateRiskLevel(position).toFixed(0)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(position.createdAt)}
                  </TableCell>
                  <TableCell>
                    <PositionActions position={position} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedPositions.map((position) => (
            <PositionCard key={position.positionId} position={position} />
          ))}
        </div>
      )}

      {filteredAndSortedPositions.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              条件に一致するポジションがありません
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
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
import { Settings, TrendingUp, Plus, Play } from 'lucide-react';
import { Position, PositionStatus, ExecutionType, Symbol } from '@repo/shared-types';
import { usePositions } from '../hooks/usePositions';
import { usePositionActions } from '../hooks/usePositionActions';
import { PositionActions } from './PositionActions';
import { formatCurrency, formatDateTime } from '../../../lib/utils';
import { amplifyClient } from '../../../lib/amplify-client';
import { getCurrentUser } from 'aws-amplify/auth';

interface PositionManagerProps {
  viewMode?: 'table';
}

interface TrailSettings {
  enabled: boolean;
  trailWidth: number;
}

interface CreatePositionInput {
  accountId: string;
  symbol: Symbol;
  volume: number;
  executionType: ExecutionType;
  trailWidth: number;
  memo: string;
}

export function PositionManager({ 
  viewMode = 'table'
}: PositionManagerProps) {
  const { positions, loading, error, refreshPositions } = usePositions();
  const { updatePosition, loading: updating } = usePositionActions();
  
  // Basic filters only
  const [statusFilter, setStatusFilter] = useState<PositionStatus | 'all'>('all');
  const [showTrailDialog, setShowTrailDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // Trail settings state
  const [trailSettings, setTrailSettings] = useState<TrailSettings>({
    enabled: true,
    trailWidth: 50,
  });

  // Position creation state
  const [createForm, setCreateForm] = useState<CreatePositionInput>({
    accountId: '',
    symbol: Symbol.USDJPY,
    volume: 1.0,
    executionType: ExecutionType.ENTRY,
    trailWidth: 0,
    memo: ''
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const filteredPositions = useMemo(() => {
    let filtered = positions;

    // Status filter only
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Simple sort by update time
    return filtered.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [positions, statusFilter]);

  const calculatePnL = (position: Position): number => {
    if (!position.entryPrice || position.status !== PositionStatus.OPEN) return 0;
    return position.profit || 0;
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

  const handleTrailSettingsOpen = (position: Position) => {
    setSelectedPosition(position);
    setTrailSettings({
      enabled: position.trailWidth ? position.trailWidth > 0 : false,
      trailWidth: position.trailWidth || 50,
    });
    setShowTrailDialog(true);
  };

  const handleApplyTrailSettings = async () => {
    if (!selectedPosition) return;

    try {
      await updatePosition(selectedPosition.id, {
        trailSettings: {
          enabled: trailSettings.enabled,
          trailType: 'pip',
          trailValue: trailSettings.trailWidth,
        }
      });
      setShowTrailDialog(false);
      setSelectedPosition(null);
      refreshPositions();
    } catch (error) {
      console.error('Failed to apply trail settings:', error);
      alert('トレール設定の適用に失敗しました');
    }
  };

  /**
   * ポジション作成（MVPシステム設計書v7.0準拠）
   */
  const createPosition = async (data: CreatePositionInput): Promise<void> => {
    setIsCreating(true);
    try {
      // Get current user ID
      const user = await getCurrentUser();
      const userId = user.userId;
      
      console.log('Creating position with trail settings:', { trailWidth: data.trailWidth });
      
      // ポジション作成 (アクション作成前にIDが必要なため、まず作成)
      const positionResult = await amplifyClient.models.Position.create({
        userId: userId,
        accountId: data.accountId,
        symbol: data.symbol,
        volume: data.volume,
        executionType: data.executionType,
        status: PositionStatus.PENDING,
        trailWidth: data.trailWidth,
        triggerActionIds: '', // 後で更新
        memo: data.memo
      });
      
      if (positionResult.errors) {
        throw new Error(positionResult.errors.map((e: any) => e.message).join(', '));
      }
      
      const positionId = positionResult.data!.id;
      let triggerActionIds = '';
      
      // トレール設定確認 - 設計書準拠のアクション事前作成
      if (data.trailWidth > 0) {
        console.log('Creating trigger actions for trail position');
        const triggerActions = await createTriggerActions(userId, data.accountId, positionId);
        triggerActionIds = JSON.stringify(triggerActions.map(a => a.id));
        
        // ポジション更新 - triggerActionIdsを設定
        await amplifyClient.models.Position.update({
          id: positionId,
          triggerActionIds: triggerActionIds
        });
      }
      
      setShowCreateDialog(false);
      refreshPositions();
      console.log('Position created successfully:', { positionId, triggerActionIds });
      alert('ポジションを作成しました');
    } catch (error) {
      console.error('Failed to create position:', error);
      alert('ポジションの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * トレール用アクション事前作成（MVPシステム設計書準拠）
   * 設計書: "トレール設定があれば事前にアクションを作成しPENDING状態で待機"
   */
  const createTriggerActions = async (
    userId: string, 
    accountId: string, 
    positionId: string
  ): Promise<any[]> => {
    const actions = [];
    
    try {
      // CLOSE アクション作成 - トレール条件達成時の決済用
      const closeActionResult = await amplifyClient.models.Action.create({
        userId: userId,
        accountId: accountId,
        positionId: positionId,
        triggerPositionId: positionId, // このポジションがトリガー
        type: 'CLOSE',
        status: 'PENDING'
      });
      
      if (closeActionResult.errors) {
        throw new Error('Failed to create close action');
      }
      
      actions.push(closeActionResult.data);
      console.log('Created trigger action:', { actionId: closeActionResult.data!.id, type: 'CLOSE' });
      
      // 必要に応じて追加のアクション（他口座でのヘッジエントリーなど）
      // MVPでは基本的なCLOSEアクションのみ実装
      
      return actions;
    } catch (error) {
      console.error('Failed to create trigger actions:', error);
      throw error;
    }
  };

  /**
   * ポジション実行
   */
  const executePosition = async (positionId: string): Promise<void> => {
    setIsExecuting(true);
    try {
      await amplifyClient.models.Position.update({
        id: positionId,
        status: PositionStatus.OPENING
      });
      // Subscription経由でHedge Systemが実行
      alert('ポジションの実行を開始しました');
      refreshPositions();
    } catch (error) {
      console.error('Failed to execute position:', error);
      alert('ポジションの実行に失敗しました');
    } finally {
      setIsExecuting(false);
    }
  };

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
      {/* Controls */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="pending">待機中</SelectItem>
            <SelectItem value="open">オープン</SelectItem>
            <SelectItem value="closed">クローズ済み</SelectItem>
            <SelectItem value="stopped">ロスカット</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={refreshPositions} variant="outline" size="sm">
          更新
        </Button>
        
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          作成
        </Button>
      </div>

      {/* Position List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ポジションID</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>シンボル</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>エントリー価格</TableHead>
              <TableHead>損益</TableHead>
              <TableHead>作成日時</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPositions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-mono text-sm">
                  {position.id.substring(0, 8)}...
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
                  <span className={calculatePnL(position) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(calculatePnL(position))}
                  </span>
                </TableCell>
                <TableCell>
                  {formatDateTime(position.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {position.status === PositionStatus.PENDING && (
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => executePosition(position.id)}
                        disabled={isExecuting}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        実行
                      </Button>
                    )}
                    {position.status === PositionStatus.OPEN && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleTrailSettingsOpen(position)}
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        トレール
                      </Button>
                    )}
                    <PositionActions position={position} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {filteredPositions.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              条件に一致するポジションがありません
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trail Settings Dialog */}
      <Dialog open={showTrailDialog} onOpenChange={setShowTrailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>トレール設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="flex gap-2">
              <Button onClick={handleApplyTrailSettings} disabled={updating}>
                適用
              </Button>
              <Button variant="outline" onClick={() => setShowTrailDialog(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Position Creation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ポジション作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>口座ID</Label>
              <Input
                value={createForm.accountId}
                onChange={(e) => 
                  setCreateForm(prev => ({ ...prev, accountId: e.target.value }))
                }
                placeholder="account-123"
              />
            </div>
            
            <div className="space-y-2">
              <Label>シンボル</Label>
              <Select 
                value={createForm.symbol} 
                onValueChange={(value) => 
                  setCreateForm(prev => ({ ...prev, symbol: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Symbol.USDJPY}>USDJPY</SelectItem>
                  <SelectItem value={Symbol.EURUSD}>EURUSD</SelectItem>
                  <SelectItem value={Symbol.EURGBP}>EURGBP</SelectItem>
                  <SelectItem value={Symbol.XAUUSD}>XAUUSD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>数量</Label>
              <Input
                type="number"
                step="0.01"
                value={createForm.volume}
                onChange={(e) => 
                  setCreateForm(prev => ({ ...prev, volume: Number(e.target.value) }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>実行タイプ</Label>
              <Select 
                value={createForm.executionType} 
                onValueChange={(value) => 
                  setCreateForm(prev => ({ ...prev, executionType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ExecutionType.ENTRY}>エントリー</SelectItem>
                  <SelectItem value={ExecutionType.EXIT}>エグジット</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>トレール幅 (pips)</Label>
              <Input
                type="number"
                value={createForm.trailWidth}
                onChange={(e) => 
                  setCreateForm(prev => ({ ...prev, trailWidth: Number(e.target.value) }))
                }
                placeholder="0 = トレールなし"
              />
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Input
                value={createForm.memo}
                onChange={(e) => 
                  setCreateForm(prev => ({ ...prev, memo: e.target.value }))
                }
                placeholder="オプション"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => createPosition(createForm)} 
                disabled={isCreating || !createForm.accountId}
              >
                {isCreating ? '作成中...' : '作成'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
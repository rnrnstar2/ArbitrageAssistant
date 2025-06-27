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
    return filtered.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [positions, statusFilter]);

  /**
   * P&L計算（MVPシステム設計書準拠）
   * リアルタイム価格に基づくP&L計算
   */
  const calculatePnL = (position: Position): number => {
    if (!position.entryPrice || position.status !== 'OPEN') return 0;
    
    // 簡易実装: 実際のシステムではリアルタイム価格APIから取得
    // TODO: WebSocket経由でのリアルタイム価格取得実装
    const mockCurrentPrices: Record<string, number> = {
      'USDJPY': 150.25,
      'EURUSD': 1.0845,
      'EURGBP': 0.8642,
      'XAUUSD': 2034.75
    };
    
    const currentPrice = mockCurrentPrices[position.symbol];
    if (!currentPrice) return 0;
    
    const priceDiff = currentPrice - position.entryPrice;
    
    // ポジション方向の判定
    let isLong = true;
    if (position.executionType === 'EXIT') {
      isLong = false; // EXIT の場合は売りポジション
    }
    
    // P&L計算
    const pipValue = getPipValue(position.symbol);
    const pips = Math.abs(priceDiff) / pipValue;
    let pnl = pips * position.volume * pipValue * 100; // 1pip = 100通貨単位と仮定
    
    // 方向性の調整
    if ((isLong && priceDiff < 0) || (!isLong && priceDiff > 0)) {
      pnl = -pnl;
    }
    
    return Math.round(pnl);
  };
  
  /**
   * 通貨ペア別pip値取得
   */
  const getPipValue = (symbol: Symbol): number => {
    switch (symbol) {
      case Symbol.USDJPY:
        return 0.01; // 1pip = 0.01円
      case Symbol.EURUSD:
      case Symbol.EURGBP:
        return 0.0001; // 1pip = 0.0001
      case Symbol.XAUUSD:
        return 0.1; // 1pip = 0.1ドル
      default:
        return 0.0001;
    }
  };
  
  /**
   * 現在価格取得（リアルタイム価格表示用）
   */
  const getCurrentPrice = (symbol: Symbol): number | null => {
    const mockCurrentPrices: Record<string, number> = {
      'USDJPY': 150.25,
      'EURUSD': 1.0845,
      'EURGBP': 0.8642,
      'XAUUSD': 2034.75
    };
    return mockCurrentPrices[symbol] || null;
  };
  
  /**
   * P&L状態によるカラー判定
   */
  const getPnLColorClass = (pnl: number): string => {
    if (pnl > 0) return 'text-green-600 font-semibold';
    if (pnl < 0) return 'text-red-600 font-semibold';
    return 'text-gray-600';
  };

  const getStatusBadgeVariant = (status: PositionStatus) => {
    switch (status) {
      case 'OPEN': return 'default';
      case 'PENDING': return 'secondary';
      case 'CLOSING': return 'outline';
      case 'CLOSED': return 'outline';
      case 'STOPPED': return 'destructive';
      case 'CANCELED': return 'secondary';
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
        status: 'PENDING',
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
        status: 'OPENING'
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">ポジションID</TableHead>
                <TableHead className="min-w-[100px]">ステータス</TableHead>
                <TableHead className="min-w-[80px]">シンボル</TableHead>
                <TableHead className="min-w-[70px]">タイプ</TableHead>
                <TableHead className="min-w-[80px]">数量</TableHead>
                <TableHead className="min-w-[100px]">エントリー価格</TableHead>
                <TableHead className="min-w-[100px]">現在価格</TableHead>
                <TableHead className="min-w-[100px]">損益</TableHead>
                <TableHead className="min-w-[80px]">トレール</TableHead>
                <TableHead className="min-w-[120px]">作成日時</TableHead>
                <TableHead className="min-w-[150px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPositions.map((position) => {
                const currentPrice = getCurrentPrice(position.symbol);
                const pnl = calculatePnL(position);
                
                return (
                  <TableRow key={position.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-xs">
                      <div className="flex flex-col">
                        <span>{position.id.substring(0, 8)}...</span>
                        {position.mtTicket && (
                          <span className="text-gray-500 text-xs">MT: {position.mtTicket}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(position.status)} className="text-xs">
                        {position.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {position.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={position.executionType === 'ENTRY' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {position.executionType === 'ENTRY' ? 'BUY' : 'SELL'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {position.volume.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {position.entryPrice ? (
                        <span className="font-mono text-sm">
                          {formatCurrency(position.entryPrice)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {currentPrice ? (
                        <div className="flex items-center space-x-1">
                          <span className="font-mono text-sm">
                            {formatCurrency(currentPrice)}
                          </span>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={getPnLColorClass(pnl)}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {position.trailWidth && position.trailWidth > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {position.trailWidth}pips
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">なし</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {formatDateTime(position.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {position.status === 'PENDING' && (
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => executePosition(position.id)}
                            disabled={isExecuting}
                            className="text-xs px-2 py-1"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            実行
                          </Button>
                        )}
                        {position.status === 'OPEN' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTrailSettingsOpen(position)}
                            className="text-xs px-2 py-1"
                          >
                            <TrendingUp className="h-3 w-3 mr-1" />
                            トレール
                          </Button>
                        )}
                        <PositionActions position={position} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
                  setCreateForm(prev => ({ ...prev, symbol: value as any }))
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
                  setCreateForm(prev => ({ ...prev, executionType: value as any }))
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
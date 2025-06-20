'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HedgePosition } from '../types';

// 両建て制御アクション定義
export interface HedgeAction {
  type: 'dissolve' | 'close_buy' | 'close_sell' | 'add_hedge' | 'rebalance';
  hedgeId: string;
  params?: {
    lots?: number;
    targetRatio?: number;
    accounts?: string[];
  };
}

// 両建て設定定義
export interface HedgeSettings {
  autoRebalance: boolean;
  maxImbalance: number; // percentage
  maintainOnClose: boolean;
  alertOnImbalance: boolean;
  rebalanceThreshold: number; // percentage
  maxPositionSize: number; // lots
}

interface HedgeControlPanelProps {
  selectedHedge: HedgePosition | null;
  onExecuteAction: (action: HedgeAction) => Promise<void>;
  onUpdateSettings: (settings: HedgeSettings) => void;
  isExecuting?: boolean;
  settings?: HedgeSettings;
}

const defaultSettings: HedgeSettings = {
  autoRebalance: false,
  maxImbalance: 10, // 10%
  maintainOnClose: true,
  alertOnImbalance: true,
  rebalanceThreshold: 5, // 5%
  maxPositionSize: 10.0
};

export const HedgeControlPanel: React.FC<HedgeControlPanelProps> = ({
  selectedHedge,
  onExecuteAction,
  onUpdateSettings,
  isExecuting = false,
  settings = defaultSettings
}) => {
  const [activeTab, setActiveTab] = useState('control');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<HedgeAction | null>(null);
  const [localSettings, setLocalSettings] = useState<HedgeSettings>(settings);
  const [actionParams, setActionParams] = useState<{ lots?: number; targetRatio?: number }>({});

  // 制御アクション実行
  const handleExecuteAction = useCallback(async (action: HedgeAction) => {
    setPendingAction(action);
    setShowConfirmDialog(true);
  }, []);

  // 確認ダイアログでの実行
  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;

    try {
      await onExecuteAction({
        ...pendingAction,
        params: { ...pendingAction.params, ...actionParams }
      });
    } catch (error) {
      console.error('Failed to execute hedge action:', error);
    } finally {
      setShowConfirmDialog(false);
      setPendingAction(null);
      setActionParams({});
    }
  }, [pendingAction, actionParams, onExecuteAction]);

  // 設定更新
  const handleSettingsChange = useCallback((newSettings: Partial<HedgeSettings>) => {
    const updatedSettings = { ...localSettings, ...newSettings };
    setLocalSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
  }, [localSettings, onUpdateSettings]);

  // 両建て状態表示
  const getHedgeStatusBadge = (hedge: HedgePosition) => {
    if (!hedge.isBalanced) {
      return <Badge variant="destructive">不均衡</Badge>;
    }
    switch (hedge.hedgeType) {
      case 'perfect':
        return <Badge variant="default">完全両建て</Badge>;
      case 'partial':
        return <Badge variant="secondary">部分両建て</Badge>;
      case 'cross_account':
        return <Badge variant="outline">クロスアカウント</Badge>;
      default:
        return <Badge variant="outline">不明</Badge>;
    }
  };

  // 不均衡率計算
  const getImbalanceRatio = (hedge: HedgePosition) => {
    const { buy, sell } = hedge.totalLots;
    const total = buy + sell;
    if (total === 0) return 0;
    return Math.abs((buy - sell) / total) * 100;
  };

  // アクション名の日本語化
  const getActionName = (type: HedgeAction['type']) => {
    switch (type) {
      case 'dissolve': return '両建て解除';
      case 'close_buy': return '買いポジション決済';
      case 'close_sell': return '売りポジション決済';
      case 'add_hedge': return '追加両建て';
      case 'rebalance': return 'リバランス実行';
      default: return '不明なアクション';
    }
  };

  if (!selectedHedge) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">両建てポジションを選択してください</p>
        </CardContent>
      </Card>
    );
  }

  const imbalanceRatio = getImbalanceRatio(selectedHedge);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🎯 両建て制御パネル</span>
            <div className="flex items-center space-x-2">
              {getHedgeStatusBadge(selectedHedge)}
              {imbalanceRatio > settings.maxImbalance && (
                <Badge variant="destructive">
                  不均衡 {imbalanceRatio.toFixed(1)}%
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="control">制御</TabsTrigger>
              <TabsTrigger value="settings">設定</TabsTrigger>
              <TabsTrigger value="status">状態</TabsTrigger>
            </TabsList>

            {/* 制御タブ */}
            <TabsContent value="control" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 基本制御 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">基本制御</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={() => handleExecuteAction({
                        type: 'dissolve',
                        hedgeId: selectedHedge.id
                      })}
                      disabled={isExecuting}
                      variant="destructive"
                      className="w-full"
                    >
                      両建て解除
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleExecuteAction({
                          type: 'close_buy',
                          hedgeId: selectedHedge.id
                        })}
                        disabled={isExecuting}
                        variant="outline"
                        size="sm"
                      >
                        買い決済
                      </Button>
                      <Button
                        onClick={() => handleExecuteAction({
                          type: 'close_sell',
                          hedgeId: selectedHedge.id
                        })}
                        disabled={isExecuting}
                        variant="outline"
                        size="sm"
                      >
                        売り決済
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 高度な制御 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">高度な制御</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="addLots">追加ロット数</Label>
                      <Input
                        id="addLots"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.10"
                        value={actionParams.lots || ''}
                        onChange={(e) => setActionParams(prev => ({
                          ...prev,
                          lots: parseFloat(e.target.value) || undefined
                        }))}
                      />
                    </div>
                    
                    <Button
                      onClick={() => handleExecuteAction({
                        type: 'add_hedge',
                        hedgeId: selectedHedge.id
                      })}
                      disabled={isExecuting || !actionParams.lots}
                      className="w-full"
                    >
                      追加両建て実行
                    </Button>

                    <Separator />

                    <Button
                      onClick={() => handleExecuteAction({
                        type: 'rebalance',
                        hedgeId: selectedHedge.id
                      })}
                      disabled={isExecuting || selectedHedge.isBalanced}
                      variant="secondary"
                      className="w-full"
                    >
                      リバランス実行
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* 警告表示 */}
              {imbalanceRatio > settings.maxImbalance && (
                <Alert>
                  <AlertDescription>
                    ⚠️ 不均衡率が設定値({settings.maxImbalance}%)を超えています。
                    リバランスの実行を検討してください。
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* 設定タブ */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">自動制御設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="autoRebalance">自動リバランス</Label>
                    <Switch
                      id="autoRebalance"
                      checked={localSettings.autoRebalance}
                      onCheckedChange={(checked) => 
                        handleSettingsChange({ autoRebalance: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxImbalance">最大不均衡許容値 (%)</Label>
                    <Input
                      id="maxImbalance"
                      type="number"
                      min="1"
                      max="50"
                      value={localSettings.maxImbalance}
                      onChange={(e) => 
                        handleSettingsChange({ maxImbalance: parseInt(e.target.value) || 10 })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rebalanceThreshold">リバランス閾値 (%)</Label>
                    <Input
                      id="rebalanceThreshold"
                      type="number"
                      min="1"
                      max="25"
                      value={localSettings.rebalanceThreshold}
                      onChange={(e) => 
                        handleSettingsChange({ rebalanceThreshold: parseInt(e.target.value) || 5 })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPositionSize">最大ポジションサイズ (lots)</Label>
                    <Input
                      id="maxPositionSize"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={localSettings.maxPositionSize}
                      onChange={(e) => 
                        handleSettingsChange({ maxPositionSize: parseFloat(e.target.value) || 10.0 })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">運用設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="maintainOnClose">決済時の両建て維持</Label>
                    <Switch
                      id="maintainOnClose"
                      checked={localSettings.maintainOnClose}
                      onCheckedChange={(checked) => 
                        handleSettingsChange({ maintainOnClose: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="alertOnImbalance">不均衡時のアラート</Label>
                    <Switch
                      id="alertOnImbalance"
                      checked={localSettings.alertOnImbalance}
                      onCheckedChange={(checked) => 
                        handleSettingsChange({ alertOnImbalance: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 状態タブ */}
            <TabsContent value="status" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">両建て詳細情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>通貨ペア</Label>
                      <p className="font-semibold">{selectedHedge.symbol}</p>
                    </div>
                    <div>
                      <Label>種別</Label>
                      <p className="font-semibold">{selectedHedge.hedgeType}</p>
                    </div>
                    <div>
                      <Label>買いポジション</Label>
                      <p className="font-semibold">{selectedHedge.totalLots.buy} lots</p>
                    </div>
                    <div>
                      <Label>売りポジション</Label>
                      <p className="font-semibold">{selectedHedge.totalLots.sell} lots</p>
                    </div>
                    <div>
                      <Label>総損益</Label>
                      <p className={`font-semibold ${selectedHedge.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedHedge.totalProfit >= 0 ? '+' : ''}{selectedHedge.totalProfit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <Label>不均衡率</Label>
                      <p className={`font-semibold ${imbalanceRatio > settings.maxImbalance ? 'text-red-600' : 'text-green-600'}`}>
                        {imbalanceRatio.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label>関連アカウント</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedHedge.accounts.map((account) => (
                        <Badge key={account} variant="outline">
                          {account}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>関連ポジション</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedHedge.positionIds.map((positionId) => (
                        <Badge key={positionId} variant="secondary">
                          {positionId}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>作成日時</Label>
                      <p className="text-sm text-gray-600">
                        {selectedHedge.createdAt.toLocaleString()}
                      </p>
                    </div>
                    {selectedHedge.lastRebalanced && (
                      <div>
                        <Label>最終リバランス</Label>
                        <p className="text-sm text-gray-600">
                          {selectedHedge.lastRebalanced.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 確認ダイアログ */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アクション実行確認</DialogTitle>
            <DialogDescription>
              以下のアクションを実行しますか？
            </DialogDescription>
          </DialogHeader>
          
          {pendingAction && (
            <div className="space-y-2">
              <p><strong>アクション:</strong> {getActionName(pendingAction.type)}</p>
              <p><strong>対象:</strong> {selectedHedge.symbol} ({selectedHedge.hedgeType})</p>
              {actionParams.lots && (
                <p><strong>ロット数:</strong> {actionParams.lots}</p>
              )}
              {pendingAction.type === 'dissolve' && (
                <Alert>
                  <AlertDescription>
                    ⚠️ この操作により、すべての関連ポジションが決済されます。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isExecuting}
            >
              キャンセル
            </Button>
            <Button 
              onClick={confirmAction}
              disabled={isExecuting}
            >
              {isExecuting ? '実行中...' : '実行'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HedgeControlPanel;
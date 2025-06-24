'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { Badge } from '@repo/ui/components/ui/badge';
import { Trash2, Plus, Settings } from 'lucide-react';
import { ActionBuilder } from '../../actions/components/ActionBuilder';
import { amplifyClient } from '../../../lib/amplify-client';
import { CreateActionInput, ActionStatus } from '@repo/shared-types';

interface TrailConfigProps {
  onSubmit: (positionData: {
    trailWidth: number;
    triggerActionIds: string;
  }) => void;
  onCancel?: () => void;
  initialTrailWidth?: number;
  initialTriggerActions?: CreateActionInput[];
}

interface PendingAction {
  id: string;
  type: string;
  parameters: Record<string, any>;
  userId: string;
  accountId: string;
}

export default function TrailConfig({ 
  onSubmit, 
  onCancel,
  initialTrailWidth = 0,
  initialTriggerActions = []
}: TrailConfigProps) {
  const [trailWidth, setTrailWidth] = useState<number>(initialTrailWidth);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [showActionBuilder, setShowActionBuilder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAction = () => {
    setShowActionBuilder(true);
  };

  const handleActionSave = (actionData: any) => {
    const newAction: PendingAction = {
      id: `temp_${Date.now()}`,
      type: actionData.type,
      parameters: actionData.parameters,
      userId: actionData.userId,
      accountId: actionData.accountId
    };
    
    setPendingActions(prev => [...prev, newAction]);
    setShowActionBuilder(false);
  };

  const handleActionCancel = () => {
    setShowActionBuilder(false);
  };

  const handleRemoveAction = (actionId: string) => {
    setPendingActions(prev => prev.filter(action => action.id !== actionId));
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'ENTRY': return 'エントリー';
      case 'CLOSE': return '決済';
      case 'PARTIAL_CLOSE': return '部分決済';
      case 'TRAIL_SET': return 'トレール設定';
      case 'WAIT': return '待機';
      default: return type;
    }
  };

  const getActionDescription = (action: PendingAction) => {
    const { type, parameters } = action;
    
    switch (type) {
      case 'ENTRY':
        return `${parameters.symbol} ${parameters.direction} ${parameters.lots}ロット`;
      case 'CLOSE':
        return 'ポジション決済';
      case 'PARTIAL_CLOSE':
        return `${(parameters.closeRatio * 100)}%部分決済`;
      case 'TRAIL_SET':
        return `トレール幅 ${parameters.trailDistance}pips`;
      case 'WAIT':
        return `${parameters.waitSeconds}秒待機`;
      default:
        return '詳細不明';
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // トレール用アクション作成
      const createdActions = await Promise.all(
        pendingActions.map(action => 
          amplifyClient.models.Action.create({
            type: action.type as any,
            userId: action.userId,
            accountId: action.accountId,
            positionId: 'temp-position-id',
            status: 'PENDING'
          })
        )
      );

      // ポジションにトレール設定
      const positionData = {
        trailWidth,
        triggerActionIds: JSON.stringify(createdActions.map(result => result.data?.id).filter(Boolean))
      };

      onSubmit(positionData);
    } catch (error) {
      console.error('Failed to create trail actions:', error);
      alert('トレール設定の保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            トレール設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="trailWidth">トレール幅 (pips)</Label>
            <Input
              id="trailWidth"
              type="number"
              value={trailWidth}
              onChange={(e) => setTrailWidth(Number(e.target.value))}
              placeholder="0で即時実行"
              min="0"
              step="1"
            />
            {trailWidth === 0 && (
              <p className="text-sm text-amber-600 mt-1">
                ⚠️ トレール幅 0 = 即時実行モード
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>トレール発動時のアクション</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingActions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>まだアクションが設定されていません</p>
                <p className="text-sm">「アクション追加」ボタンでトレール発動時の動作を設定してください</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingActions.map((action, index) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">
                          {getActionTypeLabel(action.type)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {getActionDescription(action)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveAction(action.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleAddAction}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              アクション追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || pendingActions.length === 0}
          className="flex-1"
        >
          {isSubmitting ? '保存中...' : 'トレール設定保存'}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
        )}
      </div>

      {/* Action Builder Dialog */}
      <Dialog open={showActionBuilder} onOpenChange={setShowActionBuilder}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>トレール発動アクション作成</DialogTitle>
          </DialogHeader>
          <ActionBuilder
            onSave={handleActionSave}
            onCancel={handleActionCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
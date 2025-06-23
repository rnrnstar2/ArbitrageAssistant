"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Plus, Play, Pause, Save, Shuffle } from "lucide-react";
import { SortableActionCard } from "./SortableActionCard";
import { ActionBuilder } from "./ActionBuilder";
import { cn } from "@repo/ui/lib/utils";

interface Action {
  id: string;
  type: 'ENTRY' | 'CLOSE' | 'PARTIAL_CLOSE' | 'TRAIL_SET' | 'WAIT';
  userId?: string;
  accountId?: string;
  parameters: Record<string, any>;
  status: string;
}

interface SequenceBuilderProps {
  onSave?: (sequence: any) => void;
}

export function SequenceBuilder({ onSave }: SequenceBuilderProps) {
  const [actions, setActions] = useState<Action[]>([]);
  const [showActionBuilder, setShowActionBuilder] = useState(false);
  const [sequenceName, setSequenceName] = useState('');
  const [camouflageEnabled, setCamouflageEnabled] = useState(true);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setActions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddAction = (action: Omit<Action, 'id'>) => {
    const newAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setActions([...actions, newAction]);
    setShowActionBuilder(false);
  };

  const handleDeleteAction = (id: string) => {
    setActions(actions.filter(action => action.id !== id));
  };

  const handleSaveSequence = () => {
    const sequence = {
      name: sequenceName || '新規シーケンス',
      actions: actions,
      camouflageSettings: {
        enabled: camouflageEnabled,
        randomDelayMin: 60,
        randomDelayMax: 300,
        humanLikeExecution: true,
      },
      executionType: 'SEQUENTIAL',
      status: 'DRAFT',
    };
    onSave?.(sequence);
  };

  // サンプルアクションを追加
  const addSampleCamouflageSequence = () => {
    const sampleActions: Action[] = [
      {
        id: 'sample-1',
        type: 'ENTRY',
        userId: 'user1',
        accountId: 'acc1',
        parameters: { symbol: 'USDJPY', direction: 'BUY', lots: 1.0 },
        status: 'PENDING'
      },
      {
        id: 'sample-2',
        type: 'WAIT',
        parameters: { waitSeconds: 180 },
        status: 'PENDING'
      },
      {
        id: 'sample-3',
        type: 'TRAIL_SET',
        userId: 'user1',
        accountId: 'acc1',
        parameters: { trailDistance: 20, trailStep: 5 },
        status: 'PENDING'
      },
      {
        id: 'sample-4',
        type: 'WAIT',
        parameters: { waitSeconds: 300 },
        status: 'PENDING'
      },
      {
        id: 'sample-5',
        type: 'ENTRY',
        userId: 'user2',
        accountId: 'acc2',
        parameters: { symbol: 'USDJPY', direction: 'SELL', lots: 0.8 },
        status: 'PENDING'
      },
      {
        id: 'sample-6',
        type: 'WAIT',
        parameters: { waitSeconds: 120 },
        status: 'PENDING'
      },
      {
        id: 'sample-7',
        type: 'ENTRY',
        userId: 'user2',
        accountId: 'acc2',
        parameters: { symbol: 'USDJPY', direction: 'SELL', lots: 0.2 },
        status: 'PENDING'
      }
    ];
    setActions(sampleActions);
    setSequenceName('カモフラージュ両建て戦略');
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">アクションシーケンスビルダー</h2>
          <p className="text-muted-foreground">
            ドラッグ&ドロップでアクションを並び替えて、複雑な戦略を構築
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addSampleCamouflageSequence}>
            <Shuffle className="mr-2 h-4 w-4" />
            サンプル追加
          </Button>
          <Button onClick={handleSaveSequence}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {/* シーケンス設定 */}
      <Card>
        <CardHeader>
          <CardTitle>シーケンス設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">シーケンス名</label>
            <input
              type="text"
              value={sequenceName}
              onChange={(e) => setSequenceName(e.target.value)}
              placeholder="例: カモフラージュ両建て戦略"
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={camouflageEnabled}
                onChange={(e) => setCamouflageEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">カモフラージュ機能を有効化</span>
            </label>
            {camouflageEnabled && (
              <Badge variant="secondary" className="text-xs">
                ランダム遅延: 60-300秒
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* アクションリスト */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>アクション一覧</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowActionBuilder(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              アクション追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              アクションがありません。「アクション追加」ボタンから追加してください。
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={actions.map(a => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {actions.map((action, index) => (
                    <SortableActionCard
                      key={action.id}
                      action={action}
                      index={index}
                      onDelete={handleDeleteAction}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* 実行プレビュー */}
      {actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>実行プレビュー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">推定実行時間</span>
                <span className="font-medium">
                  {Math.ceil(actions.reduce((sum, action) => {
                    if (action.type === 'WAIT') {
                      return sum + (action.parameters.waitSeconds || 0);
                    }
                    return sum + 30; // 他のアクションは30秒と仮定
                  }, 0) / 60)} 分
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">検知リスク</span>
                <Badge variant={camouflageEnabled ? "secondary" : "destructive"}>
                  {camouflageEnabled ? "低" : "高"}
                </Badge>
              </div>
              <Button className="w-full mt-4">
                <Play className="mr-2 h-4 w-4" />
                シーケンス実行
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* アクションビルダーモーダル */}
      {showActionBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ActionBuilder
              onSave={handleAddAction}
              onCancel={() => setShowActionBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
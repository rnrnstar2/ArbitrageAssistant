"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
import { Position, TrailSettings } from "../../monitoring/types";

interface LinkedActionRule {
  id: string;
  sourcePositionId: string;
  targetPositionId: string;
  trigger: 'close' | 'profit_target' | 'loss_limit';
  action: 'close' | 'trail' | 'modify';
  settings?: TrailSettings;
  isActive: boolean;
}

interface LinkedActionSettingsProps {
  positions: Position[];
  onRuleCreate: (rule: Omit<LinkedActionRule, 'id'>) => void;
  onRuleUpdate: (ruleId: string, rule: Partial<LinkedActionRule>) => void;
  onRuleDelete: (ruleId: string) => void;
  existingRules: LinkedActionRule[];
}

export function LinkedActionSettings({
  positions,
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  existingRules,
}: LinkedActionSettingsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newRule, setNewRule] = useState<Omit<LinkedActionRule, 'id'>>({
    sourcePositionId: "",
    targetPositionId: "",
    trigger: "close",
    action: "close",
    isActive: true,
  });

  const getPositionLabel = (position: Position) => {
    return `${position.symbol} ${position.type === 'buy' ? '買い' : '売り'} ${position.lots}lot`;
  };

  const getRelatedPositions = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return [];
    
    return positions.filter(p => 
      p.id !== positionId && 
      (p.relatedPositionId === positionId || position.relatedPositionId === p.id)
    );
  };

  const handleCreateRule = () => {
    if (!newRule.sourcePositionId || !newRule.targetPositionId) return;
    
    onRuleCreate(newRule);
    setNewRule({
      sourcePositionId: "",
      targetPositionId: "",
      trigger: "close",
      action: "close",
      isActive: true,
    });
    setIsCreating(false);
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'close': return '決済時';
      case 'profit_target': return '利益目標達成時';
      case 'loss_limit': return '損失限界時';
      default: return trigger;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'close': return '決済';
      case 'trail': return 'トレール開始';
      case 'modify': return '注文変更';
      default: return action;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>関連ポジション連動設定</CardTitle>
          <Button 
            onClick={() => setIsCreating(true)} 
            disabled={isCreating}
            size="sm"
          >
            新規ルール作成
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 新規ルール作成フォーム */}
        {isCreating && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">新規連動ルール</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="source-position">トリガーポジション</Label>
                  <Select
                    value={newRule.sourcePositionId}
                    onValueChange={(value: string) => 
                      setNewRule({ ...newRule, sourcePositionId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ポジションを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {getPositionLabel(position)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="target-position">対象ポジション</Label>
                  <Select
                    value={newRule.targetPositionId}
                    onValueChange={(value: string) => 
                      setNewRule({ ...newRule, targetPositionId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ポジションを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions
                        .filter(p => p.id !== newRule.sourcePositionId)
                        .map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {getPositionLabel(position)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trigger">トリガー条件</Label>
                  <Select
                    value={newRule.trigger}
                    onValueChange={(value: string) => 
                      setNewRule({ ...newRule, trigger: value as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="close">決済時</SelectItem>
                      <SelectItem value="profit_target">利益目標達成時</SelectItem>
                      <SelectItem value="loss_limit">損失限界時</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="action">実行アクション</Label>
                  <Select
                    value={newRule.action}
                    onValueChange={(value: string) => 
                      setNewRule({ ...newRule, action: value as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="close">決済</SelectItem>
                      <SelectItem value="trail">トレール開始</SelectItem>
                      <SelectItem value="modify">注文変更</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newRule.action === 'trail' && (
                <div className="space-y-2">
                  <Label>トレール設定</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="trail-distance">トレール距離</Label>
                      <Input
                        id="trail-distance"
                        type="number"
                        placeholder="10"
                        value={newRule.settings?.trailDistance || ""}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            settings: {
                              ...newRule.settings,
                              enabled: true,
                              trailDistance: parseInt(e.target.value) || 0,
                              stepSize: newRule.settings?.stepSize || 1,
                              startTrigger: newRule.settings?.startTrigger || 0,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="step-size">ステップサイズ</Label>
                      <Input
                        id="step-size"
                        type="number"
                        placeholder="1"
                        value={newRule.settings?.stepSize || ""}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            settings: {
                              ...newRule.settings,
                              enabled: true,
                              trailDistance: newRule.settings?.trailDistance || 0,
                              stepSize: parseInt(e.target.value) || 1,
                              startTrigger: newRule.settings?.startTrigger || 0,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="start-trigger">開始トリガー</Label>
                      <Input
                        id="start-trigger"
                        type="number"
                        placeholder="5"
                        value={newRule.settings?.startTrigger || ""}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            settings: {
                              ...newRule.settings,
                              enabled: true,
                              trailDistance: newRule.settings?.trailDistance || 0,
                              stepSize: newRule.settings?.stepSize || 1,
                              startTrigger: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button onClick={handleCreateRule} className="flex-1">
                  ルール作成
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreating(false)}
                  className="flex-1"
                >
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 既存ルール一覧 */}
        <div className="space-y-3">
          {existingRules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              連動ルールが設定されていません
            </div>
          ) : (
            existingRules.map((rule) => {
              const sourcePosition = positions.find(p => p.id === rule.sourcePositionId);
              const targetPosition = positions.find(p => p.id === rule.targetPositionId);

              return (
                <Card key={rule.id} className={rule.isActive ? '' : 'opacity-50'}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? '有効' : '無効'}
                          </Badge>
                          <span className="text-sm font-medium">
                            {getTriggerLabel(rule.trigger)} → {getActionLabel(rule.action)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">トリガーポジション</div>
                            <div className="font-medium">
                              {sourcePosition ? getPositionLabel(sourcePosition) : 'ポジション不明'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">対象ポジション</div>
                            <div className="font-medium">
                              {targetPosition ? getPositionLabel(targetPosition) : 'ポジション不明'}
                            </div>
                          </div>
                        </div>

                        {rule.action === 'trail' && rule.settings && (
                          <div className="mt-2 text-xs text-gray-500">
                            トレール設定: 距離{rule.settings.trailDistance}pips, 
                            ステップ{rule.settings.stepSize}pips, 
                            開始{rule.settings.startTrigger}pips
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <Checkbox
                            checked={rule.isActive}
                            onCheckedChange={(checked: boolean) => 
                              onRuleUpdate(rule.id, { isActive: checked })
                            }
                          />
                          <Label className="text-xs">有効</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRuleDelete(rule.id)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {existingRules.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="text-sm text-gray-500">
              <p>• 連動ルールはリアルタイムで監視され、条件が満たされた際に自動実行されます</p>
              <p>• 無効化されたルールは実行されませんが、設定は保持されます</p>
              <p>• ポジションが決済された場合、関連するルールも自動的に削除されます</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
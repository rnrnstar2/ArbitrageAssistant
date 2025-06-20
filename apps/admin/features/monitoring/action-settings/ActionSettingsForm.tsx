"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  PlusIcon, 
  TrashIcon, 
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from "lucide-react";

import { 
  Position, 
  ActionSettings, 
  ActionStep, 
  TriggerCondition,
  ACTION_TYPE_CONFIGS,
  TRIGGER_TYPE_CONFIGS,
  ValidationResult
} from "./types";

interface ActionSettingsFormProps {
  position: Position;
  initialSettings?: ActionSettings;
  onSave: (settings: ActionSettings) => void;
  onCancel: () => void;
  className?: string;
}

export function ActionSettingsForm({
  position,
  initialSettings,
  onSave,
  onCancel,
  className = ""
}: ActionSettingsFormProps) {
  const [trigger, setTrigger] = useState<TriggerCondition>(
    initialSettings?.trigger || {
      type: 'margin_level',
      threshold: 150,
      condition: 'below'
    }
  );
  
  const [actions, setActions] = useState<ActionStep[]>(
    initialSettings?.actions || [
      {
        type: 'notify',
        parameters: { message: '証拠金維持率が低下しています' },
        priority: 1
      }
    ]
  );
  
  const [isActive, setIsActive] = useState(initialSettings?.isActive ?? true);
  const [executionMode, setExecutionMode] = useState<'sequential' | 'parallel'>(
    initialSettings?.executionMode || 'sequential'
  );
  
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    validateSettings();
  }, [trigger, actions, isActive, executionMode]);

  const validateSettings = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // トリガー検証
    if (trigger.threshold <= 0) {
      errors.push("閾値は0より大きい値を設定してください");
    }

    if (trigger.type === 'margin_level' && trigger.threshold < 100) {
      warnings.push("証拠金維持率100%未満の設定は非常に危険です");
    }

    if (trigger.type === 'loss_amount' && trigger.threshold > 0) {
      errors.push("損失額は負の値を設定してください");
    }

    // アクション検証
    if (actions.length === 0) {
      errors.push("最低1つのアクションを設定してください");
    }

    actions.forEach((action, index) => {
      const config = ACTION_TYPE_CONFIGS[action.type];
      config.requiredParams.forEach(param => {
        if (!action.parameters[param]) {
          errors.push(`アクション${index + 1}: ${param}は必須項目です`);
        }
      });

      if (action.type === 'close_position' && action.parameters.closeType === 'limit' && !action.parameters.targetPrice) {
        errors.push(`アクション${index + 1}: 指値決済の場合は目標価格が必要です`);
      }
    });

    // 優先度の重複チェック
    const priorities = actions.map(a => a.priority);
    const duplicates = priorities.filter((p, i) => priorities.indexOf(p) !== i);
    if (duplicates.length > 0) {
      warnings.push("優先度に重複があります。同じ優先度のアクションは同時実行されます");
    }

    setValidation({ 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    });
  };

  const addAction = () => {
    const newAction: ActionStep = {
      type: 'notify',
      parameters: { message: '' },
      priority: Math.max(...actions.map(a => a.priority), 0) + 1
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (index: number, updates: Partial<ActionStep>) => {
    const updatedActions = [...actions];
    updatedActions[index] = { ...updatedActions[index], ...updates };
    setActions(updatedActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    const newActions = [...actions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newActions.length) {
      [newActions[index], newActions[targetIndex]] = [newActions[targetIndex], newActions[index]];
      setActions(newActions);
    }
  };

  const handleSave = () => {
    if (!validation.isValid) {
      toast({
        title: "設定エラー",
        description: "設定に問題があります。エラーを修正してください。",
        variant: "destructive"
      });
      return;
    }

    const settings: ActionSettings = {
      positionId: position.id,
      trigger,
      actions,
      isActive,
      executionMode,
      updatedAt: new Date()
    };

    onSave(settings);
  };

  const getImpactPreview = () => {
    if (trigger.type === 'margin_level') {
      const currentMargin = position.marginLevel || 300;
      const distance = Math.abs(currentMargin - trigger.threshold);
      if (trigger.condition === 'below' && currentMargin > trigger.threshold) {
        return `現在の証拠金維持率(${currentMargin}%)から${distance}%下落時に発動`;
      } else if (trigger.condition === 'above' && currentMargin < trigger.threshold) {
        return `現在の証拠金維持率(${currentMargin}%)から${distance}%上昇時に発動`;
      } else {
        return "現在の条件でトリガーが発動する可能性があります";
      }
    }
    
    if (trigger.type === 'profit_target') {
      const distance = Math.abs(position.profit - trigger.threshold);
      return `現在の損益(${position.profit.toFixed(2)})から${distance.toFixed(2)}ドル${trigger.condition === 'above' ? '利益増加' : '変動'}時に発動`;
    }

    return "設定されたトリガー条件で発動します";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>アクション設定 - {position.symbol}</CardTitle>
        <div className="text-sm text-gray-600">
          {position.type === 'buy' ? '買い' : '売り'} {position.lots} lots | 
          現在価格: {position.currentPrice} | 
          損益: <span className={position.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
            {position.profit >= 0 ? '+' : ''}${position.profit.toFixed(2)}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 基本設定 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">基本設定</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked as boolean)}
              />
              <Label htmlFor="is-active">アクティブ</Label>
            </div>
          </div>

          <div>
            <Label htmlFor="execution-mode">実行モード</Label>
            <Select value={executionMode} onValueChange={(value) => setExecutionMode(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">順次実行</SelectItem>
                <SelectItem value="parallel">並列実行</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              順次実行: アクションを優先度順に実行 | 並列実行: 全アクションを同時実行
            </p>
          </div>
        </div>

        <Separator />

        {/* トリガー設定 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">トリガー条件</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="trigger-type">トリガータイプ</Label>
              <Select 
                value={trigger.type} 
                onValueChange={(value) => setTrigger(prev => ({ ...prev, type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_TYPE_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="trigger-condition">条件</Label>
              <Select 
                value={trigger.condition} 
                onValueChange={(value) => setTrigger(prev => ({ ...prev, condition: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">以上</SelectItem>
                  <SelectItem value="below">以下</SelectItem>
                  <SelectItem value="equals">一致</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="trigger-threshold">
                閾値 ({TRIGGER_TYPE_CONFIGS[trigger.type]?.unit})
              </Label>
              <Input
                id="trigger-threshold"
                type="number"
                value={trigger.threshold}
                onChange={(e) => setTrigger(prev => ({ 
                  ...prev, 
                  threshold: parseFloat(e.target.value) || 0 
                }))}
                min={TRIGGER_TYPE_CONFIGS[trigger.type]?.min}
                max={TRIGGER_TYPE_CONFIGS[trigger.type]?.max}
              />
            </div>
          </div>

          {trigger.type === 'time_based' && (
            <div>
              <Label htmlFor="timeframe">時間単位</Label>
              <Select 
                value={trigger.timeframe || 'hours'} 
                onValueChange={(value) => setTrigger(prev => ({ ...prev, timeframe: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">分</SelectItem>
                  <SelectItem value="hours">時間</SelectItem>
                  <SelectItem value="days">日</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <InfoIcon className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">影響予測</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">{getImpactPreview()}</p>
          </div>
        </div>

        <Separator />

        {/* アクション設定 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">実行アクション</h3>
            <Button variant="outline" size="sm" onClick={addAction}>
              <PlusIcon className="h-4 w-4 mr-2" />
              アクション追加
            </Button>
          </div>

          <div className="space-y-3">
            {actions.map((action, index) => (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">優先度 {action.priority}</Badge>
                      <span className="text-sm font-medium">アクション {index + 1}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveAction(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUpIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveAction(index, 'down')}
                        disabled={index === actions.length - 1}
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAction(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label>アクションタイプ</Label>
                      <Select 
                        value={action.type} 
                        onValueChange={(value) => updateAction(index, { 
                          type: value as any,
                          parameters: {} // Reset parameters when type changes
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACTION_TYPE_CONFIGS).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>優先度</Label>
                      <Input
                        type="number"
                        min="1"
                        value={action.priority}
                        onChange={(e) => updateAction(index, { 
                          priority: parseInt(e.target.value) || 1 
                        })}
                      />
                    </div>
                  </div>

                  {/* Action-specific parameters */}
                  <div className="space-y-3">
                    {action.type === 'close_position' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>決済タイプ</Label>
                            <Select 
                              value={action.parameters.closeType || 'market'} 
                              onValueChange={(value) => updateAction(index, {
                                parameters: { ...action.parameters, closeType: value }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="market">成行</SelectItem>
                                <SelectItem value="limit">指値</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {action.parameters.closeType === 'limit' && (
                            <div>
                              <Label>目標価格</Label>
                              <Input
                                type="number"
                                step="0.00001"
                                value={action.parameters.targetPrice || ''}
                                onChange={(e) => updateAction(index, {
                                  parameters: { 
                                    ...action.parameters, 
                                    targetPrice: parseFloat(e.target.value) || 0 
                                  }
                                })}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {action.type === 'notify' && (
                      <div>
                        <Label>通知メッセージ</Label>
                        <Textarea
                          value={action.parameters.message || ''}
                          onChange={(e) => updateAction(index, {
                            parameters: { ...action.parameters, message: e.target.value }
                          })}
                          placeholder="通知メッセージを入力..."
                        />
                      </div>
                    )}

                    {action.type === 'trail_stop' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>トレール幅 (pips)</Label>
                          <Input
                            type="number"
                            min="1"
                            value={action.parameters.trailPips || ''}
                            onChange={(e) => updateAction(index, {
                              parameters: { 
                                ...action.parameters, 
                                trailPips: parseInt(e.target.value) || 0 
                              }
                            })}
                          />
                        </div>
                        <div>
                          <Label>開始pips</Label>
                          <Input
                            type="number"
                            min="0"
                            value={action.parameters.startPips || ''}
                            onChange={(e) => updateAction(index, {
                              parameters: { 
                                ...action.parameters, 
                                startPips: parseInt(e.target.value) || 0 
                              }
                            })}
                          />
                        </div>
                      </div>
                    )}

                    {action.type === 'open_hedge' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>ロット数</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={action.parameters.lots || ''}
                            onChange={(e) => updateAction(index, {
                              parameters: { 
                                ...action.parameters, 
                                lots: parseFloat(e.target.value) || 0 
                              }
                            })}
                          />
                        </div>
                        <div>
                          <Label>目標価格（オプション）</Label>
                          <Input
                            type="number"
                            step="0.00001"
                            value={action.parameters.targetPrice || ''}
                            onChange={(e) => updateAction(index, {
                              parameters: { 
                                ...action.parameters, 
                                targetPrice: parseFloat(e.target.value) || undefined 
                              }
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    {ACTION_TYPE_CONFIGS[action.type]?.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* バリデーション結果 */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <>
            <Separator />
            <div className="space-y-2">
              {validation.errors.length > 0 && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangleIcon className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">エラー</span>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validation.warnings.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">警告</span>
                  </div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {/* プレビュー */}
        {showPreview && (
          <>
            <Separator />
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">実行プレビュー</h4>
              <div className="text-sm space-y-1">
                <div><strong>トリガー:</strong> {TRIGGER_TYPE_CONFIGS[trigger.type]?.label} {trigger.threshold}{TRIGGER_TYPE_CONFIGS[trigger.type]?.unit} {trigger.condition === 'above' ? '以上' : trigger.condition === 'below' ? '以下' : '一致'}</div>
                <div><strong>実行モード:</strong> {executionMode === 'sequential' ? '順次実行' : '並列実行'}</div>
                <div><strong>アクション数:</strong> {actions.length}件</div>
                <div className="mt-2">
                  <strong>実行順序:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    {actions
                      .sort((a, b) => a.priority - b.priority)
                      .map((action, i) => (
                        <li key={i}>
                          {ACTION_TYPE_CONFIGS[action.type]?.label}
                          {action.parameters.message && ` (${action.parameters.message})`}
                        </li>
                      ))}
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ボタン */}
        <div className="flex space-x-2">
          <Button 
            onClick={handleSave} 
            disabled={!validation.isValid}
            className="flex-1"
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            設定を保存
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? '非表示' : 'プレビュー'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
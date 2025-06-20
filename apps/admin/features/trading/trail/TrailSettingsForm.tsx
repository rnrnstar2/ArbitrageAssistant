"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Badge } from "@repo/ui/components/ui/badge";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  TrendingUpIcon, 
  PercentIcon, 
  BarChart3Icon,
  PlayIcon,
  SaveIcon,
  RefreshCwIcon
} from "lucide-react";
import { TrailFormData, TrailType, StartConditionType, TrailSettings } from "./types";

interface TrailSettingsFormProps {
  initialSettings?: TrailSettings;
  onSave?: (settings: TrailFormData) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}

export function TrailSettingsForm({ 
  initialSettings, 
  onSave, 
  onCancel,
  disabled = false 
}: TrailSettingsFormProps) {
  const [formData, setFormData] = useState<TrailFormData>({
    type: 'fixed',
    fixedPips: 10,
    percentageAmount: 2.0,
    atrMultiplier: 2.0,
    atrPeriod: 14,
    startCondition: {
      type: 'immediate'
    }
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Load initial settings
  useEffect(() => {
    if (initialSettings) {
      setFormData({
        type: initialSettings.type,
        fixedPips: initialSettings.type === 'fixed' ? initialSettings.trailAmount : 10,
        percentageAmount: initialSettings.type === 'percentage' ? initialSettings.trailAmount : 2.0,
        atrMultiplier: initialSettings.type === 'atr' ? initialSettings.trailAmount : 2.0,
        atrPeriod: 14,
        startCondition: initialSettings.startCondition
      });
    }
  }, [initialSettings]);

  const updateFormData = (updates: Partial<TrailFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
    validateForm({ ...formData, ...updates });
  };

  const validateForm = (data: TrailFormData) => {
    const errors: Record<string, string> = {};

    // Trail amount validation
    switch (data.type) {
      case 'fixed':
        if (!data.fixedPips || data.fixedPips <= 0) {
          errors.fixedPips = 'PIPS値は0より大きい値を入力してください';
        }
        break;
      case 'percentage':
        if (!data.percentageAmount || data.percentageAmount <= 0 || data.percentageAmount > 100) {
          errors.percentageAmount = 'パーセンテージは0-100の範囲で入力してください';
        }
        break;
      case 'atr':
        if (!data.atrMultiplier || data.atrMultiplier <= 0) {
          errors.atrMultiplier = 'ATR倍率は0より大きい値を入力してください';
        }
        if (!data.atrPeriod || data.atrPeriod < 5 || data.atrPeriod > 100) {
          errors.atrPeriod = 'ATR期間は5-100の範囲で入力してください';
        }
        break;
    }

    // Start condition validation
    if (data.startCondition.type !== 'immediate' && !data.startCondition.value) {
      errors.startConditionValue = '開始条件の値を入力してください';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm(formData)) {
      toast({
        title: "入力エラー",
        description: "入力内容を確認してください",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave?.(formData);
      setHasChanges(false);
      toast({
        title: "設定保存",
        description: "トレール設定を保存しました",
      });
    } catch (error) {
      console.error("Error saving trail settings:", error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'fixed',
      fixedPips: 10,
      percentageAmount: 2.0,
      atrMultiplier: 2.0,
      atrPeriod: 14,
      startCondition: {
        type: 'immediate'
      }
    });
    setHasChanges(false);
    setValidationErrors({});
  };

  const getCurrentTrailAmount = () => {
    switch (formData.type) {
      case 'fixed':
        return `${formData.fixedPips || 0} pips`;
      case 'percentage':
        return `${formData.percentageAmount || 0}%`;
      case 'atr':
        return `ATR × ${formData.atrMultiplier || 0}`;
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUpIcon className="h-5 w-5" />
            <span>トレール設定</span>
            {hasChanges && (
              <Badge variant="secondary">未保存</Badge>
            )}
          </div>
          <div className="text-sm text-gray-500">
            現在値: {getCurrentTrailAmount()}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs 
          value={formData.type} 
          onValueChange={(value) => updateFormData({ type: value as TrailType })}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fixed" className="flex items-center space-x-1">
              <BarChart3Icon className="h-4 w-4" />
              <span>固定PIPS</span>
            </TabsTrigger>
            <TabsTrigger value="percentage" className="flex items-center space-x-1">
              <PercentIcon className="h-4 w-4" />
              <span>パーセンテージ</span>
            </TabsTrigger>
            <TabsTrigger value="atr" className="flex items-center space-x-1">
              <TrendingUpIcon className="h-4 w-4" />
              <span>ATRベース</span>
            </TabsTrigger>
          </TabsList>

          {/* 固定PIPS設定 */}
          <TabsContent value="fixed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">固定PIPS設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fixedPips">トレール幅 (PIPS)</Label>
                  <Input
                    id="fixedPips"
                    type="number"
                    min="1"
                    step="0.1"
                    value={formData.fixedPips || ''}
                    onChange={(e) => updateFormData({ fixedPips: parseFloat(e.target.value) || 0 })}
                    disabled={disabled}
                    className={validationErrors.fixedPips ? 'border-red-500' : ''}
                  />
                  {validationErrors.fixedPips && (
                    <div className="text-sm text-red-500">{validationErrors.fixedPips}</div>
                  )}
                  <div className="text-sm text-gray-500">
                    価格が有利な方向に動いたときに、この幅だけ損切りラインを追跡します
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* パーセンテージ設定 */}
          <TabsContent value="percentage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">パーセンテージ設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="percentageAmount">トレール幅 (%)</Label>
                  <Input
                    id="percentageAmount"
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={formData.percentageAmount || ''}
                    onChange={(e) => updateFormData({ percentageAmount: parseFloat(e.target.value) || 0 })}
                    disabled={disabled}
                    className={validationErrors.percentageAmount ? 'border-red-500' : ''}
                  />
                  {validationErrors.percentageAmount && (
                    <div className="text-sm text-red-500">{validationErrors.percentageAmount}</div>
                  )}
                  <div className="text-sm text-gray-500">
                    現在の利益に対する割合でトレール幅を設定します
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ATRベース設定 */}
          <TabsContent value="atr" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ATRベース設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="atrMultiplier">ATR倍率</Label>
                    <Input
                      id="atrMultiplier"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={formData.atrMultiplier || ''}
                      onChange={(e) => updateFormData({ atrMultiplier: parseFloat(e.target.value) || 0 })}
                      disabled={disabled}
                      className={validationErrors.atrMultiplier ? 'border-red-500' : ''}
                    />
                    {validationErrors.atrMultiplier && (
                      <div className="text-sm text-red-500">{validationErrors.atrMultiplier}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="atrPeriod">ATR期間</Label>
                    <Input
                      id="atrPeriod"
                      type="number"
                      min="5"
                      max="100"
                      value={formData.atrPeriod || ''}
                      onChange={(e) => updateFormData({ atrPeriod: parseInt(e.target.value) || 14 })}
                      disabled={disabled}
                      className={validationErrors.atrPeriod ? 'border-red-500' : ''}
                    />
                    {validationErrors.atrPeriod && (
                      <div className="text-sm text-red-500">{validationErrors.atrPeriod}</div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Average True Range (ATR) を基準にした動的なトレール幅設定
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 開始条件設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-base">
              <PlayIcon className="h-4 w-4" />
              <span>開始条件</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startConditionType">開始条件タイプ</Label>
              <Select
                value={formData.startCondition.type}
                onValueChange={(value: StartConditionType) => 
                  updateFormData({ 
                    startCondition: { 
                      type: value, 
                      value: value === 'immediate' ? undefined : formData.startCondition.value 
                    } 
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">即座に開始</SelectItem>
                  <SelectItem value="profit_threshold">利益閾値で開始</SelectItem>
                  <SelectItem value="price_level">価格レベルで開始</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.startCondition.type !== 'immediate' && (
              <div className="space-y-2">
                <Label htmlFor="startConditionValue">
                  {formData.startCondition.type === 'profit_threshold' ? '利益閾値 ($)' : '価格レベル'}
                </Label>
                <Input
                  id="startConditionValue"
                  type="number"
                  step="0.01"
                  value={formData.startCondition.value || ''}
                  onChange={(e) => updateFormData({ 
                    startCondition: { 
                      ...formData.startCondition, 
                      value: parseFloat(e.target.value) || 0 
                    } 
                  })}
                  disabled={disabled}
                  className={validationErrors.startConditionValue ? 'border-red-500' : ''}
                />
                {validationErrors.startConditionValue && (
                  <div className="text-sm text-red-500">{validationErrors.startConditionValue}</div>
                )}
                <div className="text-sm text-gray-500">
                  {formData.startCondition.type === 'profit_threshold' 
                    ? 'この利益額に達したらトレールを開始します'
                    : 'この価格レベルに達したらトレールを開始します'
                  }
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* プレビュー */}
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-base">設定プレビュー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>トレールタイプ:</span>
                <span className="font-medium">
                  {formData.type === 'fixed' && '固定PIPS'}
                  {formData.type === 'percentage' && 'パーセンテージ'}
                  {formData.type === 'atr' && 'ATRベース'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>トレール幅:</span>
                <span className="font-medium">{getCurrentTrailAmount()}</span>
              </div>
              <div className="flex justify-between">
                <span>開始条件:</span>
                <span className="font-medium">
                  {formData.startCondition.type === 'immediate' && '即座に開始'}
                  {formData.startCondition.type === 'profit_threshold' && 
                    `利益 $${formData.startCondition.value || 0} で開始`}
                  {formData.startCondition.type === 'price_level' && 
                    `価格 ${formData.startCondition.value || 0} で開始`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* アクションボタン */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={resetForm}
            disabled={disabled || !hasChanges}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            リセット
          </Button>
          
          <div className="flex space-x-2">
            {onCancel && (
              <Button 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
            )}
            <Button 
              onClick={handleSave}
              disabled={disabled || !hasChanges || isSubmitting || Object.keys(validationErrors).length > 0}
            >
              <SaveIcon className="h-4 w-4 mr-2" />
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
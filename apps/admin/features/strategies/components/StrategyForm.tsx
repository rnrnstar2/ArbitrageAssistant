'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { 
  Strategy, 
  EntryStrategy, 
  ExitStrategy,
  StrategyType,
  PositionSpec,
  CreateEntryStrategyInput,
  CreateExitStrategyInput
} from '@repo/shared-types';
import { useStrategyActions } from '../hooks/useStrategyActions';
import { useAccounts } from '../../trading/hooks/useAccounts';
import { usePositions } from '../../positions/hooks/usePositions';

// Position spec schema
const positionSpecSchema = z.object({
  symbol: z.string().min(1, 'シンボルは必須です'),
  volume: z.number().min(0.01, 'ボリュームは0.01以上で入力してください'),
  direction: z.enum(['BUY', 'SELL']),
  trailWidth: z.number().min(1, 'トレール幅は1以上で入力してください').optional(),
});

// Entry strategy schema
const entryStrategySchema = z.object({
  type: z.literal('ENTRY'),
  name: z.string().min(1, '戦略名は必須です'),
  targetAccounts: z.array(z.string()).min(1, '対象口座を選択してください'),
  positions: z.array(positionSpecSchema).min(1, '少なくとも1つのポジションを追加してください'),
  defaultTrailWidth: z.number().min(1, 'デフォルトトレール幅は1以上で入力してください'),
});

// Exit strategy schema
const exitStrategySchema = z.object({
  type: z.literal('EXIT'),
  name: z.string().min(1, '戦略名は必須です'),
  selectedPositions: z.array(z.string()).min(1, '決済対象のポジションを選択してください'),
  primaryPositionId: z.string().min(1, '主要ポジションを選択してください'),
  trailWidth: z.number().min(1, 'トレール幅は1以上で入力してください'),
});

// Union schema for both strategy types
const strategySchema = z.discriminatedUnion('type', [
  entryStrategySchema,
  exitStrategySchema,
]);

type StrategyFormData = z.infer<typeof strategySchema>;

interface StrategyFormProps {
  open: boolean;
  strategy?: Strategy | null;
  onClose: () => void;
  onSubmit: () => void;
}

export function StrategyForm({ open, strategy, onClose, onSubmit }: StrategyFormProps) {
  const { createStrategy, updateStrategy, loading } = useStrategyActions();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { positions, loading: positionsLoading } = usePositions();
  const [strategyType, setStrategyType] = useState<StrategyType>('ENTRY');
  
  const isEditing = !!strategy;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm<StrategyFormData>({
    resolver: zodResolver(strategySchema),
    defaultValues: {
      type: 'ENTRY',
      name: '',
      targetAccounts: [],
      positions: [{ symbol: 'USDJPY', volume: 0.1, direction: 'BUY' }],
      defaultTrailWidth: 50,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'positions' as any, // Type assertion needed for discriminated union
  });

  const watchedType = watch('type');

  useEffect(() => {
    setStrategyType(watchedType);
  }, [watchedType]);

  useEffect(() => {
    if (strategy) {
      if (strategy.type === 'ENTRY') {
        const entryStrategy = strategy as EntryStrategy;
        reset({
          type: 'ENTRY',
          name: entryStrategy.name,
          targetAccounts: entryStrategy.targetAccounts,
          positions: entryStrategy.positions,
          defaultTrailWidth: entryStrategy.defaultTrailWidth,
        });
      } else if (strategy.type === 'EXIT') {
        const exitStrategy = strategy as ExitStrategy;
        reset({
          type: 'EXIT',
          name: exitStrategy.name,
          selectedPositions: exitStrategy.selectedPositions,
          primaryPositionId: exitStrategy.primaryPositionId,
          trailWidth: exitStrategy.trailWidth,
        });
      }
    } else {
      reset({
        type: 'ENTRY',
        name: '',
        targetAccounts: [],
        positions: [{ symbol: 'USDJPY', volume: 0.1, direction: 'BUY' }],
        defaultTrailWidth: 50,
      });
    }
  }, [strategy, reset]);

  const onFormSubmit = async (data: StrategyFormData) => {
    try {
      if (isEditing && strategy) {
        // Update existing strategy
        await updateStrategy(strategy.strategyId, data as any);
      } else {
        // Create new strategy
        if (data.type === 'ENTRY') {
          const entryData: CreateEntryStrategyInput = {
            name: data.name,
            targetAccounts: data.targetAccounts,
            positions: data.positions,
            defaultTrailWidth: data.defaultTrailWidth,
          };
          await createStrategy(entryData);
        } else {
          const exitData: CreateExitStrategyInput = {
            name: data.name,
            selectedPositions: data.selectedPositions,
            primaryPositionId: data.primaryPositionId,
            trailWidth: data.trailWidth,
          };
          await createStrategy(exitData);
        }
      }
      onSubmit();
    } catch (error) {
      console.error('Failed to save strategy:', error);
      alert('戦略の保存に失敗しました');
    }
  };

  const symbolOptions = [
    { value: 'USDJPY', label: 'USD/JPY' },
    { value: 'EURJPY', label: 'EUR/JPY' },
    { value: 'GBPJPY', label: 'GBP/JPY' },
    { value: 'EURUSD', label: 'EUR/USD' },
    { value: 'GBPUSD', label: 'GBP/USD' },
    { value: 'AUDJPY', label: 'AUD/JPY' },
  ];

  const availablePositions = positions?.filter(p => p.status === 'OPEN') || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '戦略編集' : '新規戦略作成'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* 戦略タイプ選択 */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>戦略タイプ *</Label>
              <Tabs value={strategyType} onValueChange={(value) => {
                setStrategyType(value as StrategyType);
                setValue('type', value as StrategyType);
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ENTRY">エントリー戦略</TabsTrigger>
                  <TabsTrigger value="EXIT">決済戦略</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* 戦略名 */}
          <div className="space-y-2">
            <Label htmlFor="name">戦略名 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="例: USD/JPY アービトラージ戦略"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* エントリー戦略フォーム */}
          {strategyType === 'ENTRY' && (
            <div className="space-y-6">
              {/* 対象口座選択 */}
              <div className="space-y-2">
                <Label>対象口座 *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {accountsLoading ? (
                    <p>読み込み中...</p>
                  ) : (
                    accounts?.map((account) => (
                      <label key={account.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          value={account.id}
                          {...register('targetAccounts' as any)}
                        />
                        <span>{account.name || account.id}</span>
                      </label>
                    ))
                  )}
                </div>
                {errors.targetAccounts && (
                  <p className="text-sm text-red-500">{errors.targetAccounts.message}</p>
                )}
              </div>

              {/* デフォルトトレール幅 */}
              <div className="space-y-2">
                <Label htmlFor="defaultTrailWidth">デフォルトトレール幅 (pips) *</Label>
                <Input
                  id="defaultTrailWidth"
                  type="number"
                  step="1"
                  min="1"
                  {...register('defaultTrailWidth' as any, { valueAsNumber: true })}
                  placeholder="50"
                />
                {errors.defaultTrailWidth && (
                  <p className="text-sm text-red-500">{errors.defaultTrailWidth.message}</p>
                )}
                <p className="text-sm text-gray-500">
                  全ポジションに適用されるデフォルトのトレール幅
                </p>
              </div>

              {/* ポジション設定 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>ポジション設定 *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ symbol: 'USDJPY', volume: 0.1, direction: 'BUY' })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    追加
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">ポジション {index + 1}</CardTitle>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        {/* シンボル */}
                        <div className="space-y-2">
                          <Label>シンボル</Label>
                          <Select
                            value={watch(`positions.${index}.symbol` as any)}
                            onValueChange={(value) => setValue(`positions.${index}.symbol` as any, value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {symbolOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* ボリューム */}
                        <div className="space-y-2">
                          <Label>ボリューム</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            {...register(`positions.${index}.volume` as any, { valueAsNumber: true })}
                          />
                        </div>

                        {/* 方向 */}
                        <div className="space-y-2">
                          <Label>方向</Label>
                          <Select
                            value={watch(`positions.${index}.direction` as any)}
                            onValueChange={(value) => setValue(`positions.${index}.direction` as any, value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BUY">買い</SelectItem>
                              <SelectItem value="SELL">売り</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* 個別トレール幅（オプション） */}
                      <div className="space-y-2">
                        <Label>個別トレール幅 (pips)（オプション）</Label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          {...register(`positions.${index}.trailWidth` as any, { valueAsNumber: true })}
                          placeholder="デフォルトを使用"
                        />
                        <p className="text-sm text-gray-500">
                          未指定の場合はデフォルトトレール幅を使用
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {errors.positions && (
                  <p className="text-sm text-red-500">{errors.positions.message}</p>
                )}
              </div>
            </div>
          )}

          {/* 決済戦略フォーム */}
          {strategyType === 'EXIT' && (
            <div className="space-y-6">
              {/* 既存ポジション選択 */}
              <div className="space-y-2">
                <Label>決済対象ポジション *</Label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {positionsLoading ? (
                    <p>読み込み中...</p>
                  ) : availablePositions.length === 0 ? (
                    <p className="text-sm text-gray-500">決済可能なポジションがありません</p>
                  ) : (
                    availablePositions.map((position) => (
                      <label key={position.id} className="flex items-center space-x-2 p-2 border rounded">
                        <input
                          type="checkbox"
                          value={position.id}
                          {...register('selectedPositions' as any)}
                        />
                        <span className="text-sm">
                          {position.symbol} {position.volume} {position.direction === 'BUY' ? '買' : '売'} 
                          (損益: {position.profit?.toFixed(2)} {position.currency})
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {errors.selectedPositions && (
                  <p className="text-sm text-red-500">{errors.selectedPositions.message}</p>
                )}
              </div>

              {/* 主要ポジション */}
              <div className="space-y-2">
                <Label htmlFor="primaryPositionId">主要ポジション *</Label>
                <Select
                  value={watch('primaryPositionId' as any)}
                  onValueChange={(value) => setValue('primaryPositionId' as any, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="主要ポジションを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePositions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.symbol} {position.volume} {position.direction === 'BUY' ? '買' : '売'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.primaryPositionId && (
                  <p className="text-sm text-red-500">{errors.primaryPositionId.message}</p>
                )}
                <p className="text-sm text-gray-500">
                  戦略の基準となるメインポジション
                </p>
              </div>

              {/* トレール幅 */}
              <div className="space-y-2">
                <Label htmlFor="trailWidth">トレール幅 (pips) *</Label>
                <Input
                  id="trailWidth"
                  type="number"
                  step="1"
                  min="1"
                  {...register('trailWidth' as any, { valueAsNumber: true })}
                  placeholder="50"
                />
                {errors.trailWidth && (
                  <p className="text-sm text-red-500">{errors.trailWidth.message}</p>
                )}
                <p className="text-sm text-gray-500">
                  決済戦略で使用するトレール幅
                </p>
              </div>
            </div>
          )}

          {/* ボタン */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading || accountsLoading || positionsLoading}>
              {loading ? '保存中...' : isEditing ? '更新' : '作成'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
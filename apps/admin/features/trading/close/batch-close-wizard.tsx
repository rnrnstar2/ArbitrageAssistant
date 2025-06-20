"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Input } from "@repo/ui/components/ui/input";
import { Progress } from "@repo/ui/components/ui/progress";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { useToast } from "@repo/ui/hooks/use-toast";
import { Position } from "../../monitoring/types";
import { BatchCloseInput, BatchCloseResult, CloseResult } from "./types";

interface BatchCloseWizardProps {
  positions: Position[];
  selectedPositionIds: string[];
  onBatchClose: (input: BatchCloseInput) => Promise<BatchCloseResult>;
  onClose: () => void;
}

type WizardStep = 'confirm' | 'settings' | 'executing' | 'results';

export function BatchCloseWizard({ 
  positions, 
  selectedPositionIds, 
  onBatchClose, 
  onClose 
}: BatchCloseWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('confirm');
  const [batchSettings, setBatchSettings] = useState<BatchCloseInput>({
    positionIds: selectedPositionIds,
    closeType: 'market',
    priority: 'normal',
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [results, setResults] = useState<BatchCloseResult | null>(null);
  const [trailEnabled, setTrailEnabled] = useState(false);
  const { toast } = useToast();

  const selectedPositions = positions.filter(p => selectedPositionIds.includes(p.id));
  
  const totalProfit = selectedPositions.reduce((sum, p) => sum + p.profit, 0);
  const totalLots = selectedPositions.reduce((sum, p) => sum + p.lots, 0);
  
  const handleNext = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('settings');
    } else if (currentStep === 'settings') {
      handleExecute();
    }
  };

  const handleExecute = async () => {
    setCurrentStep('executing');
    setIsExecuting(true);
    setExecutionProgress(0);

    try {
      // プログレスバーのシミュレーション
      const progressInterval = setInterval(() => {
        setExecutionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await onBatchClose({
        ...batchSettings,
        trailSettings: trailEnabled ? batchSettings.trailSettings : undefined,
      });

      clearInterval(progressInterval);
      setExecutionProgress(100);
      setResults(result);
      setCurrentStep('results');

      toast({
        title: "一括決済完了",
        description: `${result.successful}/${result.totalRequested} 件の決済が完了しました`,
      });
    } catch (error) {
      console.error("Batch close error:", error);
      toast({
        title: "エラー",
        description: "一括決済に失敗しました",
      });
      setCurrentStep('settings');
    } finally {
      setIsExecuting(false);
    }
  };

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">決済対象ポジション確認</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">対象ポジション数</div>
            <div className="font-medium">{selectedPositions.length} 件</div>
          </div>
          <div>
            <div className="text-gray-500">合計ロット数</div>
            <div className="font-medium">{totalLots.toFixed(2)} lot</div>
          </div>
          <div>
            <div className="text-gray-500">合計損益</div>
            <div className={`font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalProfit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {selectedPositions.map((position) => (
          <div key={position.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex items-center space-x-4">
              <div>
                <div className="font-medium">{position.symbol}</div>
                <div className="text-sm text-gray-500">
                  {position.type === 'buy' ? '買い' : '売り'} {position.lots} lot
                </div>
              </div>
              <div>
                <div className="text-sm">現在価格: {position.currentPrice}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-medium ${position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${position.profit.toFixed(2)}
              </div>
              {position.relatedPositionId && (
                <Badge variant="outline" className="text-xs">両建て</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <Alert>
        <AlertDescription>
          選択したポジションを一括で決済します。決済後は元に戻せませんので、内容をよく確認してください。
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="closeType">決済方法</Label>
        <Select
          value={batchSettings.closeType}
          onValueChange={(value: string) => 
            setBatchSettings({ ...batchSettings, closeType: value as 'market' | 'limit' })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="market">成行決済</SelectItem>
            <SelectItem value="limit">指値決済</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">実行優先度</Label>
        <Select
          value={batchSettings.priority}
          onValueChange={(value: string) => 
            setBatchSettings({ ...batchSettings, priority: value as 'normal' | 'high' })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">通常</SelectItem>
            <SelectItem value="high">高優先度</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="trail-enabled"
            checked={trailEnabled}
            onCheckedChange={(checked: boolean) => setTrailEnabled(checked)}
          />
          <Label htmlFor="trail-enabled">決済後のトレール設定を一括適用</Label>
        </div>
        
        {trailEnabled && (
          <div className="ml-6 space-y-2">
            <div>
              <Label htmlFor="trail-distance">トレール距離</Label>
              <Input
                id="trail-distance"
                type="number"
                min="1"
                placeholder="10"
                value={batchSettings.trailSettings?.trailDistance || ""}
                onChange={(e) =>
                  setBatchSettings({
                    ...batchSettings,
                    trailSettings: {
                      ...batchSettings.trailSettings,
                      enabled: true,
                      trailDistance: parseInt(e.target.value) || 0,
                      stepSize: batchSettings.trailSettings?.stepSize || 1,
                      startTrigger: batchSettings.trailSettings?.startTrigger || 0,
                    },
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      <Alert>
        <AlertDescription>
          {selectedPositions.length} 件のポジションを {batchSettings.closeType === 'market' ? '成行' : '指値'} で決済します。
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderExecutingStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">決済処理中...</h3>
        <p className="text-gray-500 mb-4">
          {selectedPositions.length} 件のポジションを決済しています
        </p>
      </div>

      <Progress value={executionProgress} className="w-full" />
      
      <div className="text-center text-sm text-gray-500">
        {executionProgress}% 完了
      </div>
    </div>
  );

  const renderResultsStep = () => {
    if (!results) return null;

    return (
      <div className="space-y-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">決済結果</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">成功</div>
              <div className="font-medium text-green-600">{results.successful} 件</div>
            </div>
            <div>
              <div className="text-gray-500">失敗</div>
              <div className="font-medium text-red-600">{results.failed} 件</div>
            </div>
            <div>
              <div className="text-gray-500">成功率</div>
              <div className="font-medium">
                {((results.successful / results.totalRequested) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">詳細結果</h4>
          {results.results.map((result: CloseResult) => {
            const position = selectedPositions.find(p => p.id === result.positionId);
            return (
              <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{position?.symbol || result.positionId}</div>
                  <div className="text-sm text-gray-500">
                    {position?.type === 'buy' ? '買い' : '売り'} {position?.lots} lot
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={result.status === 'executed' ? 'default' : 'destructive'}>
                    {result.status === 'executed' ? '成功' : '失敗'}
                  </Badge>
                  {result.status === 'executed' && result.profit && (
                    <div className={`text-sm ${result.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${result.profit.toFixed(2)}
                    </div>
                  )}
                  {result.status === 'failed' && result.error && (
                    <div className="text-sm text-red-600">{result.error}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>一括決済ウィザード</CardTitle>
        <div className="flex items-center space-x-2">
          <Badge variant={currentStep === 'confirm' ? 'default' : 'outline'}>1. 確認</Badge>
          <Badge variant={currentStep === 'settings' ? 'default' : 'outline'}>2. 設定</Badge>
          <Badge variant={currentStep === 'executing' ? 'default' : 'outline'}>3. 実行</Badge>
          <Badge variant={currentStep === 'results' ? 'default' : 'outline'}>4. 結果</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="min-h-[400px]">
          {currentStep === 'confirm' && renderConfirmStep()}
          {currentStep === 'settings' && renderSettingsStep()}
          {currentStep === 'executing' && renderExecutingStep()}
          {currentStep === 'results' && renderResultsStep()}
        </div>

        <Separator className="my-4" />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 'confirm') {
                onClose();
              } else if (currentStep === 'settings') {
                setCurrentStep('confirm');
              }
            }}
            disabled={isExecuting || currentStep === 'executing'}
          >
            {currentStep === 'confirm' ? 'キャンセル' : '戻る'}
          </Button>

          <div className="space-x-2">
            {currentStep === 'results' && (
              <Button onClick={onClose}>完了</Button>
            )}
            {(currentStep === 'confirm' || currentStep === 'settings') && (
              <Button 
                onClick={handleNext}
                disabled={isExecuting}
              >
                {currentStep === 'confirm' ? '次へ' : '実行'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
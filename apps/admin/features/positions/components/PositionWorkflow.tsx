'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { 
  Plus, 
  Settings, 
  Play, 
  CheckCircle, 
  ArrowRight, 
  TrendingUp,
  Clock,
  Target
} from 'lucide-react';
import { Symbol, ExecutionType } from '@repo/shared-types';
import { ActionBuilder } from '../../actions/components/ActionBuilder';
import { WorkflowStatusTracker, WorkflowStep } from './WorkflowStatusTracker';
import { amplifyClient } from '../../../lib/amplify-client';
import { getCurrentUser } from 'aws-amplify/auth';

interface PositionData {
  accountId: string;
  symbol: Symbol;
  volume: number;
  executionType: ExecutionType;
  memo: string;
}

interface TrailData {
  trailWidth: number;
  triggerActions: any[];
}

interface PositionWorkflowProps {
  onComplete?: () => void;
}

export function PositionWorkflow({ onComplete }: PositionWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('create');
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<WorkflowStep, string>>>({});
  
  // Workflow data
  const [positionData, setPositionData] = useState<PositionData>({
    accountId: '',
    symbol: Symbol.USDJPY,
    volume: 1.0,
    executionType: ExecutionType.ENTRY,
    memo: ''
  });
  
  const [trailData, setTrailData] = useState<TrailData>({
    trailWidth: 0,
    triggerActions: []
  });
  
  const [createdPositionId, setCreatedPositionId] = useState<string>('');
  const [showActionBuilder, setShowActionBuilder] = useState(false);

  /**
   * Step 1: Position Creation (MVPシステム設計書準拠)
   */
  const handleCreatePosition = useCallback(async () => {
    // Clear previous errors
    setErrors(prev => ({ ...prev, create: undefined }));
    
    if (!positionData.accountId || positionData.volume <= 0) {
      setErrors(prev => ({ ...prev, create: '必須項目を入力してください' }));
      return;
    }

    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      const userId = user.userId;

      // Create position with PENDING status
      const positionResult = await amplifyClient.models.Position.create({
        userId: userId,
        accountId: positionData.accountId,
        symbol: positionData.symbol,
        volume: positionData.volume,
        executionType: positionData.executionType,
        status: 'PENDING',
        trailWidth: 0, // Will be set in trail step
        triggerActionIds: '',
        memo: positionData.memo
      });

      if (positionResult.errors) {
        throw new Error(positionResult.errors.map((e: any) => e.message).join(', '));
      }

      setCreatedPositionId(positionResult.data!.id);
      setCurrentStep('trail');
    } catch (error) {
      console.error('Failed to create position:', error);
      setErrors(prev => ({ 
        ...prev, 
        create: error instanceof Error ? error.message : 'ポジションの作成に失敗しました' 
      }));
    } finally {
      setIsLoading(false);
    }
  }, [positionData]);

  /**
   * Step 2: Trail Configuration
   */
  const handleConfigureTrail = useCallback(async () => {
    if (!createdPositionId) return;
    
    // Clear previous errors
    setErrors(prev => ({ ...prev, trail: undefined }));

    setIsLoading(true);
    try {
      let triggerActionIds = '';

      // Create trigger actions if trail width > 0
      if (trailData.trailWidth > 0 && trailData.triggerActions.length > 0) {
        const user = await getCurrentUser();
        const userId = user.userId;

        const createdActions = await Promise.all(
          trailData.triggerActions.map(action => 
            amplifyClient.models.Action.create({
              userId: userId,
              accountId: positionData.accountId,
              positionId: createdPositionId,
              triggerPositionId: createdPositionId,
              type: action.type,
              status: 'PENDING'
            })
          )
        );

        triggerActionIds = JSON.stringify(
          createdActions.map(result => result.data?.id).filter(Boolean)
        );
      }

      // Update position with trail settings
      await amplifyClient.models.Position.update({
        id: createdPositionId,
        trailWidth: trailData.trailWidth,
        triggerActionIds: triggerActionIds
      });

      setCurrentStep('execute');
    } catch (error) {
      console.error('Failed to configure trail:', error);
      setErrors(prev => ({ 
        ...prev, 
        trail: error instanceof Error ? error.message : 'トレール設定に失敗しました' 
      }));
    } finally {
      setIsLoading(false);
    }
  }, [createdPositionId, trailData, positionData.accountId]);

  /**
   * Step 3: Position Execution
   */
  const handleExecutePosition = useCallback(async () => {
    if (!createdPositionId) return;
    
    // Clear previous errors
    setErrors(prev => ({ ...prev, execute: undefined }));

    setIsLoading(true);
    try {
      // Update status to OPENING to trigger Hedge System execution
      await amplifyClient.models.Position.update({
        id: createdPositionId,
        status: 'OPENING'
      });

      setCurrentStep('complete');
      
      // Notify completion
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to execute position:', error);
      setErrors(prev => ({ 
        ...prev, 
        execute: error instanceof Error ? error.message : 'ポジションの実行に失敗しました' 
      }));
    } finally {
      setIsLoading(false);
    }
  }, [createdPositionId, onComplete]);

  /**
   * Add trail action handler
   */
  const handleAddTrailAction = (actionData: any) => {
    setTrailData(prev => ({
      ...prev,
      triggerActions: [...prev.triggerActions, actionData]
    }));
    setShowActionBuilder(false);
  };

  /**
   * Remove trail action
   */
  const handleRemoveTrailAction = (index: number) => {
    setTrailData(prev => ({
      ...prev,
      triggerActions: prev.triggerActions.filter((_, i) => i !== index)
    }));
  };

  /**
   * Reset workflow
   */
  const handleResetWorkflow = () => {
    setCurrentStep('create');
    setCreatedPositionId('');
    setErrors({});
    setPositionData({
      accountId: '',
      symbol: Symbol.USDJPY,
      volume: 1.0,
      executionType: ExecutionType.ENTRY,
      memo: ''
    });
    setTrailData({
      trailWidth: 0,
      triggerActions: []
    });
  };

  /**
   * Step renderer
   */
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'create':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>口座ID</Label>
                <Input
                  value={positionData.accountId}
                  onChange={(e) => 
                    setPositionData(prev => ({ ...prev, accountId: e.target.value }))
                  }
                  placeholder="account-123"
                />
              </div>
              
              <div className="space-y-2">
                <Label>シンボル</Label>
                <Select 
                  value={positionData.symbol} 
                  onValueChange={(value) => 
                    setPositionData(prev => ({ ...prev, symbol: value as Symbol }))
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>数量</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={positionData.volume}
                  onChange={(e) => 
                    setPositionData(prev => ({ ...prev, volume: Number(e.target.value) }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>実行タイプ</Label>
                <Select 
                  value={positionData.executionType} 
                  onValueChange={(value) => 
                    setPositionData(prev => ({ ...prev, executionType: value as ExecutionType }))
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
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Input
                value={positionData.memo}
                onChange={(e) => 
                  setPositionData(prev => ({ ...prev, memo: e.target.value }))
                }
                placeholder="オプション"
              />
            </div>

            <Button 
              onClick={handleCreatePosition} 
              disabled={isLoading || !positionData.accountId}
              className="w-full"
            >
              {isLoading ? '作成中...' : 'ポジション作成'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );

      case 'trail':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>トレール幅 (pips)</Label>
              <Input
                type="number"
                value={trailData.trailWidth}
                onChange={(e) => 
                  setTrailData(prev => ({ ...prev, trailWidth: Number(e.target.value) }))
                }
                placeholder="0 = トレールなし"
              />
              {trailData.trailWidth === 0 && (
                <p className="text-sm text-amber-600">
                  ⚠️ トレール幅 0 = 即時実行モード
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>トレール発動時のアクション</Label>
              {trailData.triggerActions.length === 0 ? (
                <div className="text-center text-gray-500 py-4 border border-dashed rounded-lg">
                  アクションが設定されていません
                </div>
              ) : (
                <div className="space-y-2">
                  {trailData.triggerActions.map((action, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span>{action.type}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveTrailAction(index)}
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                onClick={() => setShowActionBuilder(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                アクション追加
              </Button>
            </div>

            <Button 
              onClick={handleConfigureTrail} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? '設定中...' : 'トレール設定完了'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );

      case 'execute':
        return (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">ポジション準備完了</h3>
                <p className="text-gray-600">
                  ポジションの作成とトレール設定が完了しました。
                  実行ボタンをクリックして取引を開始してください。
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">ポジション情報</div>
                  <div>{positionData.symbol} {positionData.executionType}</div>
                  <div>{positionData.volume} lots</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">トレール設定</div>
                  <div>{trailData.trailWidth} pips</div>
                  <div>{trailData.triggerActions.length} アクション</div>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleExecutePosition} 
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? '実行中...' : 'ポジション実行'}
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">実行完了</h3>
              <p className="text-gray-600">
                ポジションの実行を開始しました。
                Hedge Systemで処理が実行されます。
              </p>
            </div>
            
            <Button onClick={handleResetWorkflow} className="w-full">
              新しいポジションを作成
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepStatus = (step: WorkflowStep) => {
    const stepOrder: WorkflowStep[] = ['create', 'trail', 'execute', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <>
      <Button onClick={() => setShowWorkflow(true)} size="lg" className="w-full">
        <Target className="h-4 w-4 mr-2" />
        ポジションワークフロー開始
      </Button>

      <Dialog open={showWorkflow} onOpenChange={setShowWorkflow}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>ポジション作成→トレール設定→実行ワークフロー</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-6">
            {/* Status Tracker Sidebar */}
            <div className="col-span-1">
              <WorkflowStatusTracker 
                currentStep={currentStep}
                positionId={createdPositionId}
                errors={errors}
              />
            </div>
            
            {/* Main Workflow Content */}
            <div className="col-span-2 space-y-6">
              {/* Current Step Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {currentStep === 'create' && <Plus className="h-5 w-5" />}
                    {currentStep === 'trail' && <Settings className="h-5 w-5" />}
                    {currentStep === 'execute' && <TrendingUp className="h-5 w-5" />}
                    {currentStep === 'complete' && <CheckCircle className="h-5 w-5" />}
                    
                    {currentStep === 'create' && 'ポジション情報入力'}
                    {currentStep === 'trail' && 'トレール設定'}
                    {currentStep === 'execute' && '実行準備'}
                    {currentStep === 'complete' && 'ワークフロー完了'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderCurrentStep()}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Builder Dialog */}
      <Dialog open={showActionBuilder} onOpenChange={setShowActionBuilder}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>トレール発動アクション作成</DialogTitle>
          </DialogHeader>
          <ActionBuilder
            onSave={handleAddTrailAction}
            onCancel={() => setShowActionBuilder(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
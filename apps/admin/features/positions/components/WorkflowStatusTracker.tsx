'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Progress } from '@repo/ui/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play,
  Settings,
  TrendingUp,
  Target
} from 'lucide-react';

export type WorkflowStep = 'create' | 'trail' | 'execute' | 'complete';
export type StepStatus = 'completed' | 'current' | 'upcoming' | 'error';

interface WorkflowStatusTrackerProps {
  currentStep: WorkflowStep;
  positionId?: string;
  errors?: Partial<Record<WorkflowStep, string>>;
  className?: string;
}

interface StepConfig {
  key: WorkflowStep;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}

const WORKFLOW_STEPS: StepConfig[] = [
  {
    key: 'create',
    label: 'ポジション作成',
    description: '口座、シンボル、数量を設定',
    icon: Target
  },
  {
    key: 'trail',
    label: 'トレール設定',
    description: 'トレール幅とアクションを設定',
    icon: Settings
  },
  {
    key: 'execute',
    label: '実行準備',
    description: '設定確認と実行準備',
    icon: TrendingUp
  },
  {
    key: 'complete',
    label: '実行完了',
    description: 'Hedge Systemで処理開始',
    icon: CheckCircle
  }
];

export function WorkflowStatusTracker({ 
  currentStep, 
  positionId, 
  errors = {},
  className = "" 
}: WorkflowStatusTrackerProps) {
  
  const getStepStatus = (step: WorkflowStep): StepStatus => {
    if (errors[step]) return 'error';
    
    const stepOrder: WorkflowStep[] = ['create', 'trail', 'execute', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const getProgressValue = (): number => {
    const stepOrder: WorkflowStep[] = ['create', 'trail', 'execute', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    return ((currentIndex + 1) / stepOrder.length) * 100;
  };

  const getStepStatusBadge = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-status-success status-success">完了</Badge>;
      case 'current':
        return <Badge variant="default" className="bg-status-info status-info">実行中</Badge>;
      case 'error':
        return <Badge variant="destructive" className="bg-status-error status-error">エラー</Badge>;
      case 'upcoming':
        return <Badge variant="secondary">待機中</Badge>;
      default:
        return <Badge variant="outline">不明</Badge>;
    }
  };

  const getStepIcon = (step: StepConfig, status: StepStatus) => {
    const IconComponent = step.icon;
    
    if (status === 'error') {
      return <AlertCircle className="h-5 w-5 text-status-error" />;
    }
    if (status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-status-success" />;
    }
    if (status === 'current') {
      return <IconComponent className="h-5 w-5 text-status-info" />;
    }
    
    return <IconComponent className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            ワークフロー進捗
          </span>
          {positionId && (
            <Badge variant="outline" className="font-mono text-xs">
              ID: {positionId.substring(0, 8)}...
            </Badge>
          )}
        </CardTitle>
        <div className="space-y-2">
          <Progress value={getProgressValue()} className="h-2" />
          <div className="flex justify-between text-xs text-text-subtle">
            <span>進捗: {Math.round(getProgressValue())}%</span>
            <span>ステップ {WORKFLOW_STEPS.findIndex(s => s.key === currentStep) + 1} / {WORKFLOW_STEPS.length}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {WORKFLOW_STEPS.map((step, index) => {
            const status = getStepStatus(step.key);
            const error = errors[step.key];
            
            return (
              <div
                key={step.key}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${status === 'current' ? 'bg-status-info-foreground border-status-info' :
                    status === 'completed' ? 'bg-status-success-foreground border-status-success' :
                    status === 'error' ? 'bg-status-error-foreground border-status-error' :
                    'bg-muted border-border'}
                `}
              >
                <div className="flex-shrink-0">
                  {getStepIcon(step, status)}
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      status === 'current' ? 'text-status-info' :
                      status === 'completed' ? 'text-status-success' :
                      status === 'error' ? 'text-status-error' :
                      'text-text-body'
                    }`}>
                      {step.label}
                    </span>
                    {getStepStatusBadge(status)}
                  </div>
                  <p className={`text-sm mt-1 ${
                    status === 'current' ? 'text-status-info' :
                    status === 'completed' ? 'text-status-success' :
                    status === 'error' ? 'text-status-error' :
                    'text-text-subtle'
                  }`}>
                    {error || step.description}
                  </p>
                </div>

                <div className="flex-shrink-0 text-sm text-text-subtle">
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <strong>現在のステップ:</strong> {WORKFLOW_STEPS.find(s => s.key === currentStep)?.label}
          </div>
          {Object.keys(errors).length > 0 && (
            <div className="text-sm text-red-600 mt-1">
              <strong>エラー:</strong> {Object.keys(errors).length}件のエラーがあります
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
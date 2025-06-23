"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";

// アクションチェーンの各段階の状態
type ActionStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

// 実行段階の定義
interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  status: ActionStatus;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  details?: Record<string, any>;
}

// 戦略実行状態
interface StrategyExecution {
  id: string;
  symbol: string;
  direction: "buy" | "sell";
  lots: number;
  entryAccount: string;
  hedgeAccount: string;
  status: ActionStatus;
  startTime: Date;
  endTime?: Date;
  currentStepIndex: number;
  steps: ExecutionStep[];
  progress: number; // 0-100
}

interface StrategyExecutionMonitorProps {
  executions: StrategyExecution[];
  onCancelExecution?: (executionId: string) => void;
}

export function StrategyExecutionMonitor({ 
  executions, 
  onCancelExecution 
}: StrategyExecutionMonitorProps) {

  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            実行中の戦略はありません
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>実行中の戦略</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {executions.map((execution) => (
            <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">
                  {execution.symbol} {execution.direction === 'buy' ? '買い' : '売り'} {execution.lots}lot
                </div>
                <div className="text-sm text-muted-foreground">
                  ID: {execution.id}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={
                  execution.status === 'completed' ? 'default' :
                  execution.status === 'failed' ? 'destructive' :
                  execution.status === 'in_progress' ? 'secondary' : 'outline'
                }>
                  {execution.status === 'completed' ? '完了' :
                   execution.status === 'failed' ? '失敗' :
                   execution.status === 'in_progress' ? '実行中' : '待機中'}
                </Badge>
                
                {execution.status === 'in_progress' && onCancelExecution && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onCancelExecution(execution.id)}
                  >
                    キャンセル
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// モックデータ生成用のヘルパー関数
export function createMockExecution(id: string, symbol: string, direction: "buy" | "sell"): StrategyExecution {
  const now = new Date();
  const steps: ExecutionStep[] = [
    {
      id: "entry",
      name: "エントリー実行",
      description: "指定口座でのポジション開設",
      status: "completed",
      startTime: now,
      endTime: new Date(now.getTime() + 5000)
    },
    {
      id: "trail_monitor",
      name: "トレール監視開始",
      description: "エントリー価格を基準としたトレール監視",
      status: "in_progress",
      startTime: new Date(now.getTime() + 5000)
    },
    {
      id: "trail_trigger",
      name: "トレール決済",
      description: "トレール条件達成時の自動決済",
      status: "pending"
    },
    {
      id: "hedge_execution",
      name: "両建て実行",
      description: "決済と同時or直後の両建てエントリー",
      status: "pending"
    }
  ];

  return {
    id,
    symbol,
    direction,
    lots: 0.1,
    entryAccount: "Account-1",
    hedgeAccount: "Account-2",
    status: "in_progress",
    startTime: now,
    currentStepIndex: 1,
    steps,
    progress: 25
  };
}
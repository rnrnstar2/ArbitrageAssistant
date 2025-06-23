"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Clock, TrendingUp, X, DollarSign, Percent } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type ActionType = 'ENTRY' | 'CLOSE' | 'PARTIAL_CLOSE' | 'TRAIL_SET' | 'WAIT';

interface ActionBuilderProps {
  onSave: (action: any) => void;
  onCancel: () => void;
}

export function ActionBuilder({ onSave, onCancel }: ActionBuilderProps) {
  const [actionType, setActionType] = useState<ActionType>('ENTRY');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');

  // アクションタイプごとのアイコン
  const actionIcons = {
    ENTRY: <TrendingUp className="h-4 w-4" />,
    CLOSE: <X className="h-4 w-4" />,
    PARTIAL_CLOSE: <Percent className="h-4 w-4" />,
    TRAIL_SET: <DollarSign className="h-4 w-4" />,
    WAIT: <Clock className="h-4 w-4" />
  };

  // アクションタイプごとのパラメータフォーム
  const renderParameterForm = () => {
    switch (actionType) {
      case 'ENTRY':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>通貨ペア</Label>
                <Select 
                  value={parameters.symbol || ''} 
                  onValueChange={(value) => setParameters({...parameters, symbol: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDJPY">USDJPY</SelectItem>
                    <SelectItem value="EURUSD">EURUSD</SelectItem>
                    <SelectItem value="GBPUSD">GBPUSD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>方向</Label>
                <Select 
                  value={parameters.direction || ''} 
                  onValueChange={(value) => setParameters({...parameters, direction: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">買い</SelectItem>
                    <SelectItem value="SELL">売り</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>ロット数</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={parameters.lots || ''} 
                onChange={(e) => setParameters({...parameters, lots: parseFloat(e.target.value)})}
                placeholder="1.0"
              />
            </div>
          </div>
        );
      
      case 'CLOSE':
        return (
          <div className="space-y-4">
            <div>
              <Label>ポジション選択</Label>
              <Select 
                value={selectedPosition} 
                onValueChange={setSelectedPosition}
              >
                <SelectTrigger>
                  <SelectValue placeholder="決済するポジションを選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos1">USDJPY Buy 1.0 lot (+50 pips)</SelectItem>
                  <SelectItem value="pos2">EURUSD Sell 0.5 lot (-20 pips)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'PARTIAL_CLOSE':
        return (
          <div className="space-y-4">
            <div>
              <Label>ポジション選択</Label>
              <Select 
                value={selectedPosition} 
                onValueChange={setSelectedPosition}
              >
                <SelectTrigger>
                  <SelectValue placeholder="部分決済するポジションを選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos1">USDJPY Buy 1.0 lot (+50 pips)</SelectItem>
                  <SelectItem value="pos2">EURUSD Sell 0.5 lot (-20 pips)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>決済比率 (%)</Label>
              <Input 
                type="number" 
                min="10" 
                max="90" 
                step="10"
                value={parameters.closeRatio ? parameters.closeRatio * 100 : ''} 
                onChange={(e) => setParameters({...parameters, closeRatio: parseFloat(e.target.value) / 100})}
                placeholder="50"
              />
            </div>
          </div>
        );
      
      case 'TRAIL_SET':
        return (
          <div className="space-y-4">
            <div>
              <Label>ポジション選択</Label>
              <Select 
                value={selectedPosition} 
                onValueChange={setSelectedPosition}
              >
                <SelectTrigger>
                  <SelectValue placeholder="トレール設定するポジションを選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos1">USDJPY Buy 1.0 lot (+50 pips)</SelectItem>
                  <SelectItem value="pos2">EURUSD Sell 0.5 lot (-20 pips)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>トレール幅 (pips)</Label>
                <Input 
                  type="number" 
                  value={parameters.trailDistance || ''} 
                  onChange={(e) => setParameters({...parameters, trailDistance: parseInt(e.target.value)})}
                  placeholder="20"
                />
              </div>
              <div>
                <Label>ステップ (pips)</Label>
                <Input 
                  type="number" 
                  value={parameters.trailStep || ''} 
                  onChange={(e) => setParameters({...parameters, trailStep: parseInt(e.target.value)})}
                  placeholder="5"
                />
              </div>
            </div>
          </div>
        );
      
      case 'WAIT':
        return (
          <div className="space-y-4">
            <div>
              <Label>待機時間 (秒)</Label>
              <Input 
                type="number" 
                value={parameters.waitSeconds || ''} 
                onChange={(e) => setParameters({...parameters, waitSeconds: parseInt(e.target.value)})}
                placeholder="300"
              />
              <p className="text-sm text-muted-foreground mt-1">
                カモフラージュのためのランダム待機
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const handleSave = () => {
    const action = {
      type: actionType,
      userId: selectedUser,
      accountId: selectedAccount,
      positionId: selectedPosition || undefined,
      parameters,
      status: 'PENDING'
    };
    onSave(action);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>新規アクション作成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* アクションタイプ選択 */}
        <div>
          <Label>アクションタイプ</Label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {(['ENTRY', 'CLOSE', 'PARTIAL_CLOSE', 'TRAIL_SET', 'WAIT'] as ActionType[]).map((type) => (
              <Button
                key={type}
                variant={actionType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActionType(type)}
                className={cn(
                  "flex items-center gap-1",
                  actionType === type && "ring-2 ring-offset-2"
                )}
              >
                {actionIcons[type]}
                <span className="text-xs">
                  {type === 'ENTRY' && 'エントリー'}
                  {type === 'CLOSE' && '決済'}
                  {type === 'PARTIAL_CLOSE' && '部分決済'}
                  {type === 'TRAIL_SET' && 'トレール'}
                  {type === 'WAIT' && '待機'}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* ユーザー・口座選択（WAIT以外） */}
        {actionType !== 'WAIT' && (
          <>
            <div>
              <Label>ユーザー</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="ユーザーを選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user1">田中太郎</SelectItem>
                  <SelectItem value="user2">山田花子</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>口座</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="口座を選択..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acc1">XM - 12345678</SelectItem>
                  <SelectItem value="acc2">TitanFX - 87654321</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* パラメータフォーム */}
        {renderParameterForm()}

        {/* アクションボタン */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>
            アクション作成
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
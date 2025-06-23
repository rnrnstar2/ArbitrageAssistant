"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Separator } from "@repo/ui/components/ui/separator";
import { Badge } from "@repo/ui/components/ui/badge";
import { useToast } from "@repo/ui/hooks/use-toast";
import { TrendingUp, Plus, Trash2, User as UserIcon } from "lucide-react";
import type { User, AccountWithStatus, EntryStrategyFormData, LotEntry } from '../types/types';

const SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "AUDJPY", "CHFJPY", "NZDJPY",
  "EURCHF", "EURAUD", "EURCAD", "GBPCHF", "GBPAUD", "AUDCAD"
];

interface EntryStrategyFormProps {
  users: User[];
  accounts: AccountWithStatus[];
  onStrategyExecuted?: (strategyId: string) => void;
}

export function EntryStrategyForm({ users, accounts, onStrategyExecuted }: EntryStrategyFormProps) {
  const [formData, setFormData] = useState<EntryStrategyFormData>({
    selectedUserId: "",
    entryAccountId: "",
    symbol: "",
    direction: "buy",
    lotConfiguration: {
      type: 'single',
      singleLot: 0.01,
      multipleLots: [{ id: '1', lots: 0.01 }]
    },
    trailSettings: {
      startPips: 10,
      trailPips: 5,
      trailStep: 1
    },
    hedgeSettings: {
      enabled: false,
      type: 'reverse_entry',
      reverseEntry: {
        hedgeAccountId: "",
        hedgeLots: 0.01,
        executionTiming: "immediate",
        delaySeconds: 0
      },
      existingPositionClose: {
        targetAccountId: "",
        positionSelection: 'all_same_direction',
        closeRatio: 1.0,
        executionTiming: "immediate",
        delaySeconds: 0
      }
    }
  });
  
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  // 選択されたユーザーに基づくアカウント一覧
  const selectedUser = users.find(u => u.id === formData.selectedUserId);
  const availableAccounts = selectedUser?.accounts.filter((account: AccountWithStatus) => account.status === 'online') || [];
  const selectedAccount = availableAccounts.find((acc: AccountWithStatus) => acc.id === formData.entryAccountId);

  // フォームが有効かどうか
  const isFormValid = (
    formData.selectedUserId &&
    formData.entryAccountId &&
    formData.symbol &&
    (formData.lotConfiguration.type === 'single' ? formData.lotConfiguration.singleLot >= 0.01 : formData.lotConfiguration.multipleLots.length > 0) &&
    (!formData.hedgeSettings.enabled || (
      (formData.hedgeSettings.type === 'reverse_entry' && formData.hedgeSettings.reverseEntry?.hedgeAccountId) ||
      (formData.hedgeSettings.type === 'existing_position_close' && formData.hedgeSettings.existingPositionClose?.targetAccountId) ||
      formData.hedgeSettings.type === 'both'
    ))
  );

  // 複数ロット管理
  const addLotEntry = () => {
    const newId = (formData.lotConfiguration.multipleLots.length + 1).toString();
    setFormData({
      ...formData,
      lotConfiguration: {
        ...formData.lotConfiguration,
        multipleLots: [...formData.lotConfiguration.multipleLots, { id: newId, lots: 0.01 }]
      }
    });
  };

  const removeLotEntry = (id: string) => {
    setFormData({
      ...formData,
      lotConfiguration: {
        ...formData.lotConfiguration,
        multipleLots: formData.lotConfiguration.multipleLots.filter(entry => entry.id !== id)
      }
    });
  };

  const updateLotEntry = (id: string, lots: number) => {
    setFormData({
      ...formData,
      lotConfiguration: {
        ...formData.lotConfiguration,
        multipleLots: formData.lotConfiguration.multipleLots.map(entry => 
          entry.id === id ? { ...entry, lots } : entry
        )
      }
    });
  };

  // ユーザー選択時の処理
  const handleUserSelect = (userId: string) => {
    setFormData({
      ...formData,
      selectedUserId: userId,
      entryAccountId: ""
    });
  };

  const handleExecuteStrategy = async () => {
    if (!isFormValid) return;
    
    setIsExecuting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const strategyId = `strategy-${Date.now()}`;
      
      const totalLots = formData.lotConfiguration.type === 'single' 
        ? formData.lotConfiguration.singleLot
        : formData.lotConfiguration.multipleLots.reduce((sum, entry) => sum + entry.lots, 0);
      
      toast({
        title: "戦略実行開始",
        description: `${formData.symbol} ${formData.direction === 'buy' ? '買い' : '売り'} 合計${totalLots}lot`,
      });
      
      onStrategyExecuted?.(strategyId);
    } catch (error) {
      toast({
        title: "実行エラー",
        description: "戦略実行に失敗しました",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          エントリー戦略
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ユーザー選択 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            ユーザー選択
          </Label>
          <Select 
            value={formData.selectedUserId} 
            onValueChange={handleUserSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="ユーザーを選択してください" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* エントリー口座選択 */}
        {selectedUser && (
          <div className="space-y-2">
            <Label>エントリー口座</Label>
            <Select 
              value={formData.entryAccountId} 
              onValueChange={(value) => setFormData({...formData, entryAccountId: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="取引口座を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {availableAccounts.map((account: AccountWithStatus) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex flex-col">
                      <span>{account.broker} - {account.accountNumber}</span>
                      <span className="text-sm text-muted-foreground">
                        残高: ¥{account.balance.toLocaleString()} | クレジット: ¥{account.credit.toLocaleString()} | レバレッジ: {account.leverage}:1
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 選択された口座の詳細情報表示 */}
        {selectedAccount && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>口座名</Label>
                  <p className="font-medium">{selectedAccount.name}</p>
                </div>
                <div>
                  <Label>ブローカー</Label>
                  <p className="font-medium">{selectedAccount.broker}</p>
                </div>
                <div>
                  <Label>残高</Label>
                  <p className="font-medium">¥{selectedAccount.balance.toLocaleString()}</p>
                </div>
                <div>
                  <Label>クレジット</Label>
                  <p className="font-medium">¥{selectedAccount.credit.toLocaleString()}</p>
                </div>
                <div>
                  <Label>レバレッジ</Label>
                  <p className="font-medium">{selectedAccount.leverage}:1</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* 通貨ペア選択 */}
        <div className="space-y-2">
          <Label>通貨ペア</Label>
          <Select 
            value={formData.symbol} 
            onValueChange={(value) => setFormData({...formData, symbol: value})}
          >
            <SelectTrigger>
              <SelectValue placeholder="通貨ペアを選択してください" />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ロット数設定 */}
        <div className="space-y-3">
          <Label>ロット数設定</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="single-lot"
                checked={formData.lotConfiguration.type === 'single'}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    lotConfiguration: {
                      ...formData.lotConfiguration,
                      type: checked ? 'single' : 'multiple'
                    }
                  })
                }
              />
              <Label htmlFor="single-lot">単一ロット</Label>
            </div>
            
            {formData.lotConfiguration.type === 'single' ? (
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.lotConfiguration.singleLot}
                onChange={(e) => setFormData({
                  ...formData,
                  lotConfiguration: {
                    ...formData.lotConfiguration,
                    singleLot: parseFloat(e.target.value) || 0
                  }
                })}
                placeholder="0.01"
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>複数ロット設定</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLotEntry}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    追加
                  </Button>
                </div>
                {formData.lotConfiguration.multipleLots.map((entry, index) => (
                  <div key={entry.id} className="flex items-center space-x-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={entry.lots}
                      onChange={(e) => updateLotEntry(entry.id, parseFloat(e.target.value) || 0)}
                      placeholder="0.01"
                      className="flex-1"
                    />
                    <Label className="text-sm text-muted-foreground">lot</Label>
                    {formData.lotConfiguration.multipleLots.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLotEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="text-sm text-muted-foreground">
                  合計: {formData.lotConfiguration.multipleLots.reduce((sum, entry) => sum + entry.lots, 0)} lot
                </div>
              </div>
            )}
          </div>
        </div>

        {/* エントリー方向 */}
        <div className="space-y-2">
          <Label>エントリー方向</Label>
          <Select 
            value={formData.direction} 
            onValueChange={(value: "buy" | "sell") => setFormData({...formData, direction: value})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">買い</SelectItem>
              <SelectItem value="sell">売り</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* トレール設定（常に有効） */}
        <div className="space-y-3">
          <Label className="font-medium">トレール設定</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-sm">開始PIPS</Label>
              <Input
                type="number"
                min="1"
                value={formData.trailSettings.startPips}
                onChange={(e) => setFormData({
                  ...formData, 
                  trailSettings: {...formData.trailSettings, startPips: parseInt(e.target.value) || 0}
                })}
                placeholder="10"
              />
            </div>
            <div>
              <Label className="text-sm">トレール幅(PIPS)</Label>
              <Input
                type="number"
                min="1"
                value={formData.trailSettings.trailPips}
                onChange={(e) => setFormData({
                  ...formData, 
                  trailSettings: {...formData.trailSettings, trailPips: parseInt(e.target.value) || 0}
                })}
                placeholder="5"
              />
            </div>
            <div>
              <Label className="text-sm">ステップ(PIPS)</Label>
              <Input
                type="number"
                min="1"
                value={formData.trailSettings.trailStep}
                onChange={(e) => setFormData({
                  ...formData, 
                  trailSettings: {...formData.trailSettings, trailStep: parseInt(e.target.value) || 0}
                })}
                placeholder="1"
              />
            </div>
          </div>
        </div>

        {/* 両建て設定 */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hedge-enabled"
              checked={formData.hedgeSettings.enabled}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                hedgeSettings: {
                  ...formData.hedgeSettings,
                  enabled: !!checked
                }
              })}
            />
            <Label htmlFor="hedge-enabled">両建て設定を有効にする</Label>
          </div>
          
          {formData.hedgeSettings.enabled && (
            <div className="ml-6 space-y-4">
              {/* 両建てタイプ選択 */}
              <div className="space-y-2">
                <Label>両建てタイプ</Label>
                <Select 
                  value={formData.hedgeSettings.type} 
                  onValueChange={(value: 'reverse_entry' | 'existing_position_close' | 'both') => setFormData({
                    ...formData,
                    hedgeSettings: {
                      ...formData.hedgeSettings,
                      type: value
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reverse_entry">逆方向エントリー</SelectItem>
                    <SelectItem value="existing_position_close">既存ポジション決済</SelectItem>
                    <SelectItem value="both">両方</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 逆方向エントリー設定 */}
              {(formData.hedgeSettings.type === 'reverse_entry' || formData.hedgeSettings.type === 'both') && (
                <div className="space-y-3 border rounded-lg p-3">
                  <Label className="font-medium">逆方向エントリー設定</Label>
                  <div className="space-y-2">
                    <Label>ヘッジ口座</Label>
                    <Select 
                      value={formData.hedgeSettings.reverseEntry?.hedgeAccountId || ''} 
                      onValueChange={(value) => setFormData({
                        ...formData,
                        hedgeSettings: {
                          ...formData.hedgeSettings,
                          reverseEntry: {
                            ...formData.hedgeSettings.reverseEntry!,
                            hedgeAccountId: value
                          }
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="ヘッジ口座を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter((account: AccountWithStatus) => account.id !== formData.entryAccountId && account.status === 'online')
                          .map((account: AccountWithStatus) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.broker} - {account.accountNumber}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>ヘッジロット数</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.hedgeSettings.reverseEntry?.hedgeLots || 0}
                        onChange={(e) => setFormData({
                          ...formData,
                          hedgeSettings: {
                            ...formData.hedgeSettings,
                            reverseEntry: {
                              ...formData.hedgeSettings.reverseEntry!,
                              hedgeLots: parseFloat(e.target.value) || 0
                            }
                          }
                        })}
                        placeholder="0.01"
                      />
                    </div>
                    <div>
                      <Label>遅延秒数</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.hedgeSettings.reverseEntry?.delaySeconds || 0}
                        onChange={(e) => setFormData({
                          ...formData,
                          hedgeSettings: {
                            ...formData.hedgeSettings,
                            reverseEntry: {
                              ...formData.hedgeSettings.reverseEntry!,
                              delaySeconds: parseInt(e.target.value) || 0
                            }
                          }
                        })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 既存ポジション決済設定 */}
              {(formData.hedgeSettings.type === 'existing_position_close' || formData.hedgeSettings.type === 'both') && (
                <div className="space-y-3 border rounded-lg p-3">
                  <Label className="font-medium">既存ポジション決済設定</Label>
                  <div className="space-y-2">
                    <Label>決済対象口座</Label>
                    <Select 
                      value={formData.hedgeSettings.existingPositionClose?.targetAccountId || ''} 
                      onValueChange={(value) => setFormData({
                        ...formData,
                        hedgeSettings: {
                          ...formData.hedgeSettings,
                          existingPositionClose: {
                            ...formData.hedgeSettings.existingPositionClose!,
                            targetAccountId: value
                          }
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="決済対象口座を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter((account: AccountWithStatus) => account.id !== formData.entryAccountId && account.status === 'online')
                          .map((account: AccountWithStatus) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.broker} - {account.accountNumber}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>決済ポジション選択</Label>
                    <Select 
                      value={formData.hedgeSettings.existingPositionClose?.positionSelection || 'all_same_direction'} 
                      onValueChange={(value: 'all_same_direction' | 'all_opposite_direction' | 'specific_positions') => setFormData({
                        ...formData,
                        hedgeSettings: {
                          ...formData.hedgeSettings,
                          existingPositionClose: {
                            ...formData.hedgeSettings.existingPositionClose!,
                            positionSelection: value
                          }
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_same_direction">同一方向の全ポジション</SelectItem>
                        <SelectItem value="all_opposite_direction">逆方向の全ポジション</SelectItem>
                        <SelectItem value="specific_positions">特定ポジション指定</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>決済比率 (0.1-1.0)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="1.0"
                        value={formData.hedgeSettings.existingPositionClose?.closeRatio || 1.0}
                        onChange={(e) => setFormData({
                          ...formData,
                          hedgeSettings: {
                            ...formData.hedgeSettings,
                            existingPositionClose: {
                              ...formData.hedgeSettings.existingPositionClose!,
                              closeRatio: parseFloat(e.target.value) || 1.0
                            }
                          }
                        })}
                        placeholder="1.0"
                      />
                    </div>
                    <div>
                      <Label>遅延秒数</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.hedgeSettings.existingPositionClose?.delaySeconds || 0}
                        onChange={(e) => setFormData({
                          ...formData,
                          hedgeSettings: {
                            ...formData.hedgeSettings,
                            existingPositionClose: {
                              ...formData.hedgeSettings.existingPositionClose!,
                              delaySeconds: parseInt(e.target.value) || 0
                            }
                          }
                        })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ※ 特定ポジション指定の場合は、実行時にポジションを選択できます
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />
        
        {/* 実行ボタン */}
        <Button 
          onClick={handleExecuteStrategy}
          disabled={!isFormValid || isExecuting}
          className="w-full"
          size="lg"
        >
          {isExecuting ? "実行中..." : "戦略実行"}
        </Button>
      </CardContent>
    </Card>
  );
}
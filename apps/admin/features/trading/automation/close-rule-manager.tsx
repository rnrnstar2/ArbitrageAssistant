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
import { Switch } from "@repo/ui/components/ui/switch";
import { useToast } from "@repo/ui/hooks/use-toast";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon, DollarSignIcon, PlusIcon, SettingsIcon } from "lucide-react";

interface CloseRule {
  id: string;
  name: string;
  conditions: {
    maxSwapAmount?: number;
    maxHoldingDays?: number;
    profitThreshold?: number;
    lossLimit?: number;
    marginLevel?: number;
  };
  actions: {
    closeType: "market" | "limit";
    notifyBeforeClose: boolean;
    delayMinutes?: number;
    autoExecute: boolean;
  };
  isActive: boolean;
  priority: "low" | "medium" | "high";
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export function CloseRuleManager() {
  const [rules, setRules] = useState<CloseRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<CloseRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<CloseRule>>({
    name: "",
    conditions: {},
    actions: {
      closeType: "market",
      notifyBeforeClose: true,
      autoExecute: false,
    },
    isActive: true,
    priority: "medium",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      // TODO: 実際のAPIコールを実装
      // const result = await client.models.CloseRule.list();
      
      // モックデータ
      setRules([
        {
          id: "1",
          name: "高スワップコスト自動決済",
          conditions: { maxSwapAmount: 10, maxHoldingDays: 5 },
          actions: { closeType: "market", notifyBeforeClose: true, autoExecute: false },
          isActive: true,
          priority: "high",
          createdAt: new Date("2024-06-01"),
          triggerCount: 23,
          lastTriggered: new Date("2024-06-18"),
        },
        {
          id: "2",
          name: "利益確定ルール",
          conditions: { profitThreshold: 50 },
          actions: { closeType: "limit", notifyBeforeClose: false, autoExecute: true },
          isActive: true,
          priority: "medium",
          createdAt: new Date("2024-06-05"),
          triggerCount: 15,
          lastTriggered: new Date("2024-06-19"),
        },
        {
          id: "3",
          name: "リスク管理決済",
          conditions: { lossLimit: -100, marginLevel: 150 },
          actions: { closeType: "market", notifyBeforeClose: true, autoExecute: true },
          isActive: false,
          priority: "high",
          createdAt: new Date("2024-06-10"),
          triggerCount: 3,
        },
      ]);
    } catch (error) {
      console.error("Error fetching rules:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createRule = async () => {
    if (!newRule.name || !Object.keys(newRule.conditions || {}).length) {
      toast({
        title: "エラー",
        description: "ルール名と条件を設定してください",
      });
      return;
    }

    try {
      // TODO: 実際のAPIコールを実装
      // await client.models.CloseRule.create(newRule);
      
      const createdRule: CloseRule = {
        ...newRule as CloseRule,
        id: Date.now().toString(),
        createdAt: new Date(),
        triggerCount: 0,
      };

      setRules([...rules, createdRule]);
      setNewRule({
        name: "",
        conditions: {},
        actions: {
          closeType: "market",
          notifyBeforeClose: true,
          autoExecute: false,
        },
        isActive: true,
        priority: "medium",
      });
      setIsCreating(false);

      toast({
        title: "ルール作成",
        description: "新しい決済ルールを作成しました",
      });
    } catch (error) {
      console.error("Error creating rule:", error);
      toast({
        title: "エラー",
        description: "ルールの作成に失敗しました",
      });
    }
  };

  const updateRule = async (ruleId: string, updates: Partial<CloseRule>) => {
    try {
      // TODO: 実際のAPIコールを実装
      // await client.models.CloseRule.update({ id: ruleId, ...updates });
      
      setRules(rules.map(rule => 
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ));

      toast({
        title: "ルール更新",
        description: "決済ルールを更新しました",
      });
    } catch (error) {
      console.error("Error updating rule:", error);
      toast({
        title: "エラー",
        description: "ルールの更新に失敗しました",
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      // TODO: 実際のAPIコールを実装
      // await client.models.CloseRule.delete({ id: ruleId });
      
      setRules(rules.filter(rule => rule.id !== ruleId));

      toast({
        title: "ルール削除",
        description: "決済ルールを削除しました",
      });
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast({
        title: "エラー",
        description: "ルールの削除に失敗しました",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600";
      case "medium": return "text-yellow-600";
      default: return "text-green-600";
    }
  };

  const getPriorityBadgeVariant = (priority: string): "default" | "secondary" | "destructive" => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "default";
    }
  };

  const formatConditions = (conditions: CloseRule['conditions']) => {
    const parts = [];
    if (conditions.maxSwapAmount) parts.push(`スワップ≥$${conditions.maxSwapAmount}`);
    if (conditions.maxHoldingDays) parts.push(`保有≥${conditions.maxHoldingDays}日`);
    if (conditions.profitThreshold) parts.push(`利益≥$${conditions.profitThreshold}`);
    if (conditions.lossLimit) parts.push(`損失≤$${conditions.lossLimit}`);
    if (conditions.marginLevel) parts.push(`証拠金率≤${conditions.marginLevel}%`);
    return parts.join(" または ");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>決済ルール管理</CardTitle>
          <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
            <PlusIcon className="h-4 w-4 mr-2" />
            新規ルール
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 新規ルール作成フォーム */}
        {isCreating && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">新規決済ルール作成</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ルール名 */}
              <div>
                <Label htmlFor="rule-name">ルール名</Label>
                <Input
                  id="rule-name"
                  value={newRule.name || ""}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="例: 高スワップコスト自動決済"
                />
              </div>

              {/* 優先度 */}
              <div>
                <Label htmlFor="rule-priority">優先度</Label>
                <Select
                  value={newRule.priority}
                  onValueChange={(value: string) => setNewRule({ ...newRule, priority: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 条件設定 */}
              <div className="space-y-3">
                <Label>決済条件（いずれかが満たされた場合）</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max-swap">最大スワップコスト ($)</Label>
                    <Input
                      id="max-swap"
                      type="number"
                      placeholder="10"
                      value={newRule.conditions?.maxSwapAmount || ""}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: {
                          ...newRule.conditions,
                          maxSwapAmount: parseFloat(e.target.value) || undefined,
                        }
                      })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="max-days">最大保有日数</Label>
                    <Input
                      id="max-days"
                      type="number"
                      placeholder="5"
                      value={newRule.conditions?.maxHoldingDays || ""}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: {
                          ...newRule.conditions,
                          maxHoldingDays: parseInt(e.target.value) || undefined,
                        }
                      })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="profit-threshold">利益確定閾値 ($)</Label>
                    <Input
                      id="profit-threshold"
                      type="number"
                      placeholder="50"
                      value={newRule.conditions?.profitThreshold || ""}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: {
                          ...newRule.conditions,
                          profitThreshold: parseFloat(e.target.value) || undefined,
                        }
                      })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="loss-limit">損切り閾値 ($)</Label>
                    <Input
                      id="loss-limit"
                      type="number"
                      placeholder="-100"
                      value={newRule.conditions?.lossLimit || ""}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: {
                          ...newRule.conditions,
                          lossLimit: parseFloat(e.target.value) || undefined,
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* アクション設定 */}
              <div className="space-y-3">
                <Label>決済アクション</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="close-type">決済方法</Label>
                    <Select
                      value={newRule.actions?.closeType}
                      onValueChange={(value: string) => setNewRule({
                        ...newRule,
                        actions: {
                          ...newRule.actions!,
                          closeType: value as any,
                        }
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
                  
                  <div>
                    <Label htmlFor="delay">実行遅延（分）</Label>
                    <Input
                      id="delay"
                      type="number"
                      placeholder="0"
                      value={newRule.actions?.delayMinutes || ""}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        actions: {
                          ...newRule.actions!,
                          delayMinutes: parseInt(e.target.value) || undefined,
                        }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notify-before"
                      checked={newRule.actions?.notifyBeforeClose}
                      onCheckedChange={(checked: boolean) => setNewRule({
                        ...newRule,
                        actions: {
                          ...newRule.actions!,
                          notifyBeforeClose: checked,
                        }
                      })}
                    />
                    <Label htmlFor="notify-before">決済前に通知する</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-execute"
                      checked={newRule.actions?.autoExecute}
                      onCheckedChange={(checked: boolean) => setNewRule({
                        ...newRule,
                        actions: {
                          ...newRule.actions!,
                          autoExecute: checked,
                        }
                      })}
                    />
                    <Label htmlFor="auto-execute">自動実行する</Label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={createRule} className="flex-1">
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
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              ルールを読み込み中...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              決済ルールが設定されていません
            </div>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className={rule.isActive ? '' : 'opacity-50'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Badge variant={getPriorityBadgeVariant(rule.priority)}>
                          {rule.priority === "high" ? "高優先度" : rule.priority === "medium" ? "中優先度" : "低優先度"}
                        </Badge>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "有効" : "無効"}
                        </Badge>
                        {rule.actions.autoExecute && (
                          <Badge variant="outline">自動実行</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">条件:</span> {formatConditions(rule.conditions)}
                        </div>
                        <div>
                          <span className="font-medium">アクション:</span> {rule.actions.closeType === "market" ? "成行決済" : "指値決済"}
                          {rule.actions.notifyBeforeClose && " (通知あり)"}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>実行回数: {rule.triggerCount}</span>
                          {rule.lastTriggered && (
                            <span>最終実行: {rule.lastTriggered.toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(checked) => updateRule(rule.id, { isActive: checked })}
                        />
                        <Label className="text-xs">有効</Label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRule(rule)}
                      >
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 統計情報 */}
        {rules.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {rules.filter(r => r.isActive).length}
                </div>
                <div className="text-sm text-gray-500">有効ルール</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {rules.reduce((sum, r) => sum + r.triggerCount, 0)}
                </div>
                <div className="text-sm text-gray-500">総実行回数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {rules.filter(r => r.priority === "high").length}
                </div>
                <div className="text-sm text-gray-500">高優先度</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {rules.filter(r => r.actions.autoExecute).length}
                </div>
                <div className="text-sm text-gray-500">自動実行</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
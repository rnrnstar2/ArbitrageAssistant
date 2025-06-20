"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  PlusIcon, 
  SettingsIcon, 
  DownloadIcon, 
  UploadIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon
} from "lucide-react";

import { ActionSettingsForm } from "./ActionSettingsForm";
import { ActionPresetManager } from "./ActionPresetManager";
import { Position, ActionSettings, ActionPreset } from "./types";

interface ActionSettingsUIProps {
  positions: Position[];
  onActionSettingsUpdate?: (positionId: string, settings: ActionSettings) => void;
  className?: string;
}

export function ActionSettingsUI({ 
  positions, 
  onActionSettingsUpdate,
  className = "" 
}: ActionSettingsUIProps) {
  const [actionSettings, setActionSettings] = useState<Map<string, ActionSettings>>(new Map());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadActionSettings();
  }, []);

  const loadActionSettings = async () => {
    setIsLoading(true);
    try {
      // TODO: 実際のAPIコールを実装
      // const settings = await api.getActionSettings();
      
      // モックデータ
      const mockSettings = new Map<string, ActionSettings>([
        ["pos1", {
          positionId: "pos1",
          trigger: {
            type: "margin_level",
            threshold: 150,
            condition: "below"
          },
          actions: [
            {
              type: "close_position",
              parameters: { closeType: "market" },
              priority: 1
            },
            {
              type: "notify",
              parameters: { message: "緊急決済実行" },
              priority: 2
            }
          ],
          isActive: true,
          executionMode: "sequential"
        }],
        ["pos2", {
          positionId: "pos2", 
          trigger: {
            type: "profit_target",
            threshold: 100,
            condition: "above"
          },
          actions: [
            {
              type: "close_position",
              parameters: { closeType: "limit", targetPrice: 1.1250 },
              priority: 1
            }
          ],
          isActive: false,
          executionMode: "sequential"
        }]
      ]);
      
      setActionSettings(mockSettings);
    } catch (error) {
      console.error("Error loading action settings:", error);
      toast({
        title: "エラー",
        description: "アクション設定の読み込みに失敗しました",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateActionSettings = async (positionId: string, settings: ActionSettings) => {
    try {
      // TODO: 実際のAPIコールを実装
      // await api.updateActionSettings(positionId, settings);
      
      setActionSettings(prev => new Map(prev.set(positionId, settings)));
      onActionSettingsUpdate?.(positionId, settings);
      
      toast({
        title: "設定更新",
        description: "アクション設定を更新しました",
      });
    } catch (error) {
      console.error("Error updating action settings:", error);
      toast({
        title: "エラー",
        description: "設定の更新に失敗しました",
        variant: "destructive"
      });
    }
  };

  const toggleActiveStatus = async (positionId: string) => {
    const current = actionSettings.get(positionId);
    if (current) {
      const updated = { ...current, isActive: !current.isActive };
      await updateActionSettings(positionId, updated);
    }
  };

  const bulkToggleActive = async (active: boolean) => {
    const filteredPositions = getFilteredPositions();
    for (const position of filteredPositions) {
      const current = actionSettings.get(position.id);
      if (current && current.isActive !== active) {
        const updated = { ...current, isActive: active };
        await updateActionSettings(position.id, updated);
      }
    }
  };

  const exportSettings = () => {
    const settingsArray = Array.from(actionSettings.entries()).map(([id, settings]) => ({
      positionId: id,
      ...settings
    }));
    
    const dataStr = JSON.stringify(settingsArray, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `action-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "エクスポート完了",
      description: "アクション設定をエクスポートしました",
    });
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        const newSettingsMap = new Map<string, ActionSettings>();
        
        importedSettings.forEach((setting: any) => {
          const { positionId, ...settingData } = setting;
          newSettingsMap.set(positionId, settingData);
        });
        
        setActionSettings(newSettingsMap);
        
        toast({
          title: "インポート完了",
          description: "アクション設定をインポートしました",
        });
      } catch (error) {
        console.error("Import error:", error);
        toast({
          title: "エラー",
          description: "設定ファイルの形式が正しくありません",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const getFilteredPositions = () => {
    return positions.filter(position => {
      const settings = actionSettings.get(position.id);
      const matchesFilter = filterStatus === 'all' || 
        (filterStatus === 'active' && settings?.isActive) ||
        (filterStatus === 'inactive' && !settings?.isActive);
      
      const matchesSearch = searchTerm === "" || 
        position.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position.id.toLowerCase().includes(searchTerm.toLowerCase());
        
      return matchesFilter && matchesSearch;
    });
  };

  const getTriggerStatusColor = (settings: ActionSettings | undefined) => {
    if (!settings || !settings.isActive) return "text-gray-500";
    if (settings.trigger.type === "margin_level") return "text-red-600";
    if (settings.trigger.type === "profit_target") return "text-green-600";
    return "text-yellow-600";
  };

  const formatTriggerCondition = (settings: ActionSettings) => {
    const { type, threshold, condition } = settings.trigger;
    const conditionText = condition === "above" ? "以上" : condition === "below" ? "以下" : "一致";
    
    switch (type) {
      case "margin_level":
        return `証拠金維持率 ${threshold}% ${conditionText}`;
      case "profit_target":
        return `利益 $${threshold} ${conditionText}`;
      case "loss_amount":
        return `損失 $${Math.abs(threshold)} ${conditionText}`;
      default:
        return `${type} ${threshold} ${conditionText}`;
    }
  };

  const filteredPositions = getFilteredPositions();
  const activeSettingsCount = Array.from(actionSettings.values()).filter(s => s.isActive).length;
  const totalSettingsCount = actionSettings.size;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>アクション設定管理</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                ポジション別のリスク管理アクションを設定・管理します
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPresetManager(true)}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                プリセット
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportSettings}
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                エクスポート
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    インポート
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 統計情報 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{filteredPositions.length}</div>
              <div className="text-sm text-gray-500">総ポジション</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{activeSettingsCount}</div>
              <div className="text-sm text-gray-500">有効設定</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{totalSettingsCount}</div>
              <div className="text-sm text-gray-500">設定済み</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {positions.length - totalSettingsCount}
              </div>
              <div className="text-sm text-gray-500">未設定</div>
            </div>
          </div>

          {/* フィルター・検索 */}
          <div className="flex justify-between items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="filter">フィルター:</Label>
              <select
                id="filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="all">すべて</option>
                <option value="active">有効のみ</option>
                <option value="inactive">無効のみ</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Input
                placeholder="ポジション検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkToggleActive(true)}
              >
                一括有効化
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkToggleActive(false)}
              >
                一括無効化
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ポジション一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>ポジション一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              設定を読み込み中...
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              該当するポジションがありません
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPositions.map((position) => {
                const settings = actionSettings.get(position.id);
                return (
                  <Card key={position.id} className={`transition-opacity ${settings?.isActive ? '' : 'opacity-60'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium">{position.symbol}</h4>
                            <Badge variant={position.type === 'buy' ? 'default' : 'secondary'}>
                              {position.type.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {position.lots} lots
                            </Badge>
                            {settings && (
                              <Badge variant={settings.isActive ? "default" : "secondary"}>
                                {settings.isActive ? "有効" : "無効"}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm space-y-1">
                            <div className="flex items-center space-x-4">
                              <span>開始価格: {position.openPrice}</span>
                              <span>現在価格: {position.currentPrice}</span>
                              <span className={`font-medium ${position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                損益: {position.profit >= 0 ? '+' : ''}${position.profit.toFixed(2)}
                              </span>
                            </div>
                            
                            {settings && (
                              <div className={`text-xs ${getTriggerStatusColor(settings)}`}>
                                <span className="font-medium">トリガー:</span> {formatTriggerCondition(settings)}
                                <span className="ml-4">
                                  アクション: {settings.actions.length}件設定済み
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {settings && (
                            <div className="flex items-center space-x-1">
                              <Switch
                                checked={settings.isActive}
                                onCheckedChange={() => toggleActiveStatus(position.id)}
                              />
                              <Label className="text-xs">有効</Label>
                            </div>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPosition(position)}
                          >
                            {settings ? (
                              <>
                                <SettingsIcon className="h-4 w-4 mr-1" />
                                編集
                              </>
                            ) : (
                              <>
                                <PlusIcon className="h-4 w-4 mr-1" />
                                設定
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* アクション設定フォーム */}
      {selectedPosition && (
        <ActionSettingsForm
          position={selectedPosition}
          initialSettings={actionSettings.get(selectedPosition.id)}
          onSave={(settings) => {
            updateActionSettings(selectedPosition.id, settings);
            setSelectedPosition(null);
          }}
          onCancel={() => setSelectedPosition(null)}
        />
      )}

      {/* プリセット管理 */}
      {showPresetManager && (
        <ActionPresetManager
          onApplyPreset={(positionIds, preset) => {
            positionIds.forEach(positionId => {
              const settings: ActionSettings = {
                positionId,
                trigger: preset.trigger,
                actions: preset.actions,
                isActive: true,
                executionMode: preset.executionMode
              };
              updateActionSettings(positionId, settings);
            });
            setShowPresetManager(false);
          }}
          onClose={() => setShowPresetManager(false)}
          positions={positions}
        />
      )}
    </div>
  );
}
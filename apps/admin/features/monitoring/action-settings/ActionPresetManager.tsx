"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@repo/ui/components/ui/dialog";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  PlusIcon, 
  TrashIcon, 
  EditIcon, 
  CopyIcon,
  StarIcon,
  BookmarkIcon,
  X,
  CheckIcon
} from "lucide-react";

import { 
  Position, 
  ActionPreset, 
  BUILT_IN_PRESETS,
  TRIGGER_TYPE_CONFIGS,
  ACTION_TYPE_CONFIGS
} from "./types";

interface ActionPresetManagerProps {
  onApplyPreset: (positionIds: string[], preset: ActionPreset) => void;
  onClose: () => void;
  positions: Position[];
  className?: string;
}

export function ActionPresetManager({
  onApplyPreset,
  onClose,
  positions,
  className = ""
}: ActionPresetManagerProps) {
  const [presets, setPresets] = useState<ActionPreset[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ActionPreset | null>(null);
  const [newPreset, setNewPreset] = useState<Partial<ActionPreset>>({
    name: "",
    description: "",
    category: "custom",
    trigger: {
      type: "margin_level",
      threshold: 150,
      condition: "below"
    },
    actions: [],
    executionMode: "sequential"
  });
  const { toast } = useToast();

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      // TODO: 実際のAPIコールを実装
      // const customPresets = await api.getCustomPresets();
      
      // モックカスタムプリセット
      const customPresets: ActionPreset[] = [
        {
          id: 'custom-1',
          name: 'カスタム利益確定',
          description: '50ドル利益で段階的決済',
          trigger: {
            type: 'profit_target',
            threshold: 50,
            condition: 'above'
          },
          actions: [
            {
              type: 'close_position',
              parameters: { closeType: 'market', partial: true, lots: 0.5 },
              priority: 1
            },
            {
              type: 'trail_stop',
              parameters: { trailPips: 15, startPips: 20 },
              priority: 2
            }
          ],
          executionMode: 'sequential',
          category: 'profit_taking',
          createdAt: new Date('2024-06-01'),
          isBuiltIn: false
        }
      ];

      setPresets([...BUILT_IN_PRESETS, ...customPresets]);
    } catch (error) {
      console.error("Error loading presets:", error);
      toast({
        title: "エラー",
        description: "プリセットの読み込みに失敗しました",
        variant: "destructive"
      });
    }
  };

  const createPreset = async () => {
    if (!newPreset.name || !newPreset.description || !newPreset.actions?.length) {
      toast({
        title: "エラー",
        description: "名前、説明、アクションは必須項目です",
        variant: "destructive"
      });
      return;
    }

    try {
      // TODO: 実際のAPIコールを実装
      // await api.createPreset(newPreset);
      
      const createdPreset: ActionPreset = {
        ...newPreset as ActionPreset,
        id: `custom-${Date.now()}`,
        createdAt: new Date(),
        isBuiltIn: false
      };

      setPresets([...presets, createdPreset]);
      setNewPreset({
        name: "",
        description: "",
        category: "custom",
        trigger: {
          type: "margin_level",
          threshold: 150,
          condition: "below"
        },
        actions: [],
        executionMode: "sequential"
      });
      setShowCreateDialog(false);

      toast({
        title: "プリセット作成",
        description: "新しいプリセットを作成しました",
      });
    } catch (error) {
      console.error("Error creating preset:", error);
      toast({
        title: "エラー",
        description: "プリセットの作成に失敗しました",
        variant: "destructive"
      });
    }
  };

  const duplicatePreset = (preset: ActionPreset) => {
    const duplicated: Partial<ActionPreset> = {
      name: `${preset.name}のコピー`,
      description: preset.description,
      category: "custom",
      trigger: { ...preset.trigger },
      actions: preset.actions.map(action => ({ ...action })),
      executionMode: preset.executionMode
    };
    
    setNewPreset(duplicated);
    setShowCreateDialog(true);
  };

  const deletePreset = async (presetId: string) => {
    try {
      // TODO: 実際のAPIコールを実装
      // await api.deletePreset(presetId);
      
      setPresets(presets.filter(p => p.id !== presetId));
      
      toast({
        title: "プリセット削除",
        description: "プリセットを削除しました",
      });
    } catch (error) {
      console.error("Error deleting preset:", error);
      toast({
        title: "エラー",
        description: "プリセットの削除に失敗しました",
        variant: "destructive"
      });
    }
  };

  const applyPreset = (preset: ActionPreset) => {
    if (selectedPositions.length === 0) {
      toast({
        title: "エラー",
        description: "適用するポジションを選択してください",
        variant: "destructive"
      });
      return;
    }

    onApplyPreset(selectedPositions, preset);
    
    toast({
      title: "プリセット適用",
      description: `${selectedPositions.length}件のポジションにプリセットを適用しました`,
    });
  };

  const getFilteredPresets = () => {
    return presets.filter(preset => {
      const matchesCategory = filterCategory === 'all' || preset.category === filterCategory;
      const matchesSearch = searchTerm === "" || 
        preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesCategory && matchesSearch;
    });
  };

  const togglePositionSelection = (positionId: string) => {
    setSelectedPositions(prev => 
      prev.includes(positionId)
        ? prev.filter(id => id !== positionId)
        : [...prev, positionId]
    );
  };

  const selectAllPositions = () => {
    setSelectedPositions(positions.map(p => p.id));
  };

  const clearSelection = () => {
    setSelectedPositions([]);
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'risk_management': return 'bg-red-100 text-red-800';
      case 'profit_taking': return 'bg-green-100 text-green-800';
      case 'rebalancing': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'risk_management': return 'リスク管理';
      case 'profit_taking': return '利益確定';
      case 'rebalancing': return 'リバランス';
      default: return 'カスタム';
    }
  };

  const formatTriggerText = (preset: ActionPreset) => {
    const { type, threshold, condition } = preset.trigger;
    const conditionText = condition === 'above' ? '以上' : condition === 'below' ? '以下' : '一致';
    
    switch (type) {
      case 'margin_level':
        return `証拠金維持率 ${threshold}% ${conditionText}`;
      case 'profit_target':
        return `利益 $${threshold} ${conditionText}`;
      case 'loss_amount':
        return `損失 $${Math.abs(threshold)} ${conditionText}`;
      default:
        return `${type} ${threshold} ${conditionText}`;
    }
  };

  const filteredPresets = getFilteredPresets();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={`max-w-6xl max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>プリセット管理</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* ポジション選択 */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">適用対象ポジション</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAllPositions}>
                    全選択
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    選択解除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {positions.map(position => (
                  <div key={position.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`pos-${position.id}`}
                      checked={selectedPositions.includes(position.id)}
                      onCheckedChange={() => togglePositionSelection(position.id)}
                    />
                    <Label htmlFor={`pos-${position.id}`} className="text-sm">
                      {position.symbol} {position.type.toUpperCase()} {position.lots}lots
                    </Label>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                {selectedPositions.length}件のポジションが選択されています
              </div>
            </CardContent>
          </Card>

          {/* フィルター */}
          <div className="flex justify-between items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="category-filter">カテゴリ:</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="risk_management">リスク管理</SelectItem>
                  <SelectItem value="profit_taking">利益確定</SelectItem>
                  <SelectItem value="rebalancing">リバランス</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Input
              placeholder="プリセット検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>

          {/* プリセット一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPresets.map(preset => (
              <Card key={preset.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{preset.name}</h4>
                      {preset.isBuiltIn && (
                        <StarIcon className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <Badge className={getCategoryBadgeColor(preset.category)}>
                      {getCategoryLabel(preset.category)}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{preset.description}</p>

                  <div className="space-y-2 text-xs">
                    <div>
                      <strong>トリガー:</strong> {formatTriggerText(preset)}
                    </div>
                    <div>
                      <strong>アクション:</strong> {preset.actions.length}件
                    </div>
                    <div>
                      <strong>実行モード:</strong> {preset.executionMode === 'sequential' ? '順次' : '並列'}
                    </div>
                  </div>

                  <div className="flex space-x-2 mt-4">
                    <Button 
                      size="sm" 
                      onClick={() => applyPreset(preset)}
                      disabled={selectedPositions.length === 0}
                      className="flex-1"
                    >
                      <CheckIcon className="h-3 w-3 mr-1" />
                      適用
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => duplicatePreset(preset)}
                    >
                      <CopyIcon className="h-3 w-3" />
                    </Button>
                    {!preset.isBuiltIn && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deletePreset(preset.id)}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPresets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              該当するプリセットがありません
            </div>
          )}
        </div>

        {/* 新規作成ダイアログ */}
        {showCreateDialog && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>新規プリセット作成</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preset-name">プリセット名</Label>
                    <Input
                      id="preset-name"
                      value={newPreset.name || ""}
                      onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                      placeholder="例: カスタム利益確定"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preset-category">カテゴリ</Label>
                    <Select 
                      value={newPreset.category}
                      onValueChange={(value) => setNewPreset({ ...newPreset, category: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="risk_management">リスク管理</SelectItem>
                        <SelectItem value="profit_taking">利益確定</SelectItem>
                        <SelectItem value="rebalancing">リバランス</SelectItem>
                        <SelectItem value="custom">カスタム</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="preset-description">説明</Label>
                  <Textarea
                    id="preset-description"
                    value={newPreset.description || ""}
                    onChange={(e) => setNewPreset({ ...newPreset, description: e.target.value })}
                    placeholder="プリセットの説明を入力..."
                  />
                </div>

                <div className="text-sm text-gray-500">
                  詳細な設定は作成後にプリセットを適用してカスタマイズできます
                </div>

                <div className="flex space-x-2">
                  <Button onClick={createPreset} className="flex-1">
                    作成
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    キャンセル
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
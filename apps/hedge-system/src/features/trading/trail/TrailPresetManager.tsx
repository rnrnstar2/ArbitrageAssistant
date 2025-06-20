"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@repo/ui/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Badge } from "@repo/ui/components/ui/badge";
import { useToast } from "@repo/ui/hooks/use-toast";
import { Trash2, Edit, Plus, Download, Upload, Search, Filter } from "lucide-react";

import { 
  TrailPreset, 
  TrailPresetManagerProps, 
  CreatePresetFormData, 
  PresetFilterOptions 
} from "./types";
import { useTrailPresetStorage } from "./hooks/useTrailPresetStorage";

const DEFAULT_CATEGORIES = [
  "基本設定",
  "リスク低",
  "リスク中",
  "リスク高",
  "カスタム"
];

const TRAIL_TYPES = [
  { value: "fixed", label: "固定幅 (pips)" },
  { value: "percentage", label: "パーセンテージ (%)" },
  { value: "atr", label: "ATRベース" }
];

const START_CONDITION_TYPES = [
  { value: "immediate", label: "即座開始" },
  { value: "profit_threshold", label: "利益しきい値" },
  { value: "price_level", label: "価格レベル" }
];

export function TrailPresetManager({ 
  onPresetSelected, 
  onPresetApplied, 
  className = "" 
}: TrailPresetManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<TrailPreset | null>(null);
  const [filters, setFilters] = useState<PresetFilterOptions>({
    search: "",
    category: "all",
    type: "all"
  });

  const {
    presets,
    loading,
    error,
    createPreset,
    updatePreset,
    deletePreset,
    exportPresets,
    importPresets,
    loadPresets
  } = useTrailPresetStorage();

  const { toast } = useToast();

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const filteredPresets = presets.filter(preset => {
    const matchesSearch = preset.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         (preset.description?.toLowerCase().includes(filters.search.toLowerCase()) ?? false);
    const matchesCategory = filters.category === "all" || preset.category === filters.category;
    const matchesType = filters.type === "all" || preset.settings.type === filters.type;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const handleCreatePreset = async (formData: CreatePresetFormData) => {
    try {
      const newPreset: Omit<TrailPreset, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        description: formData.description,
        settings: {
          type: formData.type,
          trailAmount: formData.trailAmount,
          startCondition: {
            type: formData.startConditionType,
            value: formData.startConditionValue
          }
        },
        isDefault: false,
        category: formData.category
      };

      await createPreset(newPreset);
      setShowCreateDialog(false);
      
      toast({
        title: "プリセット作成完了",
        description: `「${formData.name}」を作成しました`,
      });
    } catch (error) {
      console.error("Failed to create preset:", error);
      toast({
        title: "エラー",
        description: "プリセットの作成に失敗しました",
      });
    }
  };

  const handleUpdatePreset = async (preset: TrailPreset, formData: CreatePresetFormData) => {
    try {
      const updatedPreset: TrailPreset = {
        ...preset,
        name: formData.name,
        description: formData.description,
        settings: {
          type: formData.type,
          trailAmount: formData.trailAmount,
          startCondition: {
            type: formData.startConditionType,
            value: formData.startConditionValue
          }
        },
        category: formData.category,
        updatedAt: new Date()
      };

      await updatePreset(updatedPreset);
      setEditingPreset(null);
      
      toast({
        title: "プリセット更新完了",
        description: `「${formData.name}」を更新しました`,
      });
    } catch (error) {
      console.error("Failed to update preset:", error);
      toast({
        title: "エラー",
        description: "プリセットの更新に失敗しました",
      });
    }
  };

  const handleDeletePreset = async (preset: TrailPreset) => {
    if (!confirm(`「${preset.name}」を削除しますか？`)) {
      return;
    }

    try {
      await deletePreset(preset.id);
      toast({
        title: "プリセット削除完了",
        description: `「${preset.name}」を削除しました`,
      });
    } catch (error) {
      console.error("Failed to delete preset:", error);
      toast({
        title: "エラー",
        description: "プリセットの削除に失敗しました",
      });
    }
  };

  const handleApplyPreset = (preset: TrailPreset) => {
    onPresetApplied?.(preset);
    toast({
      title: "プリセット適用",
      description: `「${preset.name}」を適用しました`,
    });
  };

  const handleExportPresets = async () => {
    try {
      const data = await exportPresets();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trail-presets-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "エクスポート完了",
        description: "プリセットをエクスポートしました",
      });
    } catch (error) {
      console.error("Failed to export presets:", error);
      toast({
        title: "エラー",
        description: "エクスポートに失敗しました",
      });
    }
  };

  const handleImportPresets = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importPresets(text);
      
      toast({
        title: "インポート完了",
        description: `${count}個のプリセットをインポートしました`,
      });
    } catch (error) {
      console.error("Failed to import presets:", error);
      toast({
        title: "エラー",
        description: "インポートに失敗しました",
      });
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">プリセットを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-700">エラーが発生しました: {error}</p>
        <Button 
          onClick={loadPresets} 
          variant="outline" 
          size="sm" 
          className="mt-2"
        >
          再読み込み
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">トレールプリセット管理</h2>
          <p className="text-gray-600">よく使用するトレール設定を保存・管理</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleExportPresets}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            エクスポート
          </Button>
          <label htmlFor="import-presets">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                インポート
              </span>
            </Button>
          </label>
          <input
            id="import-presets"
            type="file"
            accept=".json"
            onChange={handleImportPresets}
            className="hidden"
          />
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                新規作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新しいプリセットを作成</DialogTitle>
              </DialogHeader>
              <PresetForm
                onSubmit={handleCreatePreset}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* フィルタ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            フィルタ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">検索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="プリセット名で検索..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="category">カテゴリ</Label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters({ ...filters, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {DEFAULT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">タイプ</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters({ ...filters, type: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {TRAIL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* プリセット一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPresets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            onEdit={() => setEditingPreset(preset)}
            onDelete={() => handleDeletePreset(preset)}
            onApply={() => handleApplyPreset(preset)}
            onSelect={() => onPresetSelected?.(preset)}
          />
        ))}
      </div>

      {filteredPresets.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">プリセットが見つかりません</p>
        </div>
      )}

      {/* 編集ダイアログ */}
      {editingPreset && (
        <Dialog open={!!editingPreset} onOpenChange={() => setEditingPreset(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>プリセットを編集</DialogTitle>
            </DialogHeader>
            <PresetForm
              initialData={{
                name: editingPreset.name,
                description: editingPreset.description || "",
                type: editingPreset.settings.type,
                trailAmount: editingPreset.settings.trailAmount,
                startConditionType: editingPreset.settings.startCondition.type,
                startConditionValue: editingPreset.settings.startCondition.value,
                category: editingPreset.category
              }}
              onSubmit={(formData) => handleUpdatePreset(editingPreset, formData)}
              onCancel={() => setEditingPreset(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface PresetCardProps {
  preset: TrailPreset;
  onEdit: () => void;
  onDelete: () => void;
  onApply: () => void;
  onSelect: () => void;
}

function PresetCard({ preset, onEdit, onDelete, onApply, onSelect }: PresetCardProps) {
  const trailTypeLabel = TRAIL_TYPES.find(t => t.value === preset.settings.type)?.label;
  const startConditionLabel = START_CONDITION_TYPES.find(t => t.value === preset.settings.startCondition.type)?.label;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onSelect}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{preset.name}</CardTitle>
          <div className="flex items-center space-x-1">
            {preset.isDefault && (
              <Badge variant="secondary">デフォルト</Badge>
            )}
            <Badge variant="outline">{preset.category}</Badge>
          </div>
        </div>
        {preset.description && (
          <p className="text-sm text-gray-600">{preset.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">タイプ:</span>
            <span>{trailTypeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">トレール幅:</span>
            <span>{preset.settings.trailAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">開始条件:</span>
            <span>{startConditionLabel}</span>
          </div>
          {preset.settings.startCondition.value && (
            <div className="flex justify-between">
              <span className="text-gray-600">開始値:</span>
              <span>{preset.settings.startCondition.value}</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 mt-4">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
          >
            適用
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface PresetFormProps {
  initialData?: Partial<CreatePresetFormData>;
  onSubmit: (data: CreatePresetFormData) => void;
  onCancel: () => void;
}

function PresetForm({ initialData, onSubmit, onCancel }: PresetFormProps) {
  const [formData, setFormData] = useState<CreatePresetFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    type: initialData?.type || "fixed",
    trailAmount: initialData?.trailAmount || 10,
    startConditionType: initialData?.startConditionType || "immediate",
    startConditionValue: initialData?.startConditionValue,
    category: initialData?.category || "カスタム"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">プリセット名</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="プリセット名を入力"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">説明（オプション）</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="プリセットの説明"
        />
      </div>

      <div>
        <Label htmlFor="category">カテゴリ</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="type">トレールタイプ</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRAIL_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="trailAmount">トレール幅</Label>
        <Input
          id="trailAmount"
          type="number"
          step="0.1"
          min="0.1"
          value={formData.trailAmount}
          onChange={(e) => setFormData({ ...formData, trailAmount: parseFloat(e.target.value) || 0 })}
          required
        />
      </div>

      <div>
        <Label htmlFor="startConditionType">開始条件</Label>
        <Select
          value={formData.startConditionType}
          onValueChange={(value) => setFormData({ ...formData, startConditionType: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {START_CONDITION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(formData.startConditionType === "profit_threshold" || formData.startConditionType === "price_level") && (
        <div>
          <Label htmlFor="startConditionValue">開始値</Label>
          <Input
            id="startConditionValue"
            type="number"
            step="0.1"
            min="0"
            value={formData.startConditionValue || ""}
            onChange={(e) => setFormData({ 
              ...formData, 
              startConditionValue: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            placeholder="開始値を入力"
          />
        </div>
      )}

      <div className="flex items-center space-x-2 pt-4">
        <Button type="submit" className="flex-1">
          保存
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          キャンセル
        </Button>
      </div>
    </form>
  );
}
import { useState, useCallback } from "react";
import { TrailPreset, TrailPresetStorage } from "../types";

const STORAGE_KEY = 'arbitrage_assistant_trail_presets';
const STORAGE_VERSION = '1.0';

const DEFAULT_PRESETS: TrailPreset[] = [
  {
    id: 'default-fixed-conservative',
    name: '保守的固定トレール',
    description: '小さい固定トレール幅での安全な設定',
    settings: {
      type: 'fixed',
      trailAmount: 15,
      startCondition: {
        type: 'profit_threshold',
        value: 10
      }
    },
    isDefault: true,
    category: 'リスク低',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'default-fixed-aggressive',
    name: '積極的固定トレール',
    description: '大きい固定トレール幅での利益確保設定',
    settings: {
      type: 'fixed',
      trailAmount: 30,
      startCondition: {
        type: 'profit_threshold',
        value: 20
      }
    },
    isDefault: true,
    category: 'リスク中',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'default-percentage-balanced',
    name: 'バランス型パーセンテージ',
    description: 'バランス重視のパーセンテージトレール',
    settings: {
      type: 'percentage',
      trailAmount: 2.5,
      startCondition: {
        type: 'immediate'
      }
    },
    isDefault: true,
    category: 'リスク中',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'default-atr-dynamic',
    name: 'ATR動的トレール',
    description: 'ATRに基づく動的なトレール設定',
    settings: {
      type: 'atr',
      trailAmount: 1.5,
      startCondition: {
        type: 'profit_threshold',
        value: 15
      }
    },
    isDefault: true,
    category: 'リスク高',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export function useTrailPresetStorage() {
  const [presets, setPresets] = useState<TrailPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ストレージからプリセットを読み込み
  const loadPresets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (typeof window === 'undefined') {
        setPresets(DEFAULT_PRESETS);
        return;
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // 初回読み込み時はデフォルトプリセットを設定
        await savePresetsToStorage(DEFAULT_PRESETS);
        setPresets(DEFAULT_PRESETS);
        return;
      }

      const storageData: TrailPresetStorage = JSON.parse(stored);
      
      // 日付オブジェクトに変換
      const loadedPresets = storageData.presets.map(preset => ({
        ...preset,
        createdAt: new Date(preset.createdAt),
        updatedAt: new Date(preset.updatedAt)
      }));

      setPresets(loadedPresets);
    } catch (err) {
      console.error('Failed to load trail presets:', err);
      setError('プリセットの読み込みに失敗しました');
      // エラー時はデフォルトプリセットを使用
      setPresets(DEFAULT_PRESETS);
    } finally {
      setLoading(false);
    }
  }, []);

  // ストレージにプリセットを保存
  const savePresetsToStorage = useCallback(async (presetsToSave: TrailPreset[]) => {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const storageData: TrailPresetStorage = {
        presets: presetsToSave,
        lastSync: new Date(),
        version: STORAGE_VERSION
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    } catch (err) {
      console.error('Failed to save presets to storage:', err);
      
      // ストレージ容量超過の場合の処理
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        // 古いプリセットを削除して再試行
        const reducedPresets = presetsToSave
          .filter(p => p.isDefault || new Date().getTime() - p.updatedAt.getTime() < 30 * 24 * 60 * 60 * 1000); // 30日以内
        
        const storageData: TrailPresetStorage = {
          presets: reducedPresets.slice(0, 50), // 最大50個まで
          lastSync: new Date(),
          version: STORAGE_VERSION
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        throw new Error('ストレージ容量の制限により、古いプリセットが削除されました');
      }
      
      throw err;
    }
  }, []);

  // 新しいプリセットを作成
  const createPreset = useCallback(async (presetData: Omit<TrailPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newPreset: TrailPreset = {
      ...presetData,
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedPresets = [...presets, newPreset];
    await savePresetsToStorage(updatedPresets);
    setPresets(updatedPresets);
  }, [presets, savePresetsToStorage]);

  // プリセットを更新
  const updatePreset = useCallback(async (updatedPreset: TrailPreset) => {
    const updatedPresets = presets.map(preset => 
      preset.id === updatedPreset.id 
        ? { ...updatedPreset, updatedAt: new Date() }
        : preset
    );

    await savePresetsToStorage(updatedPresets);
    setPresets(updatedPresets);
  }, [presets, savePresetsToStorage]);

  // プリセットを削除
  const deletePreset = useCallback(async (presetId: string) => {
    // デフォルトプリセットの削除を防ぐ
    const presetToDelete = presets.find(p => p.id === presetId);
    if (presetToDelete?.isDefault) {
      throw new Error('デフォルトプリセットは削除できません');
    }

    const updatedPresets = presets.filter(preset => preset.id !== presetId);
    await savePresetsToStorage(updatedPresets);
    setPresets(updatedPresets);
  }, [presets, savePresetsToStorage]);

  // プリセットをエクスポート
  const exportPresets = useCallback(async (): Promise<string> => {
    const exportData = {
      presets: presets.filter(p => !p.isDefault), // デフォルトプリセットは除外
      exportedAt: new Date().toISOString(),
      version: STORAGE_VERSION
    };

    return JSON.stringify(exportData, null, 2);
  }, [presets]);

  // プリセットをインポート
  const importPresets = useCallback(async (data: string): Promise<number> => {
    try {
      const importData = JSON.parse(data);
      
      if (!importData.presets || !Array.isArray(importData.presets)) {
        throw new Error('無効なインポートデータです');
      }

      let importCount = 0;
      const newPresets: TrailPreset[] = [];

      for (const presetData of importData.presets) {
        if (validatePreset(presetData)) {
          // 重複チェック（名前ベース）
          const isDuplicate = presets.some(existing => existing.name === presetData.name);
          
          const preset: TrailPreset = {
            ...presetData,
            id: isDuplicate 
              ? `${presetData.id || 'imported'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              : presetData.id || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: isDuplicate ? `${presetData.name} (インポート)` : presetData.name,
            isDefault: false, // インポートしたプリセットはデフォルトにしない
            createdAt: new Date(presetData.createdAt || new Date()),
            updatedAt: new Date()
          };

          newPresets.push(preset);
          importCount++;
        }
      }

      if (newPresets.length > 0) {
        const updatedPresets = [...presets, ...newPresets];
        await savePresetsToStorage(updatedPresets);
        setPresets(updatedPresets);
      }

      return importCount;
    } catch (err) {
      console.error('Failed to import presets:', err);
      throw new Error('インポートに失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    }
  }, [presets, savePresetsToStorage]);

  // プリセット検証
  const validatePreset = (preset: any): preset is TrailPreset => {
    return (
      preset &&
      typeof preset.name === 'string' &&
      preset.settings &&
      typeof preset.settings.type === 'string' &&
      ['fixed', 'percentage', 'atr'].includes(preset.settings.type) &&
      typeof preset.settings.trailAmount === 'number' &&
      preset.settings.startCondition &&
      typeof preset.settings.startCondition.type === 'string' &&
      ['immediate', 'profit_threshold', 'price_level'].includes(preset.settings.startCondition.type) &&
      typeof preset.category === 'string'
    );
  };

  // プリセットを名前で検索
  const findPresetByName = useCallback((name: string): TrailPreset | null => {
    return presets.find(preset => preset.name === name) || null;
  }, [presets]);

  // カテゴリ別プリセット取得
  const getPresetsByCategory = useCallback((category: string): TrailPreset[] => {
    return presets.filter(preset => preset.category === category);
  }, [presets]);

  // デフォルトプリセット取得
  const getDefaultPresets = useCallback((): TrailPreset[] => {
    return presets.filter(preset => preset.isDefault);
  }, [presets]);

  // プリセット統計情報
  const getPresetStats = useCallback(() => {
    const stats = {
      total: presets.length,
      custom: presets.filter(p => !p.isDefault).length,
      default: presets.filter(p => p.isDefault).length,
      byCategory: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    presets.forEach(preset => {
      stats.byCategory[preset.category] = (stats.byCategory[preset.category] || 0) + 1;
      stats.byType[preset.settings.type] = (stats.byType[preset.settings.type] || 0) + 1;
    });

    return stats;
  }, [presets]);

  return {
    presets,
    loading,
    error,
    loadPresets,
    createPreset,
    updatePreset,
    deletePreset,
    exportPresets,
    importPresets,
    findPresetByName,
    getPresetsByCategory,
    getDefaultPresets,
    getPresetStats
  };
}
export interface TrailSettings {
  id: string
  positionId: string
  type: 'fixed' | 'percentage' | 'atr'
  trailAmount: number
  startCondition: {
    type: 'immediate' | 'profit_threshold' | 'price_level'
    value?: number
  }
  isActive: boolean
  currentStopLoss: number
  maxProfit: number
  lastUpdated: Date
}

export interface TrailPreset {
  id: string
  name: string
  description?: string
  settings: Omit<TrailSettings, 'id' | 'positionId' | 'currentStopLoss' | 'maxProfit' | 'lastUpdated' | 'isActive'>
  isDefault: boolean
  category: string
  createdAt: Date
  updatedAt: Date
}

export interface TrailPresetStorage {
  presets: TrailPreset[]
  lastSync: Date
  version: string
}

export interface TrailPresetManagerProps {
  onPresetSelected?: (preset: TrailPreset) => void
  onPresetApplied?: (preset: TrailPreset) => void
  className?: string
}

export interface CreatePresetFormData {
  name: string
  description: string
  type: 'fixed' | 'percentage' | 'atr'
  trailAmount: number
  startConditionType: 'immediate' | 'profit_threshold' | 'price_level'
  startConditionValue?: number
  category: string
}

export interface PresetFilterOptions {
  search: string
  category: string
  type: 'fixed' | 'percentage' | 'atr' | 'all'
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Save, RotateCcw, Plus, Trash2, Edit } from 'lucide-react'
import { TrailSettings, TrailPreset, TRAIL_TYPES, START_CONDITION_TYPES } from '../../types'

interface TrailSettingsProps {
  positionId?: string
  accountId?: string
  onSettingsChange?: (settings: TrailSettings) => void
  onPresetSave?: (preset: TrailPreset) => void
  initialSettings?: Partial<TrailSettings>
  presets?: TrailPreset[]
  disabled?: boolean
}

export default function TrailSettingsComponent({
  positionId,
  accountId,
  onSettingsChange,
  onPresetSave,
  initialSettings,
  presets = [],
  disabled = false
}: TrailSettingsProps) {
  const [settings, setSettings] = useState<Partial<TrailSettings>>({
    type: 'fixed',
    trailAmount: 10,
    startCondition: {
      type: 'immediate'
    },
    ...initialSettings
  })

  const [showPresetDialog, setShowPresetDialog] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSettingsChange = useCallback((key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const handleStartConditionChange = useCallback((key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      startCondition: {
        ...prev.startCondition,
        [key]: value
      }
    }))
  }, [])

  const handleSaveSettings = useCallback(async () => {
    if (!positionId || !accountId) {
      setError('Position ID and Account ID are required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const trailSettings: TrailSettings = {
        id: crypto.randomUUID(),
        positionId,
        accountId,
        symbol: '', // TODO: Get from position data
        type: settings.type as 'fixed' | 'percentage' | 'atr',
        trailAmount: settings.trailAmount || 0,
        startCondition: settings.startCondition || { type: 'immediate' },
        isActive: false,
        currentStopLoss: 0,
        maxProfit: 0,
        lastUpdated: new Date(),
        createdAt: new Date()
      }

      onSettingsChange?.(trailSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }, [settings, positionId, accountId, onSettingsChange])

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      setSettings({
        type: preset.type,
        trailAmount: preset.trailAmount,
        startCondition: preset.startCondition
      })
      setSelectedPreset(presetId)
    }
  }, [presets])

  const handleReset = useCallback(() => {
    setSettings({
      type: 'fixed',
      trailAmount: 10,
      startCondition: {
        type: 'immediate'
      }
    })
    setSelectedPreset(null)
    setError(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Trail Settings</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleReset}
            disabled={disabled || isLoading}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 inline mr-1" />
            Reset
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={disabled || isLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Save
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Trail Type Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Trail Type</label>
        <select
          value={settings.type || 'fixed'}
          onChange={(e) => handleSettingsChange('type', e.target.value)}
          disabled={disabled}
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="fixed">Fixed (pips)</option>
          <option value="percentage">Percentage (%)</option>
          <option value="atr">ATR Based</option>
        </select>
      </div>

      {/* Trail Amount */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Trail Amount {settings.type === 'fixed' && '(pips)'}
          {settings.type === 'percentage' && '(%)'}
          {settings.type === 'atr' && '(ATR multiplier)'}
        </label>
        <input
          type="number"
          value={settings.trailAmount || 0}
          onChange={(e) => handleSettingsChange('trailAmount', parseFloat(e.target.value) || 0)}
          disabled={disabled}
          step={settings.type === 'percentage' ? '0.1' : '1'}
          min="0"
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Start Condition */}
      <div className="space-y-4">
        <label className="block text-sm font-medium">Start Condition</label>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="immediate"
              name="startCondition"
              checked={settings.startCondition?.type === 'immediate'}
              onChange={() => handleStartConditionChange('type', 'immediate')}
              disabled={disabled}
            />
            <label htmlFor="immediate" className="text-sm">Start immediately</label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="profit_threshold"
              name="startCondition"
              checked={settings.startCondition?.type === 'profit_threshold'}
              onChange={() => handleStartConditionChange('type', 'profit_threshold')}
              disabled={disabled}
            />
            <label htmlFor="profit_threshold" className="text-sm">Start after profit threshold</label>
          </div>
          
          {settings.startCondition?.type === 'profit_threshold' && (
            <div className="ml-6">
              <input
                type="number"
                placeholder="Profit amount"
                value={settings.startCondition.value || ''}
                onChange={(e) => handleStartConditionChange('value', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                className="w-32 p-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="price_level"
              name="startCondition"
              checked={settings.startCondition?.type === 'price_level'}
              onChange={() => handleStartConditionChange('type', 'price_level')}
              disabled={disabled}
            />
            <label htmlFor="price_level" className="text-sm">Start at price level</label>
          </div>
          
          {settings.startCondition?.type === 'price_level' && (
            <div className="ml-6">
              <input
                type="number"
                placeholder="Price level"
                value={settings.startCondition.value || ''}
                onChange={(e) => handleStartConditionChange('value', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                step="0.00001"
                className="w-32 p-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Preset Management */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Presets</h3>
          <button
            onClick={() => setShowPresetDialog(true)}
            disabled={disabled}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            <Plus className="w-3 h-3 inline mr-1" />
            New
          </button>
        </div>
        
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className={`p-2 border rounded cursor-pointer hover:bg-gray-50 ${
                selectedPreset === preset.id ? 'border-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handlePresetSelect(preset.id)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{preset.name}</span>
                <span className="text-xs text-gray-500">
                  {preset.type} - {preset.trailAmount}
                </span>
              </div>
              {preset.description && (
                <p className="text-xs text-gray-600 mt-1">{preset.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
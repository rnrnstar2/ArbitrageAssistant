'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Pause, Play, Square, Eye, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { TrailStatus, TrailSettings, TrailStatistics, TRAIL_STATUS } from '../../types'

interface TrailMonitoringProps {
  trailStatuses?: TrailStatus[]
  trailSettings?: TrailSettings[]
  statistics?: TrailStatistics
  onPause?: (trailId: string) => void
  onResume?: (trailId: string) => void
  onStop?: (trailId: string) => void
  onRefresh?: () => void
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function TrailMonitoringComponent({
  trailStatuses = [],
  trailSettings = [],
  statistics,
  onPause,
  onResume,
  onStop,
  onRefresh,
  autoRefresh = true,
  refreshInterval = 5000
}: TrailMonitoringProps) {
  const [selectedTrail, setSelectedTrail] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'failed'>('all')

  // Auto refresh logic
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return

    const interval = setInterval(() => {
      setIsRefreshing(true)
      onRefresh()
      setLastRefresh(new Date())
      setTimeout(() => setIsRefreshing(false), 1000)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, onRefresh])

  const handleManualRefresh = useCallback(async () => {
    if (!onRefresh) return

    setIsRefreshing(true)
    try {
      await onRefresh()
      setLastRefresh(new Date())
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000)
    }
  }, [onRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case TRAIL_STATUS.ACTIVE:
        return <Activity className="w-4 h-4 text-green-500" />
      case TRAIL_STATUS.PAUSED:
        return <Pause className="w-4 h-4 text-yellow-500" />
      case TRAIL_STATUS.FAILED:
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case TRAIL_STATUS.COMPLETED:
        return <CheckCircle className="w-4 h-4 text-blue-500" />
      default:
        return <Square className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case TRAIL_STATUS.ACTIVE:
        return 'text-green-700 bg-green-50 border-green-200'
      case TRAIL_STATUS.PAUSED:
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case TRAIL_STATUS.FAILED:
        return 'text-red-700 bg-red-50 border-red-200'
      case TRAIL_STATUS.COMPLETED:
        return 'text-blue-700 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const filteredTrails = trailStatuses.filter(trail => {
    if (filter === 'all') return true
    return trail.status === filter
  })

  const getTrailSettings = (trailSettingsId: string) => {
    return trailSettings.find(s => s.id === trailSettingsId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Trail Monitoring</h2>
          <span className="text-sm text-gray-500">
            ({filteredTrails.length} trails)
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            Last update: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{statistics.activeTrails}</div>
            <div className="text-sm text-blue-600">Active Trails</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{statistics.totalAdjustments}</div>
            <div className="text-sm text-green-600">Total Adjustments</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">
              {(statistics.successRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-purple-600">Success Rate</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">
              ${statistics.averageProfit.toFixed(2)}
            </div>
            <div className="text-sm text-yellow-600">Avg Profit</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'paused', label: 'Paused' },
            { key: 'failed', label: 'Failed' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100">
                {trailStatuses.filter(t => key === 'all' || t.status === key).length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Trail List */}
      <div className="space-y-3">
        {filteredTrails.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No trails found</p>
          </div>
        ) : (
          filteredTrails.map((trail) => {
            const settings = getTrailSettings(trail.trailSettingsId)
            return (
              <div
                key={trail.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedTrail === trail.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedTrail(trail.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(trail.status)}
                    <div>
                      <div className="font-medium">Position {trail.positionId}</div>
                      <div className="text-sm text-gray-500">
                        {settings?.type} trail • {settings?.trailAmount} 
                        {settings?.type === 'percentage' ? '%' : ' pips'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-medium">
                        ${trail.profitSinceStart.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">
                        SL: {trail.currentStopLoss.toFixed(5)}
                      </div>
                    </div>
                    
                    <div className={`px-2 py-1 rounded text-sm border ${getStatusColor(trail.status)}`}>
                      {trail.status}
                    </div>
                    
                    <div className="flex space-x-1">
                      {trail.status === TRAIL_STATUS.ACTIVE && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onPause?.(trail.id)
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Pause trail"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      
                      {trail.status === TRAIL_STATUS.PAUSED && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onResume?.(trail.id)
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Resume trail"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      
                      {(trail.status === TRAIL_STATUS.ACTIVE || trail.status === TRAIL_STATUS.PAUSED) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onStop?.(trail.id)
                          }}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Stop trail"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Detailed info when selected */}
                {selectedTrail === trail.id && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Current Price:</span>
                        <div className="font-medium">{trail.currentPrice.toFixed(5)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Trail Distance:</span>
                        <div className="font-medium">{trail.trailDistance.toFixed(1)} pips</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Adjustments:</span>
                        <div className="font-medium">{trail.adjustmentCount}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Last Adjustment:</span>
                        <div className="font-medium">
                          {trail.lastAdjustment.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Next Check:</span>
                        <div className="font-medium">
                          {trail.nextCheckTime.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {trail.errorMessage && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        {trail.errorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { History, Filter, Download, Search, Calendar, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { TrailHistory, TrailSettings } from '../../types'

interface TrailHistoryProps {
  historyData?: TrailHistory[]
  trailSettings?: TrailSettings[]
  onFilter?: (filters: HistoryFilter) => void
  onExport?: (format: 'csv' | 'json') => void
  pageSize?: number
}

interface HistoryFilter {
  positionId?: string
  action?: string
  dateRange?: {
    start: Date
    end: Date
  }
  searchTerm?: string
}

export default function TrailHistoryComponent({
  historyData = [],
  trailSettings = [],
  onFilter,
  onExport,
  pageSize = 50
}: TrailHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<HistoryFilter>({})
  const [sortBy, setSortBy] = useState<'timestamp' | 'action' | 'profit'>('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)

  const handleFilterChange = useCallback((key: keyof HistoryFilter, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    setCurrentPage(1)
    onFilter?.(newFilters)
  }, [filters, onFilter])

  const handleSort = useCallback((field: 'timestamp' | 'action' | 'profit') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }, [sortBy, sortOrder])

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Activity className="w-4 h-4 text-blue-500" />
      case 'adjusted':
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'triggered':
        return <TrendingDown className="w-4 h-4 text-red-500" />
      case 'paused':
        return <span className="w-4 h-4 text-yellow-500">⏸</span>
      case 'resumed':
        return <span className="w-4 h-4 text-green-500">▶</span>
      case 'cancelled':
        return <span className="w-4 h-4 text-gray-500">✖</span>
      default:
        return <span className="w-4 h-4 text-gray-400">•</span>
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'text-blue-600 bg-blue-50'
      case 'adjusted':
        return 'text-green-600 bg-green-50'
      case 'triggered':
        return 'text-red-600 bg-red-50'
      case 'paused':
        return 'text-yellow-600 bg-yellow-50'
      case 'resumed':
        return 'text-green-600 bg-green-50'
      case 'cancelled':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const filteredAndSortedData = historyData
    .filter(entry => {
      if (filters.positionId && !entry.positionId.includes(filters.positionId)) return false
      if (filters.action && entry.action !== filters.action) return false
      if (filters.searchTerm && !entry.reason.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false
      if (filters.dateRange) {
        const entryDate = new Date(entry.timestamp)
        if (entryDate < filters.dateRange.start || entryDate > filters.dateRange.end) return false
      }
      return true
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime()
          break
        case 'action':
          comparison = a.action.localeCompare(b.action)
          break
        case 'profit':
          comparison = a.profit - b.profit
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize)

  const getTrailSettings = (trailSettingsId: string) => {
    return trailSettings.find(s => s.id === trailSettingsId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Trail History</h2>
          <span className="text-sm text-gray-500">
            ({filteredAndSortedData.length} entries)
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1 text-sm border rounded hover:bg-gray-50 ${
              showFilters ? 'bg-blue-50 border-blue-300' : ''
            }`}
          >
            <Filter className="w-4 h-4 inline mr-1" />
            Filters
          </button>
          <button
            onClick={() => onExport?.('csv')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Position ID</label>
              <input
                type="text"
                placeholder="Search position..."
                value={filters.positionId || ''}
                onChange={(e) => handleFilterChange('positionId', e.target.value)}
                className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <select
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
                className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All actions</option>
                <option value="created">Created</option>
                <option value="adjusted">Adjusted</option>
                <option value="triggered">Triggered</option>
                <option value="paused">Paused</option>
                <option value="resumed">Resumed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reason..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Date Range</label>
              <div className="flex space-x-1">
                <input
                  type="date"
                  className="flex-1 p-1 text-xs border rounded"
                  onChange={(e) => {
                    const start = new Date(e.target.value)
                    handleFilterChange('dateRange', {
                      start,
                      end: filters.dateRange?.end || new Date()
                    })
                  }}
                />
                <input
                  type="date"
                  className="flex-1 p-1 text-xs border rounded"
                  onChange={(e) => {
                    const end = new Date(e.target.value)
                    handleFilterChange('dateRange', {
                      start: filters.dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                      end
                    })
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => {
                setFilters({})
                onFilter?.({})
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Action</th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Time</span>
                    {sortBy === 'timestamp' && (
                      <span className="text-blue-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Position</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Price</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Stop Loss</th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('profit')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Profit</span>
                    {sortBy === 'profit' && (
                      <span className="text-blue-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No history entries found</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => {
                  const settings = getTrailSettings(entry.trailSettingsId)
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedEntry === entry.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {getActionIcon(entry.action)}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                            {entry.action}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.timestamp.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {entry.positionId}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {entry.price.toFixed(5)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {entry.oldStopLoss && entry.newStopLoss ? (
                          <div>
                            <div className="text-gray-500 line-through">
                              {entry.oldStopLoss.toFixed(5)}
                            </div>
                            <div className="text-green-600 font-medium">
                              {entry.newStopLoss.toFixed(5)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-medium ${
                          entry.profit > 0 ? 'text-green-600' : 
                          entry.profit < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          ${entry.profit.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.reason}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredAndSortedData.length)} of{' '}
              {filteredAndSortedData.length} entries
            </div>
            
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm border rounded hover:bg-gray-100 ${
                      currentPage === page ? 'bg-blue-100 border-blue-300' : ''
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed View */}
      {selectedEntry && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          {(() => {
            const entry = historyData.find(e => e.id === selectedEntry)
            if (!entry) return null
            
            return (
              <div>
                <h3 className="font-semibold mb-3">Entry Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Trail Settings ID:</span>
                    <div className="font-mono">{entry.trailSettingsId}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Position ID:</span>
                    <div className="font-mono">{entry.positionId}</div>
                  </div>
                </div>
                
                {entry.metadata && (
                  <div className="mt-3">
                    <span className="text-gray-600">Metadata:</span>
                    <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-x-auto">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
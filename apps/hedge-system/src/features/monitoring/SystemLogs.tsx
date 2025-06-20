'use client'

import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  id: string
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  category: string
  message: string
  source?: string
  metadata?: Record<string, any>
}

interface SystemLogsProps {
  logs: LogEntry[]
  onClear?: () => void
  onExport?: () => void
  className?: string
  maxEntries?: number
}

export function SystemLogs({ 
  logs, 
  onClear, 
  onExport,
  className = '',
  maxEntries = 1000
}: SystemLogsProps) {
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterText, setFilterText] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const lastLogCountRef = useRef<number>(0)

  // ログの自動スクロール
  useEffect(() => {
    if (autoScroll && !isPaused && logsContainerRef.current) {
      const container = logsContainerRef.current
      const shouldScroll = 
        container.scrollTop + container.clientHeight >= container.scrollHeight - 100

      if (shouldScroll || logs.length > lastLogCountRef.current) {
        container.scrollTop = container.scrollHeight
      }
    }
    lastLogCountRef.current = logs.length
  }, [logs, autoScroll, isPaused])

  // フィルタリングされたログ
  const filteredLogs = logs.filter(log => {
    // レベルフィルター
    if (filterLevel !== 'all' && log.level !== filterLevel) {
      return false
    }

    // カテゴリフィルター
    if (filterCategory !== 'all' && log.category !== filterCategory) {
      return false
    }

    // テキストフィルター
    if (filterText) {
      const searchText = filterText.toLowerCase()
      return (
        log.message.toLowerCase().includes(searchText) ||
        log.category.toLowerCase().includes(searchText) ||
        (log.source && log.source.toLowerCase().includes(searchText))
      )
    }

    return true
  }).slice(-maxEntries) // 最新のエントリのみ保持

  // 利用可能なカテゴリ
  const categories = Array.from(new Set(logs.map(log => log.category))).sort()

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'debug': return 'text-gray-600 bg-gray-100'
      case 'info': return 'text-blue-600 bg-blue-100'
      case 'warn': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      case 'fatal': return 'text-red-900 bg-red-200'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'debug': return '🐛'
      case 'info': return 'ℹ️'
      case 'warn': return '⚠️'
      case 'error': return '❌'
      case 'fatal': return '💀'
      default: return '📝'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    }).format(timestamp)
  }

  const formatMessage = (message: string) => {
    // 長いメッセージの場合は省略
    if (message.length > 200) {
      return message.substring(0, 200) + '...'
    }
    return message
  }

  const exportLogs = () => {
    const exportData = filteredLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      category: log.category,
      message: log.message,
      source: log.source,
      metadata: log.metadata
    }))

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    onExport?.()
  }

  const handleMouseEnter = () => setIsPaused(true)
  const handleMouseLeave = () => setIsPaused(false)

  // ログレベル統計
  const stats = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">システムログ</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportLogs}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
            >
              エクスポート
            </button>
            <button
              onClick={onClear}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
            >
              クリア
            </button>
          </div>
        </div>
      </div>

      {/* 統計とフィルター */}
      <div className="p-4 border-b bg-blue-50">
        {/* 統計 */}
        <div className="flex items-center space-x-4 mb-3">
          <div className="text-sm">
            <span className="text-gray-600">総ログ数: </span>
            <span className="font-medium">{logs.length}</span>
          </div>
          {Object.entries(stats).map(([level, count]) => (
            <div key={level} className="text-sm">
              <span className="text-gray-600">{level}: </span>
              <span className={`font-medium ${
                level === 'error' || level === 'fatal' ? 'text-red-600' :
                level === 'warn' ? 'text-yellow-600' : 'text-gray-800'
              }`}>
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* フィルター */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">レベル:</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">すべて</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">カテゴリ:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">すべて</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">検索:</label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="メッセージを検索..."
              className="border rounded px-2 py-1 text-sm w-48"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="mr-2"
              />
              自動スクロール
            </label>
          </div>

          <div className="text-sm text-gray-600">
            {filteredLogs.length} / {logs.length} 表示中
          </div>
        </div>
      </div>

      {/* ログ表示エリア */}
      <div 
        ref={logsContainerRef}
        className="h-96 overflow-auto font-mono text-sm"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📋</div>
              <p>表示するログがありません</p>
              {logs.length > 0 && (
                <p className="text-sm">フィルター条件を変更してください</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {filteredLogs.map((log, index) => (
              <LogEntryRow 
                key={`${log.id}-${index}`} 
                log={log} 
                getLevelColor={getLevelColor}
                getLevelIcon={getLevelIcon}
                formatTimestamp={formatTimestamp}
                formatMessage={formatMessage}
              />
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      {filteredLogs.length > 0 && (
        <div className="p-4 border-t bg-gray-50 text-sm">
          <div className="flex justify-between items-center">
            <div className="text-gray-600">
              最新ログ: {formatTimestamp(filteredLogs[filteredLogs.length - 1]?.timestamp || new Date())}
            </div>
            <div className="flex items-center space-x-4">
              {isPaused && (
                <span className="text-yellow-600">⏸️ 一時停止中</span>
              )}
              <span className="text-gray-600">
                メモリ使用量: {Math.round(JSON.stringify(logs).length / 1024)}KB
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ログエントリ行コンポーネント
interface LogEntryRowProps {
  log: LogEntry
  getLevelColor: (level: LogEntry['level']) => string
  getLevelIcon: (level: LogEntry['level']) => string
  formatTimestamp: (timestamp: Date) => string
  formatMessage: (message: string) => string
}

function LogEntryRow({ 
  log, 
  getLevelColor, 
  getLevelIcon, 
  formatTimestamp, 
  formatMessage 
}: LogEntryRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0
  const isLongMessage = log.message.length > 200

  return (
    <div className={`
      border-l-4 pl-3 py-1 hover:bg-gray-50 transition-colors
      ${log.level === 'error' || log.level === 'fatal' ? 'border-red-500 bg-red-50' :
        log.level === 'warn' ? 'border-yellow-500 bg-yellow-50' :
        log.level === 'info' ? 'border-blue-500' : 'border-gray-300'}
    `}>
      <div className="flex items-start space-x-3">
        {/* タイムスタンプ */}
        <div className="text-gray-500 text-xs w-20 flex-shrink-0 mt-0.5">
          {formatTimestamp(log.timestamp)}
        </div>

        {/* レベル */}
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
            <span className="mr-1">{getLevelIcon(log.level)}</span>
            {log.level.toUpperCase()}
          </span>
        </div>

        {/* カテゴリ */}
        <div className="text-gray-600 text-xs w-24 flex-shrink-0 mt-0.5">
          {log.category}
        </div>

        {/* メッセージ */}
        <div className="flex-1 min-w-0">
          <div className="break-words">
            {isExpanded || !isLongMessage 
              ? log.message 
              : formatMessage(log.message)
            }
          </div>
          
          {log.source && (
            <div className="text-gray-500 text-xs mt-1">
              ソース: {log.source}
            </div>
          )}

          {/* 展開/折りたたみボタン */}
          {(isLongMessage || hasMetadata) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800 text-xs mt-1"
            >
              {isExpanded ? '折りたたむ' : '詳細を表示'}
            </button>
          )}

          {/* メタデータ */}
          {isExpanded && hasMetadata && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
              <pre className="whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
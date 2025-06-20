'use client'

import { useState, useCallback } from 'react'
import { Account, Position } from '../types'

interface EmergencyActionsProps {
  account: Account
  onAction: (accountId: string, action: EmergencyAction) => Promise<void>
  disabled?: boolean
}

export interface EmergencyAction {
  type: 'partial_close' | 'close_all' | 'hedge_positions' | 'reduce_lots' | 'add_margin'
  parameters?: {
    positionIds?: string[]
    percentage?: number
    amount?: number
    symbol?: string
  }
  confirmRequired?: boolean
}

export function EmergencyActions({ account, onAction, disabled = false }: EmergencyActionsProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [confirmAction, setConfirmAction] = useState<EmergencyAction | null>(null)
  const [lastActionTime, setLastActionTime] = useState<Date | null>(null)

  // アクション実行の制限（連続実行を防ぐ）
  const canExecuteAction = useCallback(() => {
    if (isExecuting) return false
    if (lastActionTime && Date.now() - lastActionTime.getTime() < 5000) return false
    return true
  }, [isExecuting, lastActionTime])

  const executeAction = useCallback(async (action: EmergencyAction) => {
    if (!canExecuteAction() || disabled) return

    setIsExecuting(true)
    try {
      await onAction(account.id, action)
      setLastActionTime(new Date())
    } catch (error) {
      console.error('Emergency action failed:', error)
    } finally {
      setIsExecuting(false)
      setConfirmAction(null)
    }
  }, [account.id, onAction, canExecuteAction, disabled])

  const requestConfirmation = (action: EmergencyAction) => {
    if (action.confirmRequired !== false) {
      setConfirmAction(action)
    } else {
      executeAction(action)
    }
  }

  // 部分決済（最も損失の大きいポジション）
  const handlePartialClose = () => {
    const lossPositions = account.positions
      .filter(p => p.profit < 0)
      .sort((a, b) => a.profit - b.profit)

    const positionsToClose = lossPositions.slice(0, Math.max(1, Math.floor(lossPositions.length / 2)))

    requestConfirmation({
      type: 'partial_close',
      parameters: {
        positionIds: positionsToClose.map(p => p.id)
      },
      confirmRequired: true
    })
  }

  // 全決済
  const handleCloseAll = () => {
    requestConfirmation({
      type: 'close_all',
      confirmRequired: true
    })
  }

  // 両建て実行
  const handleHedgePositions = () => {
    requestConfirmation({
      type: 'hedge_positions',
      confirmRequired: true
    })
  }

  // ロット削減
  const handleReduceLots = (percentage: number) => {
    requestConfirmation({
      type: 'reduce_lots',
      parameters: {
        percentage
      },
      confirmRequired: true
    })
  }

  // 証拠金追加（入金指示）
  const handleAddMargin = () => {
    const requiredAmount = account.margin * 0.5 // 証拠金の50%を追加
    requestConfirmation({
      type: 'add_margin',
      parameters: {
        amount: requiredAmount
      },
      confirmRequired: false // 入金指示は即座に実行
    })
  }

  const getActionLabel = (actionType: EmergencyAction['type']) => {
    switch (actionType) {
      case 'partial_close': return '部分決済'
      case 'close_all': return '全決済'
      case 'hedge_positions': return '両建て実行'
      case 'reduce_lots': return 'ロット削減'
      case 'add_margin': return '証拠金追加'
      default: return '不明'
    }
  }

  const getActionDescription = (action: EmergencyAction) => {
    switch (action.type) {
      case 'partial_close':
        return `${action.parameters?.positionIds?.length || 0}個のポジションを決済します`
      case 'close_all':
        return `${account.positions.length}個の全ポジションを決済します`
      case 'hedge_positions':
        return `全ポジションに対して両建てを実行します`
      case 'reduce_lots':
        return `全ポジションのロット数を${action.parameters?.percentage || 50}%削減します`
      case 'add_margin':
        return `${action.parameters?.amount?.toFixed(2) || 0}の入金指示を送信します`
      default:
        return '不明な操作です'
    }
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  return (
    <div className="space-y-4">
      {/* 緊急度の高いアクション */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="font-medium text-red-800 mb-3 flex items-center">
          🚨 緊急アクション
          {isExecuting && (
            <span className="ml-2 text-xs bg-red-600 text-white px-2 py-1 rounded animate-pulse">
              実行中...
            </span>
          )}
        </h4>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={handlePartialClose}
            disabled={disabled || !canExecuteAction() || account.positions.filter(p => p.profit < 0).length === 0}
            className="w-full bg-orange-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            部分決済実行
            <div className="text-xs opacity-75">
              {account.positions.filter(p => p.profit < 0).length}個の損失ポジション
            </div>
          </button>

          <button
            onClick={handleHedgePositions}
            disabled={disabled || !canExecuteAction() || account.positions.length === 0}
            className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            緊急両建て
            <div className="text-xs opacity-75">
              {account.positions.length}個のポジション
            </div>
          </button>

          <button
            onClick={handleCloseAll}
            disabled={disabled || !canExecuteAction() || account.positions.length === 0}
            className="w-full bg-red-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            全ポジション決済
            <div className="text-xs opacity-75">
              {account.positions.length}個すべて
            </div>
          </button>
        </div>
      </div>

      {/* 予防的アクション */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-3">⚡ 予防的アクション</h4>

        <div className="space-y-2">
          <div className="flex space-x-2">
            <button
              onClick={() => handleReduceLots(25)}
              disabled={disabled || !canExecuteAction()}
              className="flex-1 bg-yellow-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              25%削減
            </button>
            <button
              onClick={() => handleReduceLots(50)}
              disabled={disabled || !canExecuteAction()}
              className="flex-1 bg-yellow-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              50%削減
            </button>
          </div>

          <button
            onClick={handleAddMargin}
            disabled={disabled || !canExecuteAction()}
            className="w-full bg-green-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            入金指示送信
            <div className="text-xs opacity-75">
              推奨額: {formatNumber(account.margin * 0.5)}
            </div>
          </button>
        </div>
      </div>

      {/* ポジション個別操作 */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-3">📊 ポジション個別操作</h4>
        
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {account.positions.map((position) => (
            <div key={position.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
              <div className="flex items-center space-x-2">
                <span className="font-medium">{position.symbol}</span>
                <span className={`px-1 text-xs rounded ${
                  position.type === 'buy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {position.type.toUpperCase()}
                </span>
                <span className="text-gray-600">{position.lots}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`font-medium ${
                  position.profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatNumber(position.profit)}
                </span>
                <button
                  onClick={() => requestConfirmation({
                    type: 'partial_close',
                    parameters: { positionIds: [position.id] },
                    confirmRequired: true
                  })}
                  disabled={disabled || !canExecuteAction()}
                  className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  決済
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 実行制限の表示 */}
      {lastActionTime && (
        <div className="text-xs text-gray-500 text-center">
          最終実行: {lastActionTime.toLocaleTimeString()}
          {Date.now() - lastActionTime.getTime() < 5000 && (
            <span className="ml-2 text-orange-600">
              (5秒待機中)
            </span>
          )}
        </div>
      )}

      {/* 確認ダイアログ */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-800">
              🚨 緊急アクション確認
            </h3>
            
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">実行するアクション:</div>
              <div className="font-medium">{getActionLabel(confirmAction.type)}</div>
              <div className="text-sm text-gray-600 mt-1">
                {getActionDescription(confirmAction)}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <div className="text-sm text-yellow-800">
                <strong>警告:</strong> この操作は取り消すことができません。
                アカウント「{account.broker} - {account.accountNumber}」に対して実行されます。
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeAction(confirmAction)}
                disabled={isExecuting}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isExecuting ? '実行中...' : '実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 緊急アクションの履歴表示コンポーネント
interface EmergencyActionHistoryProps {
  accountId: string
}

export function EmergencyActionHistory({ accountId }: EmergencyActionHistoryProps) {
  const [history, setHistory] = useState<Array<{
    id: string
    action: EmergencyAction
    timestamp: Date
    status: 'success' | 'failed' | 'pending'
    result?: string
  }>>([])

  return (
    <div className="bg-white border rounded-lg p-4">
      <h4 className="font-medium mb-3">緊急アクション履歴</h4>
      
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {history.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            アクション履歴はありません
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <div>
                <div className="font-medium">{getActionLabel(item.action.type)}</div>
                <div className="text-xs text-gray-600">
                  {item.timestamp.toLocaleString()}
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                item.status === 'success' ? 'bg-green-100 text-green-600' :
                item.status === 'failed' ? 'bg-red-100 text-red-600' :
                'bg-yellow-100 text-yellow-600'
              }`}>
                {item.status === 'success' ? '成功' :
                 item.status === 'failed' ? '失敗' : '実行中'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )

  function getActionLabel(type: EmergencyAction['type']) {
    switch (type) {
      case 'partial_close': return '部分決済'
      case 'close_all': return '全決済'
      case 'hedge_positions': return '両建て'
      case 'reduce_lots': return 'ロット削減'
      case 'add_margin': return '入金指示'
      default: return '不明'
    }
  }
}
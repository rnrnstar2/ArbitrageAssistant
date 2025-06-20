'use client'

import { useState, useMemo, useEffect } from 'react'
import { Account, LossCutPrediction } from '../types'

interface LossCutMonitorProps {
  accounts: Account[]
  lossCutPredictions: LossCutPrediction[]
  onEmergencyAction?: (accountId: string, action: string) => void
}

export function LossCutMonitor({ 
  accounts, 
  lossCutPredictions, 
  onEmergencyAction 
}: LossCutMonitorProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false)

  // 危険なアカウントのソート
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const predA = lossCutPredictions.find(p => p.accountId === a.id)
      const predB = lossCutPredictions.find(p => p.accountId === b.id)
      
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const riskA = predA ? riskOrder[predA.riskLevel] : 3
      const riskB = predB ? riskOrder[predB.riskLevel] : 3
      
      if (riskA !== riskB) return riskA - riskB
      return a.marginLevel - b.marginLevel
    })
  }, [accounts, lossCutPredictions])

  // 危険なアカウント数
  const riskStats = useMemo(() => {
    const stats = { critical: 0, high: 0, medium: 0, low: 0, safe: 0 }
    
    lossCutPredictions.forEach(pred => {
      stats[pred.riskLevel]++
    })
    
    stats.safe = accounts.length - lossCutPredictions.length
    
    return stats
  }, [accounts, lossCutPredictions])

  // 自動的に最も危険なアカウントを選択
  useEffect(() => {
    const criticalAccount = sortedAccounts.find(acc => {
      const pred = lossCutPredictions.find(p => p.accountId === acc.id)
      return pred?.riskLevel === 'critical'
    })
    
    if (criticalAccount && !selectedAccountId) {
      setSelectedAccountId(criticalAccount.id)
      setShowEmergencyPanel(true)
    }
  }, [sortedAccounts, lossCutPredictions, selectedAccountId])

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)
  const selectedPrediction = lossCutPredictions.find(pred => pred.accountId === selectedAccountId)

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-300'
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-300'
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300'
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-300'
      default: return 'text-green-600 bg-green-100 border-green-300'
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}分`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    return `${hours}時間${remainingMinutes}分`
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-red-800">ロスカット監視</h3>
          <div className="flex items-center space-x-4">
            {/* リスク統計 */}
            <div className="flex items-center space-x-2 text-sm">
              {riskStats.critical > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-medium">
                  緊急: {riskStats.critical}
                </span>
              )}
              {riskStats.high > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                  警告: {riskStats.high}
                </span>
              )}
              {riskStats.medium > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                  注意: {riskStats.medium}
                </span>
              )}
            </div>
            
            <button
              onClick={() => setShowEmergencyPanel(!showEmergencyPanel)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                riskStats.critical > 0 || riskStats.high > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              緊急対応パネル
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* アカウントリスト */}
        <div className="w-1/2 border-r">
          <div className="p-4">
            <h4 className="font-medium mb-3">リスク順アカウント一覧</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sortedAccounts.map((account) => {
                const prediction = lossCutPredictions.find(p => p.accountId === account.id)
                const riskLevel = prediction?.riskLevel || 'safe'
                const isSelected = selectedAccountId === account.id
                
                return (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`
                      p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected ? 'ring-2 ring-blue-500' : ''}
                      ${getRiskColor(riskLevel)}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">
                          {account.broker} - {account.accountNumber}
                        </div>
                        <div className="text-xs opacity-75">
                          証拠金維持率: {formatNumber(account.marginLevel, 1)}%
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xs font-medium">
                          {riskLevel === 'critical' ? '🚨' : 
                           riskLevel === 'high' ? '⚠️' : 
                           riskLevel === 'medium' ? '⚡' : 
                           riskLevel === 'low' ? 'ℹ️' : '✅'}
                        </div>
                        {prediction?.estimatedTimeToLossCut !== undefined && (
                          <div className="text-xs">
                            {prediction.estimatedTimeToLossCut > 0 
                              ? formatTime(prediction.estimatedTimeToLossCut)
                              : '即座'
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 証拠金維持率バー */}
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            account.marginLevel > 200 ? 'bg-green-500' :
                            account.marginLevel > 100 ? 'bg-yellow-500' :
                            account.marginLevel > 50 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, (account.marginLevel / 300) * 100)}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1 opacity-75">
                        <span>0%</span>
                        <span>300%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 詳細パネル */}
        <div className="w-1/2">
          {selectedAccount && selectedPrediction ? (
            <LossCutDetails 
              account={selectedAccount}
              prediction={selectedPrediction}
              onEmergencyAction={onEmergencyAction}
            />
          ) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>アカウントを選択してください</p>
              <p className="text-sm">詳細な分析情報が表示されます</p>
            </div>
          )}
        </div>
      </div>

      {/* 緊急対応パネル */}
      {showEmergencyPanel && (
        <EmergencyActionPanel
          accounts={accounts.filter(acc => {
            const pred = lossCutPredictions.find(p => p.accountId === acc.id)
            return pred?.riskLevel === 'critical' || pred?.riskLevel === 'high'
          })}
          onAction={onEmergencyAction}
          onClose={() => setShowEmergencyPanel(false)}
        />
      )}
    </div>
  )
}

// ロスカット詳細コンポーネント
interface LossCutDetailsProps {
  account: Account
  prediction: LossCutPrediction
  onEmergencyAction?: (accountId: string, action: string) => void
}

function LossCutDetails({ account, prediction, onEmergencyAction }: LossCutDetailsProps) {
  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}分`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    return `${hours}時間${remainingMinutes}分`
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h4 className="font-medium mb-2">
          {account.broker} - {account.accountNumber}
        </h4>
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
          prediction.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
          prediction.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
          prediction.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          リスクレベル: {
            prediction.riskLevel === 'critical' ? '緊急' :
            prediction.riskLevel === 'high' ? '高' :
            prediction.riskLevel === 'medium' ? '中' : '低'
          }
        </div>
      </div>

      {/* アカウント情報 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">残高:</span>
            <span className="ml-2 font-medium">{formatNumber(account.balance)}</span>
          </div>
          <div>
            <span className="text-gray-600">有効証拠金:</span>
            <span className="ml-2 font-medium">{formatNumber(account.equity)}</span>
          </div>
          <div>
            <span className="text-gray-600">必要証拠金:</span>
            <span className="ml-2 font-medium">{formatNumber(account.margin)}</span>
          </div>
          <div>
            <span className="text-gray-600">ボーナス:</span>
            <span className="ml-2 font-medium text-blue-600">{formatNumber(account.bonusAmount)}</span>
          </div>
        </div>

        {/* 証拠金維持率ゲージ */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">証拠金維持率</span>
            <span className={`text-lg font-bold ${
              account.marginLevel > 200 ? 'text-green-600' :
              account.marginLevel > 100 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {formatNumber(account.marginLevel, 1)}%
            </span>
          </div>
          
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  account.marginLevel > 200 ? 'bg-green-500' :
                  account.marginLevel > 100 ? 'bg-yellow-500' :
                  account.marginLevel > 50 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (account.marginLevel / 300) * 100)}%` 
                }}
              />
            </div>
            
            {/* ロスカットラインマーカー */}
            <div 
              className="absolute top-0 h-4 w-1 bg-red-600"
              style={{ left: `${(prediction.lossCutLevel / 300) * 100}%` }}
            >
              <div className="absolute -top-6 -left-8 text-xs text-red-600 font-medium">
                LC: {prediction.lossCutLevel}%
              </div>
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>150%</span>
            <span>300%</span>
          </div>
        </div>

        {/* 予測情報 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h5 className="font-medium mb-2">ロスカット予測</h5>
          <div className="space-y-2 text-sm">
            {prediction.estimatedTimeToLossCut !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">予想時間:</span>
                <span className={`font-medium ${
                  prediction.estimatedTimeToLossCut === 0 ? 'text-red-600' :
                  prediction.estimatedTimeToLossCut < 60 ? 'text-orange-600' : 'text-yellow-600'
                }`}>
                  {prediction.estimatedTimeToLossCut === 0 
                    ? '即座' 
                    : formatTime(prediction.estimatedTimeToLossCut)
                  }
                </span>
              </div>
            )}
            
            {prediction.requiredDeposit !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">必要入金額:</span>
                <span className="font-medium text-blue-600">
                  {formatNumber(prediction.requiredDeposit)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 緊急アクション */}
        {(prediction.riskLevel === 'critical' || prediction.riskLevel === 'high') && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h5 className="font-medium text-red-800 mb-2">緊急アクション</h5>
            <div className="space-y-2">
              <button
                onClick={() => onEmergencyAction?.(account.id, 'partial_close')}
                className="w-full bg-orange-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-orange-700"
              >
                部分決済実行
              </button>
              <button
                onClick={() => onEmergencyAction?.(account.id, 'hedge_positions')}
                className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-blue-700"
              >
                両建て実行
              </button>
              <button
                onClick={() => onEmergencyAction?.(account.id, 'close_all')}
                className="w-full bg-red-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-red-700"
              >
                全ポジション決済
              </button>
            </div>
          </div>
        )}

        {/* ポジション一覧 */}
        <div>
          <h5 className="font-medium mb-2">保有ポジション ({account.positions.length})</h5>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {account.positions.map((position) => (
              <div key={position.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{position.symbol}</span>
                  <span className={`ml-2 px-1 text-xs rounded ${
                    position.type === 'buy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {position.type.toUpperCase()}
                  </span>
                  <span className="ml-2 text-gray-600">{position.lots}</span>
                </div>
                <div className={`font-medium ${
                  position.profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatNumber(position.profit)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 緊急対応パネルコンポーネント
interface EmergencyActionPanelProps {
  accounts: Account[]
  onAction?: (accountId: string, action: string) => void
  onClose: () => void
}

function EmergencyActionPanel({ accounts, onAction, onClose }: EmergencyActionPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [confirmAction, setConfirmAction] = useState(false)

  const actions = [
    { id: 'partial_close', label: '部分決済実行', description: '最も損失の大きいポジションを決済', color: 'bg-orange-600' },
    { id: 'hedge_positions', label: '緊急両建て', description: '全ポジションに対して両建て実行', color: 'bg-blue-600' },
    { id: 'close_all', label: '全決済実行', description: 'すべてのポジションを即座に決済', color: 'bg-red-600' },
    { id: 'reduce_lots', label: 'ロット削減', description: 'ポジションサイズを50%削減', color: 'bg-yellow-600' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 border-b bg-red-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-red-800">🚨 緊急対応パネル</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-red-600 mt-1">
            {accounts.length}個のアカウントが危険な状態です
          </p>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* アクション選択 */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">緊急アクションを選択</h4>
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setSelectedAction(action.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedAction === action.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`inline-block px-2 py-1 rounded text-white text-xs font-medium mb-2 ${action.color}`}>
                    {action.label}
                  </div>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 対象アカウント */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">対象アカウント</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{account.broker} - {account.accountNumber}</span>
                    <span className="ml-2 text-sm text-gray-600">
                      証拠金維持率: {account.marginLevel.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-sm font-medium text-red-600">
                    {account.positions.length} ポジション
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 確認チェックボックス */}
          {selectedAction && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={confirmAction}
                  onChange={(e) => setConfirmAction(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>警告:</strong> この操作は取り消すことができません。
                  {accounts.length}個のアカウントに対して「{actions.find(a => a.id === selectedAction)?.label}」を実行することを理解し、同意します。
                </span>
              </label>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              if (selectedAction && confirmAction) {
                accounts.forEach(account => {
                  onAction?.(account.id, selectedAction)
                })
                onClose()
              }
            }}
            disabled={!selectedAction || !confirmAction}
            className={`px-4 py-2 rounded font-medium ${
              selectedAction && confirmAction
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            緊急実行
          </button>
        </div>
      </div>
    </div>
  )
}
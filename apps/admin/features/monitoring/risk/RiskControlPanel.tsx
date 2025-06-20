'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { Account } from '../types'
import { 
  Power, 
  Hand, 
  Shield, 
  Settings,
  AlertTriangle,
  Users,
  Activity,
  Clock,
  CheckCircle,
  X,
  RotateCcw
} from 'lucide-react'

interface EmergencyAction {
  id: string
  label: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  iconColor: string
  confirmRequired: boolean
  multiAccount?: boolean
}

interface RiskControlPanelProps {
  accounts: Account[]
  isSystemActive?: boolean
  selectedAccountIds?: string[]
  onEmergencyStop?: () => void
  onManualIntervention?: (accountIds: string[], action: string) => void
  onSystemToggle?: (active: boolean) => void
  onSettingsOpen?: () => void
}

export function RiskControlPanel({
  accounts,
  isSystemActive = true,
  selectedAccountIds = [],
  onEmergencyStop,
  onManualIntervention,
  onSystemToggle,
  onSettingsOpen
}: RiskControlPanelProps) {
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)

  // 緊急時アクション定義
  const emergencyActions: EmergencyAction[] = [
    {
      id: 'emergency_stop',
      label: '緊急システム停止',
      description: 'すべての自動取引を即座に停止し、新規注文を無効化',
      severity: 'critical',
      iconColor: 'text-red-600',
      confirmRequired: true,
      multiAccount: true
    },
    {
      id: 'partial_close',
      label: '部分決済実行',
      description: '最も損失の大きいポジションを50%決済',
      severity: 'high',
      iconColor: 'text-orange-600',
      confirmRequired: true,
      multiAccount: false
    },
    {
      id: 'hedge_all',
      label: '緊急両建て',
      description: 'すべてのオープンポジションに両建てを実行',
      severity: 'high',
      iconColor: 'text-blue-600',
      confirmRequired: true,
      multiAccount: false
    },
    {
      id: 'close_all',
      label: '全ポジション決済',
      description: 'すべてのポジションを市場価格で即座に決済',
      severity: 'critical',
      iconColor: 'text-red-600',
      confirmRequired: true,
      multiAccount: false
    },
    {
      id: 'reduce_lots',
      label: 'ロット数削減',
      description: 'すべてのポジションのロット数を50%削減',
      severity: 'medium',
      iconColor: 'text-yellow-600',
      confirmRequired: false,
      multiAccount: false
    },
    {
      id: 'pause_ea',
      label: 'EA一時停止',
      description: '自動売買システムを一時的に停止（ポジションは維持）',
      severity: 'low',
      iconColor: 'text-gray-600',
      confirmRequired: false,
      multiAccount: true
    }
  ]

  // 対象アカウントの統計
  const targetAccounts = useMemo(() => {
    if (selectedAccountIds.length === 0) return accounts
    return accounts.filter(account => selectedAccountIds.includes(account.id))
  }, [accounts, selectedAccountIds])

  const accountStats = useMemo(() => {
    return {
      total: targetAccounts.length,
      critical: targetAccounts.filter(acc => acc.marginLevel <= 50).length,
      warning: targetAccounts.filter(acc => acc.marginLevel <= 100 && acc.marginLevel > 50).length,
      totalPositions: targetAccounts.reduce((sum, acc) => sum + acc.positions.length, 0)
    }
  }, [targetAccounts])

  const handleActionSelect = (actionId: string) => {
    setSelectedAction(actionId)
    const action = emergencyActions.find(a => a.id === actionId)
    if (action?.confirmRequired) {
      setShowEmergencyDialog(true)
    } else {
      executeAction(actionId)
    }
  }

  const executeAction = async (actionId: string) => {
    setIsExecuting(true)
    
    try {
      if (actionId === 'emergency_stop') {
        await onEmergencyStop?.()
      } else {
        const targetIds = selectedAccountIds.length > 0 ? selectedAccountIds : accounts.map(a => a.id)
        await onManualIntervention?.(targetIds, actionId)
      }
      
      // 成功メッセージ（実際の実装では通知システムを使用）
      console.log(`Action ${actionId} executed successfully`)
      
    } catch (error) {
      console.error('Action execution failed:', error)
    } finally {
      setIsExecuting(false)
      setShowEmergencyDialog(false)
      setSelectedAction(null)
      setConfirmText('')
    }
  }

  const getActionIcon = (action: EmergencyAction) => {
    switch (action.id) {
      case 'emergency_stop': return <Power className={`h-5 w-5 ${action.iconColor}`} />
      case 'partial_close': return <Activity className={`h-5 w-5 ${action.iconColor}`} />
      case 'hedge_all': return <Shield className={`h-5 w-5 ${action.iconColor}`} />
      case 'close_all': return <X className={`h-5 w-5 ${action.iconColor}`} />
      case 'reduce_lots': return <RotateCcw className={`h-5 w-5 ${action.iconColor}`} />
      case 'pause_ea': return <Hand className={`h-5 w-5 ${action.iconColor}`} />
      default: return <AlertTriangle className={`h-5 w-5 ${action.iconColor}`} />
    }
  }

  const getSeverityBadge = (severity: EmergencyAction['severity']) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">緊急</Badge>
      case 'high': return <Badge variant="secondary" className="bg-orange-100 text-orange-800">重要</Badge>
      case 'medium': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">警告</Badge>
      default: return <Badge variant="outline">情報</Badge>
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Shield className="h-5 w-5 mr-2 text-blue-500" />
              リスク制御パネル
            </CardTitle>
            
            <div className="flex items-center space-x-3">
              <Badge variant={isSystemActive ? "default" : "secondary"}>
                {isSystemActive ? 'システム稼働中' : 'システム停止中'}
              </Badge>
              
              <button
                onClick={onSettingsOpen}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <Settings className="h-4 w-4 mr-1" />
                設定
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* システム状態と統計 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{accountStats.total}</div>
              <div className="text-xs text-gray-600">対象口座</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{accountStats.critical}</div>
              <div className="text-xs text-gray-600">緊急状態</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{accountStats.warning}</div>
              <div className="text-xs text-gray-600">警告状態</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{accountStats.totalPositions}</div>
              <div className="text-xs text-gray-600">総ポジション</div>
            </div>
          </div>

          {/* システム制御 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <Power className={`h-6 w-6 ${isSystemActive ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <div className="font-medium">システム制御</div>
                  <div className="text-sm text-gray-600">
                    自動取引システムの稼働状態を制御
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onSystemToggle?.(!isSystemActive)}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  isSystemActive 
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isSystemActive ? 'システム停止' : 'システム開始'}
              </button>
            </div>

            {/* 緊急アクション */}
            <div>
              <h4 className="font-medium mb-3 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                緊急アクション
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {emergencyActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionSelect(action.id)}
                    disabled={isExecuting}
                    className={`
                      p-3 text-left rounded-lg border-2 transition-all
                      ${action.severity === 'critical' ? 'border-red-300 hover:border-red-500 hover:bg-red-50' :
                        action.severity === 'high' ? 'border-orange-300 hover:border-orange-500 hover:bg-orange-50' :
                        action.severity === 'medium' ? 'border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50' :
                        'border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                      }
                      ${isExecuting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getActionIcon(action)}
                        <span className="font-medium text-sm">{action.label}</span>
                      </div>
                      {getSeverityBadge(action.severity)}
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2">
                      {action.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {action.multiAccount ? `${accountStats.total}口座対象` : '選択口座のみ'}
                      </span>
                      {action.confirmRequired && (
                        <span className="text-orange-600">確認必要</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 緊急アクション確認ダイアログ */}
      {showEmergencyDialog && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-4 border-b bg-red-50">
              <div className="flex items-center">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                <h3 className="text-lg font-semibold text-red-800">
                  緊急アクション確認
                </h3>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {(() => {
                const action = emergencyActions.find(a => a.id === selectedAction)
                return action ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        {getActionIcon(action)}
                        <div>
                          <div className="font-medium">{action.label}</div>
                          <div className="text-sm text-gray-600">{action.description}</div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="text-sm text-yellow-800">
                          <div className="font-medium mb-1">影響範囲:</div>
                          <ul className="list-disc list-inside space-y-1">
                            <li>{accountStats.total}個の口座</li>
                            <li>{accountStats.totalPositions}個のポジション</li>
                            {action.id === 'emergency_stop' && (
                              <li>すべての自動取引が停止されます</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          確認のため「{action.label}」と入力してください:
                        </label>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder={action.label}
                        />
                      </div>
                    </div>
                  </>
                ) : null
              })()}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowEmergencyDialog(false)
                  setSelectedAction(null)
                  setConfirmText('')
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={() => selectedAction && executeAction(selectedAction)}
                disabled={confirmText !== emergencyActions.find(a => a.id === selectedAction)?.label || isExecuting}
                className={`px-4 py-2 rounded font-medium ${
                  confirmText === emergencyActions.find(a => a.id === selectedAction)?.label && !isExecuting
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isExecuting ? '実行中...' : '実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
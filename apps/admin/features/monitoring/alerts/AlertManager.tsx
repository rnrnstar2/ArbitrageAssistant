'use client'

import { useState, useEffect } from 'react'
import { AlertRule, Alert } from '../types'

interface AlertManagerProps {
  onRuleUpdate?: (rules: AlertRule[]) => void
  initialRules?: AlertRule[]
}

export function AlertManager({ onRuleUpdate, initialRules = [] }: AlertManagerProps) {
  const [alertRules, setAlertRules] = useState<AlertRule[]>(initialRules)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // デフォルトのアラートルール
  const defaultRules: Partial<AlertRule>[] = [
    {
      name: '証拠金維持率警告',
      type: 'margin_level',
      threshold: 150,
      actions: {
        showNotification: true,
        playSound: true,
        sendEmail: false
      },
      isActive: true
    },
    {
      name: '証拠金維持率危険',
      type: 'margin_level',
      threshold: 100,
      actions: {
        showNotification: true,
        playSound: true,
        sendEmail: true,
        autoClose: false
      },
      isActive: true
    },
    {
      name: '大きな損失警告',
      type: 'profit_loss',
      threshold: -1000,
      actions: {
        showNotification: true,
        playSound: true,
        sendEmail: true
      },
      isActive: true
    },
    {
      name: 'EA接続断',
      type: 'connection_lost',
      threshold: 30,
      actions: {
        showNotification: true,
        playSound: false,
        sendEmail: true
      },
      isActive: true
    }
  ]

  useEffect(() => {
    if (initialRules.length === 0) {
      // デフォルトルールの初期化
      const rules = defaultRules.map((rule, index) => ({
        id: `default-${index}`,
        ...rule,
        conditions: {}
      } as AlertRule))
      setAlertRules(rules)
      onRuleUpdate?.(rules)
    }
  }, [initialRules.length, onRuleUpdate])

  const handleCreateRule = () => {
    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: '新しいアラートルール',
      type: 'margin_level',
      threshold: 100,
      actions: {
        showNotification: true,
        playSound: false,
        sendEmail: false
      },
      isActive: true,
      conditions: {}
    }
    setEditingRule(newRule)
    setIsCreateMode(true)
  }

  const handleSaveRule = (rule: AlertRule) => {
    if (isCreateMode) {
      const updatedRules = [...alertRules, rule]
      setAlertRules(updatedRules)
      onRuleUpdate?.(updatedRules)
    } else {
      const updatedRules = alertRules.map(r => r.id === rule.id ? rule : r)
      setAlertRules(updatedRules)
      onRuleUpdate?.(updatedRules)
    }
    setEditingRule(null)
    setIsCreateMode(false)
  }

  const handleDeleteRule = (ruleId: string) => {
    if (window.confirm('このアラートルールを削除しますか？')) {
      const updatedRules = alertRules.filter(r => r.id !== ruleId)
      setAlertRules(updatedRules)
      onRuleUpdate?.(updatedRules)
    }
  }

  const handleToggleRule = (ruleId: string) => {
    const updatedRules = alertRules.map(rule =>
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    )
    setAlertRules(updatedRules)
    onRuleUpdate?.(updatedRules)
  }

  const getTypeLabel = (type: AlertRule['type']) => {
    switch (type) {
      case 'margin_level': return '証拠金維持率'
      case 'profit_loss': return '損益'
      case 'connection_lost': return '接続断'
      case 'large_position': return '大口ポジション'
      default: return 'その他'
    }
  }

  const getSeverityColor = (type: AlertRule['type']) => {
    switch (type) {
      case 'margin_level': return 'text-red-600 bg-red-100'
      case 'profit_loss': return 'text-orange-600 bg-orange-100'
      case 'connection_lost': return 'text-yellow-600 bg-yellow-100'
      case 'large_position': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">アラート管理</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
            >
              {showHistory ? 'ルール設定' : 'アラート履歴'}
            </button>
            <button
              onClick={handleCreateRule}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              新規作成
            </button>
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        {showHistory ? (
          <AlertHistory />
        ) : (
          <div className="space-y-4">
            {alertRules.map((rule) => (
              <div key={rule.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.type)}`}>
                        {getTypeLabel(rule.type)}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    </div>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-sm text-gray-600">
                        閾値: {rule.threshold}
                        {rule.type === 'margin_level' && '%'}
                        {rule.type === 'profit_loss' && ' (損益)'}
                        {rule.type === 'connection_lost' && '秒'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      {rule.actions.showNotification && (
                        <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded">通知</span>
                      )}
                      {rule.actions.playSound && (
                        <span className="px-1 py-0.5 bg-green-100 text-green-600 rounded">音</span>
                      )}
                      {rule.actions.sendEmail && (
                        <span className="px-1 py-0.5 bg-purple-100 text-purple-600 rounded">メール</span>
                      )}
                      {rule.actions.autoClose && (
                        <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded">自動決済</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        rule.isActive 
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {rule.isActive ? '有効' : '無効'}
                    </button>

                    <button
                      onClick={() => {
                        setEditingRule(rule)
                        setIsCreateMode(false)
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      編集
                    </button>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {alertRules.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-3xl mb-2">🔔</div>
                <p>アラートルールがありません</p>
                <p className="text-sm">新規作成ボタンからルールを追加してください</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* アラートルール編集モーダル */}
      {editingRule && (
        <AlertRuleEditor
          rule={editingRule}
          isCreateMode={isCreateMode}
          onSave={handleSaveRule}
          onCancel={() => {
            setEditingRule(null)
            setIsCreateMode(false)
          }}
        />
      )}
    </div>
  )
}

// アラートルール編集コンポーネント
interface AlertRuleEditorProps {
  rule: AlertRule
  isCreateMode: boolean
  onSave: (rule: AlertRule) => void
  onCancel: () => void
}

function AlertRuleEditor({ rule, isCreateMode, onSave, onCancel }: AlertRuleEditorProps) {
  const [editedRule, setEditedRule] = useState<AlertRule>({ ...rule })

  const handleChange = (field: keyof AlertRule, value: any) => {
    setEditedRule(prev => ({ ...prev, [field]: value }))
  }

  const handleActionChange = (action: keyof AlertRule['actions'], value: boolean) => {
    setEditedRule(prev => ({
      ...prev,
      actions: { ...prev.actions, [action]: value }
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isCreateMode ? 'アラートルール作成' : 'アラートルール編集'}
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {/* ルール名 */}
          <div>
            <label className="block text-sm font-medium mb-1">ルール名</label>
            <input
              type="text"
              value={editedRule.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="アラートルール名を入力"
            />
          </div>

          {/* アラート種類 */}
          <div>
            <label className="block text-sm font-medium mb-1">アラート種類</label>
            <select
              value={editedRule.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="margin_level">証拠金維持率</option>
              <option value="profit_loss">損益</option>
              <option value="connection_lost">接続断</option>
              <option value="large_position">大口ポジション</option>
            </select>
          </div>

          {/* 閾値 */}
          <div>
            <label className="block text-sm font-medium mb-1">
              閾値
              {editedRule.type === 'margin_level' && ' (%)'}
              {editedRule.type === 'profit_loss' && ' (損益額)'}
              {editedRule.type === 'connection_lost' && ' (秒)'}
            </label>
            <input
              type="number"
              value={editedRule.threshold}
              onChange={(e) => handleChange('threshold', parseFloat(e.target.value))}
              className="w-full border rounded px-3 py-2"
              step={editedRule.type === 'margin_level' ? '1' : '0.01'}
            />
          </div>

          {/* アクション設定 */}
          <div>
            <label className="block text-sm font-medium mb-2">アクション設定</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editedRule.actions.showNotification}
                  onChange={(e) => handleActionChange('showNotification', e.target.checked)}
                  className="mr-2"
                />
                画面通知を表示
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editedRule.actions.playSound}
                  onChange={(e) => handleActionChange('playSound', e.target.checked)}
                  className="mr-2"
                />
                アラート音を再生
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editedRule.actions.sendEmail}
                  onChange={(e) => handleActionChange('sendEmail', e.target.checked)}
                  className="mr-2"
                />
                メール通知を送信
              </label>
              {editedRule.type === 'margin_level' && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editedRule.actions.autoClose || false}
                    onChange={(e) => handleActionChange('autoClose', e.target.checked)}
                    className="mr-2"
                  />
                  自動決済を実行（危険）
                </label>
              )}
            </div>
          </div>

          {/* アクティブ状態 */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editedRule.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="mr-2"
              />
              ルールを有効にする
            </label>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(editedRule)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {isCreateMode ? '作成' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// アラート履歴コンポーネント
function AlertHistory() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // モックデータの生成
    const mockAlerts: Alert[] = []
    const now = new Date()
    
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now.getTime() - i * 1800000) // 30分間隔
      mockAlerts.push({
        id: `alert-${i}`,
        ruleId: `rule-${i % 4}`,
        type: ['margin_level', 'profit_loss', 'connection_lost'][i % 3] as any,
        message: `テストアラート ${i + 1}`,
        severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
        timestamp,
        acknowledged: i % 3 === 0
      })
    }

    setTimeout(() => {
      setAlerts(mockAlerts)
      setLoading(false)
    }, 500)
  }, [])

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">アラート履歴を読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-3 rounded border-l-4 ${
            alert.acknowledged ? 'bg-gray-50 border-gray-300' : 'bg-white border-red-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                  alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {alert.severity}
                </span>
                <span className="text-sm text-gray-600">
                  {alert.timestamp.toLocaleString('ja-JP')}
                </span>
              </div>
              <p className="text-sm">{alert.message}</p>
            </div>
            {alert.acknowledged && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                確認済み
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
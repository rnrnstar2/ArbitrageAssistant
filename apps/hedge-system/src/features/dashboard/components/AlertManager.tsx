'use client'

import { useState, useEffect, useCallback } from 'react'
import { Alert, Account } from '../types'
import { notificationService, NotificationSettings, SoundType } from '../services'

interface AlertRule {
  id: string
  name: string
  type: 'margin_level' | 'profit_loss' | 'connection_lost' | 'large_position' | 'system_error'
  threshold: number
  actions: {
    showNotification: boolean
    playSound: boolean
    sendEmail: boolean
    autoClose?: boolean
  }
  isActive: boolean
  conditions: Record<string, any>
}

interface AlertManagerProps {
  accounts: Account[]
  alerts: Alert[]
  onRuleUpdate?: (rules: AlertRule[]) => void
  onAcknowledgeAlert?: (alertId: string) => void
  onClearAlerts?: () => void
  className?: string
}

export function AlertManager({ 
  accounts, 
  alerts, 
  onRuleUpdate, 
  onAcknowledgeAlert,
  onClearAlerts,
  className 
}: AlertManagerProps) {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    notificationService.getSettings()
  )
  const [settings, setSettings] = useState({
    autoAcknowledge: false,
    retentionHours: 24
  })

  // デフォルトのアラートルール
  const defaultRules: Partial<AlertRule>[] = [
    {
      name: '証拠金维持率警告',
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
      name: '証拠金维持率危険',
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
        sendEmail: false
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

  // 初期化
  useEffect(() => {
    const savedRules = localStorage.getItem('alert-rules')
    const savedSettings = localStorage.getItem('alert-settings')
    
    if (savedRules) {
      try {
        const rules = JSON.parse(savedRules)
        setAlertRules(rules)
        onRuleUpdate?.(rules)
      } catch (error) {
        console.error('Failed to load alert rules:', error)
        initializeDefaultRules()
      }
    } else {
      initializeDefaultRules()
    }

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (error) {
        console.error('Failed to load alert settings:', error)
      }
    }

    // 通知設定を同期
    setNotificationSettings(notificationService.getSettings())
  }, [])

  const initializeDefaultRules = useCallback(() => {
    const rules = defaultRules.map((rule, index) => ({
      id: `default-${index}`,
      ...rule,
      conditions: {}
    } as AlertRule))
    setAlertRules(rules)
    onRuleUpdate?.(rules)
  }, [onRuleUpdate])

  // 設定保存
  const saveRules = useCallback((rules: AlertRule[]) => {
    localStorage.setItem('alert-rules', JSON.stringify(rules))
    onRuleUpdate?.(rules)
  }, [onRuleUpdate])

  const saveSettings = useCallback((newSettings: typeof settings) => {
    localStorage.setItem('alert-settings', JSON.stringify(newSettings))
    setSettings(newSettings)
  }, [])

  const saveNotificationSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...notificationSettings, ...newSettings }
    notificationService.updateSettings(updatedSettings)
    setNotificationSettings(updatedSettings)
  }, [notificationSettings])

  // ルール操作
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
    let updatedRules: AlertRule[]
    
    if (isCreateMode) {
      updatedRules = [...alertRules, rule]
    } else {
      updatedRules = alertRules.map(r => r.id === rule.id ? rule : r)
    }
    
    setAlertRules(updatedRules)
    saveRules(updatedRules)
    setEditingRule(null)
    setIsCreateMode(false)
  }

  const handleDeleteRule = (ruleId: string) => {
    if (window.confirm('このアラートルールを削除しますか？')) {
      const updatedRules = alertRules.filter(r => r.id !== ruleId)
      setAlertRules(updatedRules)
      saveRules(updatedRules)
    }
  }

  const handleToggleRule = (ruleId: string) => {
    const updatedRules = alertRules.map(rule =>
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    )
    setAlertRules(updatedRules)
    saveRules(updatedRules)
  }

  // アラート操作
  const handleAcknowledgeAlert = (alertId: string) => {
    onAcknowledgeAlert?.(alertId)
  }

  const handleClearAllAlerts = () => {
    if (window.confirm('すべてのアラートをクリアしますか？')) {
      onClearAlerts?.()
    }
  }

  // 表示用ヘルパー
  const getTypeLabel = (type: AlertRule['type']) => {
    switch (type) {
      case 'margin_level': return '証拠金维持率'
      case 'profit_loss': return '損益'
      case 'connection_lost': return '接続断'
      case 'large_position': return '大口ポジション'
      case 'system_error': return 'システムエラー'
      default: return 'その他'
    }
  }

  const getSeverityColor = (type: AlertRule['type'] | Alert['severity']) => {
    if (typeof type === 'string' && ['critical', 'high', 'medium', 'low'].includes(type)) {
      // Alert severity
      switch (type) {
        case 'critical': return 'text-red-600 bg-red-100 border-red-300'
        case 'high': return 'text-orange-600 bg-orange-100 border-orange-300'
        case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300'
        case 'low': return 'text-blue-600 bg-blue-100 border-blue-300'
        default: return 'text-gray-600 bg-gray-100 border-gray-300'
      }
    } else {
      // AlertRule type
      switch (type) {
        case 'margin_level': return 'text-red-600 bg-red-100'
        case 'profit_loss': return 'text-orange-600 bg-orange-100'
        case 'connection_lost': return 'text-yellow-600 bg-yellow-100'
        case 'large_position': return 'text-blue-600 bg-blue-100'
        case 'system_error': return 'text-purple-600 bg-purple-100'
        default: return 'text-gray-600 bg-gray-100'
      }
    }
  }

  // アクティブなアラート数
  const activeAlertCount = alerts.filter(alert => !alert.acknowledged).length
  const criticalAlertCount = alerts.filter(alert => 
    !alert.acknowledged && alert.severity === 'critical'
  ).length

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold">アラート管理</h3>
            {activeAlertCount > 0 && (
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  criticalAlertCount > 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  アクティブ: {activeAlertCount}
                </span>
                {criticalAlertCount > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium animate-pulse">
                    緊急: {criticalAlertCount}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
            >
              {showHistory ? 'ルール設定' : 'アラート履歴'}
            </button>
            {!showHistory && (
              <button
                onClick={handleCreateRule}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                新規作成
              </button>
            )}
            {showHistory && activeAlertCount > 0 && (
              <button
                onClick={handleClearAllAlerts}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                全クリア
              </button>
            )}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        {showHistory ? (
          <NotificationHistory 
            alerts={alerts}
            notifications={notificationService.getHistory()}
            onAcknowledge={handleAcknowledgeAlert}
            onAcknowledgeNotification={(id) => notificationService.acknowledgeNotification(id)}
            onClearHistory={() => notificationService.clearHistory()}
          />
        ) : (
          <div className="space-y-4">
            {/* 設定パネル */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <h4 className="font-medium mb-2">通知設定</h4>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enableSounds}
                    onChange={(e) => saveNotificationSettings({enableSounds: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm">アラート音を有効</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enableDesktopNotifications}
                    onChange={(e) => saveNotificationSettings({enableDesktopNotifications: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm">デスクトップ通知を有効</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enableMacOSNotifications}
                    onChange={(e) => saveNotificationSettings({enableMacOSNotifications: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm">macOS通知を有効</span>
                </label>
                <div className="flex items-center space-x-2">
                  <label className="text-sm">デフォルト音:</label>
                  <select
                    value={notificationSettings.defaultSound}
                    onChange={(e) => saveNotificationSettings({defaultSound: e.target.value as SoundType})}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="glass">Glass</option>
                    <option value="basso">Basso</option>
                    <option value="blow">Blow</option>
                    <option value="bottle">Bottle</option>
                    <option value="frog">Frog</option>
                    <option value="funk">Funk</option>
                    <option value="hero">Hero</option>
                    <option value="morse">Morse</option>
                    <option value="ping">Ping</option>
                    <option value="pop">Pop</option>
                    <option value="purr">Purr</option>
                    <option value="sosumi">Sosumi</option>
                    <option value="submarine">Submarine</option>
                    <option value="tink">Tink</option>
                  </select>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoAcknowledge}
                    onChange={(e) => saveSettings({...settings, autoAcknowledge: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm">自動確認</span>
                </label>
                <div className="flex items-center space-x-2">
                  <label className="text-sm">保持時間:</label>
                  <select
                    value={settings.retentionHours}
                    onChange={(e) => saveSettings({...settings, retentionHours: parseInt(e.target.value)})}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value={12}>12時間</option>
                    <option value={24}>24時間</option>
                    <option value={48}>48時間</option>
                    <option value={168}>1週間</option>
                  </select>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.autoClose}
                    onChange={(e) => saveNotificationSettings({autoClose: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm">自動クローズ</span>
                </label>
                <div className="flex items-center space-x-2">
                  <label className="text-sm">自動クローズ時間:</label>
                  <select
                    value={notificationSettings.autoCloseDelay}
                    onChange={(e) => saveNotificationSettings({autoCloseDelay: parseInt(e.target.value)})}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value={3}>3秒</option>
                    <option value={5}>5秒</option>
                    <option value={10}>10秒</option>
                    <option value={15}>15秒</option>
                    <option value={30}>30秒</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex items-center space-x-2">
                <button
                  onClick={() => notificationService.testNotification()}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  テスト通知
                </button>
                <button
                  onClick={() => notificationService.testSound(notificationSettings.defaultSound)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  音テスト
                </button>
              </div>
            </div>

            {/* アラートルール一覧 */}
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
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="アラートルール名を入力"
            />
          </div>

          {/* アラート種類 */}
          <div>
            <label className="block text-sm font-medium mb-1">アラート種類</label>
            <select
              value={editedRule.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="margin_level">証拠金维持率</option>
              <option value="profit_loss">損益</option>
              <option value="connection_lost">接続断</option>
              <option value="large_position">大口ポジション</option>
              <option value="system_error">システムエラー</option>
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
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

// アラート・通知履歴コンポーネント
interface NotificationHistoryProps {
  alerts: Alert[]
  notifications: import('../services').NotificationHistory[]
  onAcknowledge?: (alertId: string) => void
  onAcknowledgeNotification?: (notificationId: string) => void
  onClearHistory?: () => void
}

function NotificationHistory({ 
  alerts, 
  notifications, 
  onAcknowledge, 
  onAcknowledgeNotification,
  onClearHistory 
}: NotificationHistoryProps) {
  // Alertsをベース形式に変換
  const alertItems = alerts.map(alert => ({
    id: alert.id,
    title: 'アラート',
    body: alert.message,
    type: alert.severity as any,
    timestamp: new Date(alert.timestamp),
    acknowledged: alert.acknowledged,
    accountId: alert.accountId,
    isAlert: true
  }))

  // Notificationsをベース形式に変換  
  const notificationItems = notifications.map(notification => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    timestamp: notification.timestamp,
    acknowledged: notification.acknowledged,
    accountId: undefined,
    isAlert: false
  }))

  // 全てを統合してソート
  const allItems = [...alertItems, ...notificationItems].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  )

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'critical': return '🚨'
      case 'high': 
      case 'error': return '⚠️'
      case 'medium':
      case 'warning': return '⚡'
      case 'low':
      case 'info': return 'ℹ️'
      case 'success': return '✅'
      default: return '📢'
    }
  }

  const getSeverityColor = (type: string) => {
    switch (type) {
      case 'critical':
      case 'error': return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
      case 'warning': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'success': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (allItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">📋</div>
        <p>履歴がありません</p>
        <p className="text-sm">アラートや通知が発生すると、ここに表示されます</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600">
          合計 {allItems.length} 件（アラート {alertItems.length} 件、通知 {notificationItems.length} 件）
        </span>
        {onClearHistory && (
          <button
            onClick={onClearHistory}
            className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
          >
            通知履歴クリア
          </button>
        )}
      </div>
      
      {allItems.map((item) => (
        <div
          key={item.id}
          className={`p-3 rounded border-l-4 ${
            item.acknowledged ? 'bg-gray-50 border-gray-300' : getSeverityColor(item.type)
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{getSeverityIcon(item.type)}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(item.type)}`}>
                  {item.isAlert ? 'ALERT' : 'NOTIFICATION'} - {item.type.toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">
                  {item.timestamp.toLocaleString('ja-JP')}
                </span>
              </div>
              <p className="text-sm mb-2">
                <span className="font-medium">{item.title}:</span> {item.body}
              </p>
              {item.accountId && (
                <p className="text-xs text-gray-500">アカウント: {item.accountId}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {item.acknowledged ? (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  確認済み
                </span>
              ) : (
                <button
                  onClick={() => {
                    if (item.isAlert) {
                      onAcknowledge?.(item.id)
                    } else {
                      onAcknowledgeNotification?.(item.id)
                    }
                  }}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  確認
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
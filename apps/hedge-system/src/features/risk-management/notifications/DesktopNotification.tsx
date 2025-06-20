'use client'

import { useState, useEffect } from 'react'
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/api/notification'
import { DesktopNotificationSettings, RiskAlert } from '../types/notification-types'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { Monitor, Settings, TestTube } from 'lucide-react'

interface DesktopNotificationProps {
  settings: DesktopNotificationSettings & { isEnabled: boolean }
  onSettingsChange?: (settings: DesktopNotificationSettings & { isEnabled: boolean }) => void
}

export function DesktopNotification({ 
  settings, 
  onSettingsChange 
}: DesktopNotificationProps) {
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null)
  const [notificationQueue, setNotificationQueue] = useState<Array<{
    id: string
    title: string
    body: string
    priority: RiskAlert['priority']
    timestamp: Date
  }>>([])

  // 通知権限の確認
  useEffect(() => {
    checkPermission()
  }, [])

  const checkPermission = async () => {
    try {
      const granted = await isPermissionGranted()
      setPermissionGranted(granted)
    } catch (error) {
      console.error('Failed to check notification permission:', error)
      setPermissionGranted(false)
    }
  }

  const requestNotificationPermission = async () => {
    if (isRequesting) return
    
    setIsRequesting(true)
    try {
      const permission = await requestPermission()
      setPermissionGranted(permission === 'granted')
    } catch (error) {
      console.error('Failed to request notification permission:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  const sendDesktopNotification = async (
    title: string, 
    body: string, 
    priority: RiskAlert['priority'] = 'medium'
  ): Promise<void> => {
    if (!permissionGranted) {
      throw new Error('Notification permission not granted')
    }

    const notificationId = `risk-${Date.now()}`
    
    try {
      await sendNotification({
        title,
        body,
        icon: getNotificationIcon(priority)
      })

      setLastNotificationId(notificationId)
      
      // 通知履歴に追加
      setNotificationQueue(prev => [...prev, {
        id: notificationId,
        title,
        body,
        priority,
        timestamp: new Date()
      }].slice(-10)) // 最新10件のみ保持

      // 自動消去タイマー（設定に基づく）
      if (settings.duration > 0) {
        setTimeout(() => {
          // Tauri では個別の通知消去はサポートされていないため、ログのみ
          console.log(`Notification ${notificationId} auto-expired after ${settings.duration}ms`)
        }, settings.duration)
      }

    } catch (error) {
      console.error('Failed to send desktop notification:', error)
      throw error
    }
  }

  const getNotificationIcon = (priority: RiskAlert['priority']): string => {
    switch (priority) {
      case 'critical':
        return '/icons/alert-critical.png'
      case 'high':
        return '/icons/alert-high.png'
      case 'medium':
        return '/icons/alert-medium.png'
      case 'low':
        return '/icons/alert-low.png'
      default:
        return '/icons/alert-default.png'
    }
  }

  const getPriorityColor = (priority: RiskAlert['priority']): string => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const testNotification = async () => {
    try {
      await sendDesktopNotification(
        'テスト通知',
        'デスクトップ通知のテストです。この通知が表示されれば正常に動作しています。',
        'medium'
      )
    } catch (error) {
      console.error('Test notification failed:', error)
      alert('テスト通知の送信に失敗しました。権限を確認してください。')
    }
  }

  const updateSettings = (updates: Partial<DesktopNotificationSettings & { isEnabled: boolean }>) => {
    const newSettings = { ...settings, ...updates }
    onSettingsChange?.(newSettings)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          デスクトップ通知設定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 通知権限状態 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-sm">通知権限</div>
            <div className="text-xs text-gray-600">
              デスクトップ通知を表示するには権限が必要です
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={permissionGranted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {permissionGranted ? '許可済み' : '未許可'}
            </Badge>
            {!permissionGranted && (
              <button
                onClick={requestNotificationPermission}
                disabled={isRequesting}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isRequesting ? '要求中...' : '権限を要求'}
              </button>
            )}
          </div>
        </div>

        {/* 通知有効化スイッチ */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">デスクトップ通知</div>
            <div className="text-xs text-gray-600">
              リスクアラート発生時にデスクトップ通知を表示
            </div>
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(e) => updateSettings({ isEnabled: e.target.checked })}
              disabled={!permissionGranted}
              className="mr-2"
            />
            <span className="text-sm">有効</span>
          </label>
        </div>

        {/* 詳細設定 */}
        {settings.isEnabled && permissionGranted && (
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4" />
              詳細設定
            </div>

            {/* 表示時間設定 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">表示時間 (秒)</label>
                <select
                  value={settings.duration / 1000}
                  onChange={(e) => updateSettings({ duration: parseInt(e.target.value) * 1000 })}
                  className="w-full text-xs border rounded px-2 py-1"
                >
                  <option value={5}>5秒</option>
                  <option value={10}>10秒</option>
                  <option value={15}>15秒</option>
                  <option value={30}>30秒</option>
                  <option value={0}>自動消去なし</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">表示位置</label>
                <select
                  value={settings.position}
                  onChange={(e) => updateSettings({ position: e.target.value as DesktopNotificationSettings['position'] })}
                  className="w-full text-xs border rounded px-2 py-1"
                >
                  <option value="top-right">右上</option>
                  <option value="top-left">左上</option>
                  <option value="bottom-right">右下</option>
                  <option value="bottom-left">左下</option>
                </select>
              </div>
            </div>

            {/* 追加オプション */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={settings.requireInteraction}
                  onChange={(e) => updateSettings({ requireInteraction: e.target.checked })}
                  className="mr-2"
                />
                <span>手動で閉じる必要あり</span>
              </label>

              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={settings.showActions}
                  onChange={(e) => updateSettings({ showActions: e.target.checked })}
                  className="mr-2"
                />
                <span>アクションボタン表示</span>
              </label>
            </div>
          </div>
        )}

        {/* テスト機能 */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <div className="font-medium text-sm">テスト通知</div>
            <div className="text-xs text-gray-600">
              設定が正しく動作するかテストします
            </div>
          </div>
          <button
            onClick={testNotification}
            disabled={!settings.isEnabled || !permissionGranted}
            className="flex items-center gap-2 text-xs bg-gray-200 text-gray-700 px-3 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            <TestTube className="h-3 w-3" />
            テスト実行
          </button>
        </div>

        {/* 最近の通知履歴 */}
        {notificationQueue.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium text-sm">最近の通知</div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {notificationQueue.slice(-5).reverse().map(notification => (
                <div key={notification.id} className="flex items-start gap-2 text-xs p-2 bg-gray-50 rounded">
                  <Badge className={getPriorityColor(notification.priority)}>
                    {notification.priority}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{notification.title}</div>
                    <div className="text-gray-600 truncate">{notification.body}</div>
                    <div className="text-gray-500 text-xs">
                      {notification.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 通知用のカスタムフック
export function useDesktopNotification() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<boolean>(false)

  useEffect(() => {
    // Tauri環境での通知サポート確認
    setIsSupported(true)
    checkPermission()
  }, [])

  const checkPermission = async () => {
    try {
      const granted = await isPermissionGranted()
      setPermission(granted)
    } catch (error) {
      console.error('Permission check failed:', error)
      setPermission(false)
    }
  }

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false
    
    try {
      const result = await requestPermission()
      const granted = result === 'granted'
      setPermission(granted)
      return granted
    } catch (error) {
      console.error('Permission request failed:', error)
      return false
    }
  }

  const showNotification = async (
    title: string, 
    body: string, 
    icon?: string
  ): Promise<void> => {
    if (!isSupported || !permission) {
      throw new Error('Notifications not supported or not permitted')
    }

    await sendNotification({ title, body, icon })
  }

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    checkPermission
  }
}
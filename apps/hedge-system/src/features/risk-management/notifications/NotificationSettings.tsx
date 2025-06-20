'use client'

import { useState, useEffect } from 'react'
import { NotificationSettings, RiskAlert, NotificationStats } from '../types/notification-types'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { Settings, Volume2, Mail, Monitor, Globe, Clock, Filter, TestTube, Save, RefreshCw } from 'lucide-react'

interface NotificationSettingsProps {
  settings: NotificationSettings
  stats?: NotificationStats
  onSettingsChange: (settings: NotificationSettings) => void
  onTest?: (channel: keyof NotificationSettings['channels']) => Promise<void>
}

export function NotificationSettings({
  settings,
  stats,
  onSettingsChange,
  onTest
}: NotificationSettingsProps) {
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings)
  const [isDirty, setIsDirty] = useState(false)
  const [testingChannel, setTestingChannel] = useState<string | null>(null)

  useEffect(() => {
    setLocalSettings(settings)
    setIsDirty(false)
  }, [settings])

  const updateLocalSettings = (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...localSettings, ...updates }
    setLocalSettings(newSettings)
    setIsDirty(true)
  }

  const updateChannelSettings = (
    channel: keyof NotificationSettings['channels'],
    updates: any
  ) => {
    const newChannels = {
      ...localSettings.channels,
      [channel]: {
        ...localSettings.channels[channel],
        ...updates
      }
    }
    updateLocalSettings({ channels: newChannels })
  }

  const handleSave = () => {
    onSettingsChange(localSettings)
    setIsDirty(false)
  }

  const handleReset = () => {
    setLocalSettings(settings)
    setIsDirty(false)
  }

  const handleTest = async (channel: keyof NotificationSettings['channels']) => {
    if (!onTest) return
    
    setTestingChannel(channel)
    try {
      await onTest(channel)
    } catch (error) {
      console.error(`Test failed for ${channel}:`, error)
      alert(`${channel}通知のテストに失敗しました`)
    } finally {
      setTestingChannel(null)
    }
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">通知設定</h2>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                <RefreshCw className="h-4 w-4" />
                リセット
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </>
          )}
        </div>
      </div>

      {/* 統計情報 */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">配信統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">総配信数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                <div className="text-sm text-gray-600">成功</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-gray-600">失敗</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">成功率</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* デスクトップ通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            デスクトップ通知
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">デスクトップ通知を有効化</div>
              <div className="text-sm text-gray-600">システム通知でアラートを表示</div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localSettings.channels.desktop?.isEnabled || false}
                onChange={(e) => updateChannelSettings('desktop', { isEnabled: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">有効</span>
            </label>
          </div>

          {localSettings.channels.desktop?.isEnabled && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">表示時間</label>
                <select
                  value={(localSettings.channels.desktop?.duration || 10000) / 1000}
                  onChange={(e) => updateChannelSettings('desktop', { duration: parseInt(e.target.value) * 1000 })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value={5}>5秒</option>
                  <option value={10}>10秒</option>
                  <option value={15}>15秒</option>
                  <option value={30}>30秒</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">表示位置</label>
                <select
                  value={localSettings.channels.desktop?.position || 'top-right'}
                  onChange={(e) => updateChannelSettings('desktop', { position: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="top-right">右上</option>
                  <option value="top-left">左上</option>
                  <option value="bottom-right">右下</option>
                  <option value="bottom-left">左下</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.channels.desktop?.requireInteraction || false}
                    onChange={(e) => updateChannelSettings('desktop', { requireInteraction: e.target.checked })}
                    className="mr-2"
                  />
                  手動で閉じる必要あり
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => handleTest('desktop')}
              disabled={!localSettings.channels.desktop?.isEnabled || testingChannel === 'desktop'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              <TestTube className="h-4 w-4" />
              {testingChannel === 'desktop' ? 'テスト中...' : 'テスト'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 音声通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            音声通知
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">音声通知を有効化</div>
              <div className="text-sm text-gray-600">アラート発生時に音を再生</div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localSettings.channels.sound?.isEnabled || false}
                onChange={(e) => updateChannelSettings('sound', { isEnabled: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">有効</span>
            </label>
          </div>

          {localSettings.channels.sound?.isEnabled && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">音声タイプ</label>
                <select
                  value={localSettings.channels.sound?.soundType || 'alert'}
                  onChange={(e) => updateChannelSettings('sound', { soundType: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="alert">アラート</option>
                  <option value="warning">警告</option>
                  <option value="critical">緊急</option>
                  <option value="custom">カスタム</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">音量</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localSettings.channels.sound?.volume || 50}
                  onChange={(e) => updateChannelSettings('sound', { volume: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-gray-600 mt-1">
                  {localSettings.channels.sound?.volume || 50}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">繰り返し回数</label>
                <select
                  value={localSettings.channels.sound?.repeat || 1}
                  onChange={(e) => updateChannelSettings('sound', { repeat: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value={1}>1回</option>
                  <option value={2}>2回</option>
                  <option value={3}>3回</option>
                  <option value={5}>5回</option>
                </select>
              </div>
              {localSettings.channels.sound?.soundType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-1">カスタム音声ファイル</label>
                  <input
                    type="text"
                    placeholder="/path/to/sound.mp3"
                    value={localSettings.channels.sound?.customSoundPath || ''}
                    onChange={(e) => updateChannelSettings('sound', { customSoundPath: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => handleTest('sound')}
              disabled={!localSettings.channels.sound?.isEnabled || testingChannel === 'sound'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              <TestTube className="h-4 w-4" />
              {testingChannel === 'sound' ? 'テスト中...' : 'テスト'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* メール通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            メール通知
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">メール通知を有効化</div>
              <div className="text-sm text-gray-600">重要なアラートをメールで送信</div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localSettings.channels.email?.isEnabled || false}
                onChange={(e) => updateChannelSettings('email', { isEnabled: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">有効</span>
            </label>
          </div>

          {localSettings.channels.email?.isEnabled && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">送信先メールアドレス</label>
                <textarea
                  placeholder="email1@example.com, email2@example.com"
                  value={(localSettings.channels.email?.recipients || []).join(', ')}
                  onChange={(e) => {
                    const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                    updateChannelSettings('email', { recipients: emails })
                  }}
                  className="w-full border rounded px-3 py-2 h-20"
                />
                <div className="text-xs text-gray-600 mt-1">
                  カンマ区切りで複数指定可能
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">テンプレート</label>
                  <select
                    value={localSettings.channels.email?.template || 'basic'}
                    onChange={(e) => updateChannelSettings('email', { template: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="basic">基本</option>
                    <option value="detailed">詳細</option>
                    <option value="custom">カスタム</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={localSettings.channels.email?.attachments || false}
                      onChange={(e) => updateChannelSettings('email', { attachments: e.target.checked })}
                      className="mr-2"
                    />
                    データファイルを添付
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => handleTest('email')}
              disabled={!localSettings.channels.email?.isEnabled || testingChannel === 'email'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              <TestTube className="h-4 w-4" />
              {testingChannel === 'email' ? 'テスト中...' : 'テスト'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Webhook通知
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Webhook通知を有効化</div>
              <div className="text-sm text-gray-600">外部システムにHTTPリクエストを送信</div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localSettings.channels.webhook?.isEnabled || false}
                onChange={(e) => updateChannelSettings('webhook', { isEnabled: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">有効</span>
            </label>
          </div>

          {localSettings.channels.webhook?.isEnabled && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">WebhookURL</label>
                <input
                  type="url"
                  placeholder="https://your-webhook-endpoint.com/alerts"
                  value={localSettings.channels.webhook?.url || ''}
                  onChange={(e) => updateChannelSettings('webhook', { url: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">リトライ回数</label>
                  <select
                    value={localSettings.channels.webhook?.retryCount || 3}
                    onChange={(e) => updateChannelSettings('webhook', { retryCount: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value={1}>1回</option>
                    <option value={2}>2回</option>
                    <option value={3}>3回</option>
                    <option value={5}>5回</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">タイムアウト (秒)</label>
                  <select
                    value={localSettings.channels.webhook?.timeout || 10}
                    onChange={(e) => updateChannelSettings('webhook', { timeout: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value={5}>5秒</option>
                    <option value={10}>10秒</option>
                    <option value={30}>30秒</option>
                    <option value={60}>60秒</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => handleTest('webhook')}
              disabled={!localSettings.channels.webhook?.isEnabled || testingChannel === 'webhook'}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              <TestTube className="h-4 w-4" />
              {testingChannel === 'webhook' ? 'テスト中...' : 'テスト'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* フィルタリング設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            フィルタリング設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">最小優先度</label>
            <select
              value={localSettings.priorityFilter || 'low'}
              onChange={(e) => updateLocalSettings({ priorityFilter: e.target.value as RiskAlert['priority'] })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">低 (すべて)</option>
              <option value="medium">中 (中・高・緊急)</option>
              <option value="high">高 (高・緊急)</option>
              <option value="critical">緊急 (緊急のみ)</option>
            </select>
            <div className="text-xs text-gray-600 mt-1">
              この優先度以上のアラートのみ通知されます
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 時間制限設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            時間制限設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">時間帯制限を有効化</div>
              <div className="text-sm text-gray-600">指定した時間帯のみ通知を送信</div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={localSettings.timeRestrictions?.enabled || false}
                onChange={(e) => updateLocalSettings({
                  timeRestrictions: {
                    ...localSettings.timeRestrictions,
                    enabled: e.target.checked,
                    startTime: localSettings.timeRestrictions?.startTime || 540, // 9:00
                    endTime: localSettings.timeRestrictions?.endTime || 1080    // 18:00
                  }
                })}
                className="mr-2"
              />
              <span className="text-sm">有効</span>
            </label>
          </div>

          {localSettings.timeRestrictions?.enabled && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">開始時刻</label>
                <input
                  type="time"
                  value={formatTime(localSettings.timeRestrictions?.startTime || 540)}
                  onChange={(e) => updateLocalSettings({
                    timeRestrictions: {
                      ...localSettings.timeRestrictions!,
                      startTime: parseTime(e.target.value)
                    }
                  })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">終了時刻</label>
                <input
                  type="time"
                  value={formatTime(localSettings.timeRestrictions?.endTime || 1080)}
                  onChange={(e) => updateLocalSettings({
                    timeRestrictions: {
                      ...localSettings.timeRestrictions!,
                      endTime: parseTime(e.target.value)
                    }
                  })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 変更保存の確認 */}
      {isDirty && (
        <div className="sticky bottom-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-yellow-800">変更が保存されていません</div>
              <div className="text-sm text-yellow-600">設定を有効にするには保存してください</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
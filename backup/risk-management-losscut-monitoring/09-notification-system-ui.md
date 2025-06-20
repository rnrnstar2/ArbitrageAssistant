# Task 09: 通知システムUIの実装

## 概要
リスクアラートとシステム通知を表示・管理するUI機能を実装する。リアルタイム通知とアラート履歴を統合的に管理する画面。

## 実装対象ファイル
- `apps/admin/src/features/risk-management/components/RiskNotificationSystem.tsx`
- `apps/admin/src/features/risk-management/components/NotificationCenter.tsx`
- `apps/admin/src/features/risk-management/components/AlertToast.tsx`
- `apps/admin/src/features/risk-management/components/NotificationSettings.tsx`
- `apps/admin/src/features/risk-management/hooks/useNotifications.ts`

## 具体的な実装内容

### RiskNotificationSystem.tsx
```typescript
export const RiskNotificationSystem: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useNotifications()
  
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <>
      {/* 通知トリガーボタン */}
      <div className="notification-trigger">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="relative"
        >
          <BellIcon className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
      
      {/* 通知センターモーダル */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="通知センター"
        size="lg"
      >
        <NotificationCenter
          notifications={notifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onClearAll={clearAll}
        />
      </Modal>
      
      {/* リアルタイムトースト通知 */}
      <ToastContainer>
        {notifications
          .filter(n => n.showAsToast && !n.isRead)
          .slice(0, 3) // 最大3つまで表示
          .map(notification => (
            <AlertToast
              key={notification.id}
              notification={notification}
              onClose={() => markAsRead(notification.id)}
              onAction={(action) => handleNotificationAction(notification, action)}
            />
          ))}
      </ToastContainer>
    </>
  )
}
```

### NotificationCenter.tsx
```typescript
interface NotificationCenterProps {
  notifications: RiskNotification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll
}) => {
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [sortBy, setSortBy] = useState<NotificationSort>('newest')
  
  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        switch (filter) {
          case 'unread': return !n.isRead
          case 'critical': return n.level === 'critical' || n.level === 'emergency'
          case 'today': return isToday(n.timestamp)
          default: return true
        }
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'newest': return b.timestamp.getTime() - a.timestamp.getTime()
          case 'oldest': return a.timestamp.getTime() - b.timestamp.getTime()
          case 'priority': return getPriorityScore(b) - getPriorityScore(a)
          default: return 0
        }
      })
  }, [notifications, filter, sortBy])
  
  return (
    <div className="notification-center">
      {/* ヘッダー */}
      <div className="notification-header">
        <div className="header-controls">
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '全て' },
              { value: 'unread', label: '未読' },
              { value: 'critical', label: '重要' },
              { value: 'today', label: '今日' }
            ]}
          />
          
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'newest', label: '新しい順' },
              { value: 'oldest', label: '古い順' },
              { value: 'priority', label: '重要度順' }
            ]}
          />
        </div>
        
        <div className="header-actions">
          <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
            全て既読
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            全て削除
          </Button>
        </div>
      </div>
      
      {/* 通知リスト */}
      <div className="notification-list">
        {filteredNotifications.length === 0 ? (
          <EmptyState message="通知はありません" />
        ) : (
          filteredNotifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={onMarkAsRead}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

### AlertToast.tsx
```typescript
interface AlertToastProps {
  notification: RiskNotification
  onClose: () => void
  onAction?: (action: NotificationAction) => void
}

export const AlertToast: React.FC<AlertToastProps> = ({
  notification,
  onClose,
  onAction
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [progress, setProgress] = useState(100)
  
  // 自動消失タイマー
  useEffect(() => {
    const duration = notification.level === 'emergency' ? 0 : 5000 // 緊急時は自動消失しない
    if (duration === 0) return
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          setIsVisible(false)
          setTimeout(onClose, 300) // アニメーション後にクローズ
          return 0
        }
        return prev - (100 / (duration / 100))
      })
    }, 100)
    
    return () => clearInterval(interval)
  }, [notification.level, onClose])
  
  const getToastStyles = () => {
    const baseStyles = "toast-alert transform transition-all duration-300"
    const levelStyles = {
      info: "bg-blue-50 border-blue-200 text-blue-800",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
      danger: "bg-orange-50 border-orange-200 text-orange-800",
      critical: "bg-red-50 border-red-200 text-red-800",
      emergency: "bg-red-100 border-red-400 text-red-900 shadow-lg"
    }
    
    return `${baseStyles} ${levelStyles[notification.level]} ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`
  }
  
  return (
    <div className={getToastStyles()}>
      {/* プログレスバー */}
      {notification.level !== 'emergency' && (
        <div className="toast-progress">
          <div 
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {/* アイコン */}
      <div className="toast-icon">
        <NotificationIcon level={notification.level} />
      </div>
      
      {/* コンテンツ */}
      <div className="toast-content">
        <div className="toast-title">
          {notification.title}
        </div>
        <div className="toast-message">
          {notification.message}
        </div>
        {notification.accountId && (
          <div className="toast-account">
            口座: {notification.accountId}
          </div>
        )}
      </div>
      
      {/* アクションボタン */}
      {notification.actions && notification.actions.length > 0 && (
        <div className="toast-actions">
          {notification.actions.map(action => (
            <Button
              key={action.id}
              variant={action.variant}
              size="xs"
              onClick={() => onAction?.(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      
      {/* 閉じるボタン */}
      <Button
        variant="ghost"
        size="xs"
        onClick={onClose}
        className="toast-close"
      >
        <XIcon className="w-4 h-4" />
      </Button>
    </div>
  )
}
```

### NotificationSettings.tsx
```typescript
export const NotificationSettings: React.FC = () => {
  const { settings, updateSettings } = useNotificationSettings()
  
  return (
    <Card className="notification-settings">
      <CardHeader>
        <h3>通知設定</h3>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* デスクトップ通知 */}
        <div className="setting-group">
          <h4>デスクトップ通知</h4>
          <div className="setting-items">
            <Switch
              label="ネイティブ通知を有効"
              checked={settings.desktop.enabled}
              onChange={(enabled) => updateSettings({
                ...settings,
                desktop: { ...settings.desktop, enabled }
              })}
            />
            
            <Switch
              label="通知音を再生"
              checked={settings.desktop.sound}
              disabled={!settings.desktop.enabled}
              onChange={(sound) => updateSettings({
                ...settings,
                desktop: { ...settings.desktop, sound }
              })}
            />
          </div>
        </div>
        
        {/* レベル別設定 */}
        <div className="setting-group">
          <h4>通知レベル設定</h4>
          {Object.entries(settings.levels).map(([level, config]) => (
            <div key={level} className="level-setting">
              <label className="level-label">
                {level.toUpperCase()}
              </label>
              <div className="level-controls">
                <Switch
                  label="トースト表示"
                  checked={config.showToast}
                  onChange={(showToast) => updateLevelSetting(level, 'showToast', showToast)}
                />
                <Switch
                  label="ネイティブ通知"
                  checked={config.nativeNotification}
                  onChange={(nativeNotification) => updateLevelSetting(level, 'nativeNotification', nativeNotification)}
                />
                <Select
                  label="通知音"
                  value={config.sound}
                  onChange={(sound) => updateLevelSetting(level, 'sound', sound)}
                  options={SOUND_OPTIONS}
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* 自動削除設定 */}
        <div className="setting-group">
          <h4>履歴管理</h4>
          <Select
            label="自動削除期間"
            value={settings.autoDelete}
            onChange={(autoDelete) => updateSettings({ ...settings, autoDelete })}
            options={[
              { value: 0, label: '削除しない' },
              { value: 1, label: '1日後' },
              { value: 7, label: '1週間後' },
              { value: 30, label: '1ヶ月後' }
            ]}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

## データ型定義
```typescript
interface RiskNotification {
  id: string
  type: 'risk_alert' | 'system_event' | 'action_result'
  level: 'info' | 'warning' | 'danger' | 'critical' | 'emergency'
  title: string
  message: string
  timestamp: Date
  accountId?: string
  isRead: boolean
  showAsToast: boolean
  actions?: NotificationAction[]
  data?: Record<string, any>
}

interface NotificationAction {
  id: string
  label: string
  variant: 'primary' | 'secondary' | 'danger'
  action: string
  parameters?: Record<string, any>
}

interface NotificationSettings {
  desktop: {
    enabled: boolean
    sound: boolean
  }
  levels: Record<string, {
    showToast: boolean
    nativeNotification: boolean
    sound: string
  }>
  autoDelete: number // 日数
}
```

## 完了条件
- [ ] RiskNotificationSystem 実装
- [ ] NotificationCenter 実装
- [ ] AlertToast 実装
- [ ] NotificationSettings 実装
- [ ] useNotifications hook実装
- [ ] 通知の永続化機能
- [ ] 音声通知機能
- [ ] 通知フィルタリング機能
- [ ] コンポーネントテスト実装

## 通知レベル別動作
- **Emergency**: 自動消失なし、強制表示、アラーム音
- **Critical**: 10秒表示、警告音
- **Danger**: 7秒表示、注意音
- **Warning**: 5秒表示、通知音
- **Info**: 3秒表示、軽い通知音

## 参考ファイル
- 既存の通知・アラート機能
- CLAUDE.mdの通知システム例

## 注意事項
- 通知権限の取得・管理
- 通知のスパム防止
- パフォーマンス最適化（大量通知時）
- アクセシビリティ対応（スクリーンリーダー）
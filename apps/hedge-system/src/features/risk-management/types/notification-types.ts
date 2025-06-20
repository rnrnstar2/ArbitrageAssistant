export interface RiskAlert {
  id: string
  type: 'margin_level' | 'loss_cut' | 'profit_target' | 'connection_lost' | 'system_error'
  priority: 'low' | 'medium' | 'high' | 'critical'
  message: string
  accountId: string
  timestamp: Date
  acknowledged: boolean
  data: Record<string, any>
}

export interface NotificationChannel {
  type: 'desktop' | 'sound' | 'email' | 'webhook'
  isEnabled: boolean
  settings: {
    desktop?: DesktopNotificationSettings
    sound?: SoundNotificationSettings
    email?: EmailNotificationSettings
    webhook?: WebhookNotificationSettings
  }
}

export interface DesktopNotificationSettings {
  duration: number
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  requireInteraction: boolean
  showActions: boolean
}

export interface SoundNotificationSettings {
  soundType: 'alert' | 'warning' | 'critical' | 'custom'
  volume: number
  repeat: number
  customSoundPath?: string
}

export interface EmailNotificationSettings {
  recipients: string[]
  template: 'basic' | 'detailed' | 'custom'
  customTemplate?: string
  attachments: boolean
}

export interface WebhookNotificationSettings {
  url: string
  headers: Record<string, string>
  retryCount: number
  timeout: number
}

export interface NotificationSettings {
  channels: {
    desktop?: DesktopNotificationSettings & { isEnabled: boolean }
    sound?: SoundNotificationSettings & { isEnabled: boolean }
    email?: EmailNotificationSettings & { isEnabled: boolean }
    webhook?: WebhookNotificationSettings & { isEnabled: boolean }
  }
  priorityFilter?: RiskAlert['priority']
  timeRestrictions?: {
    enabled: boolean
    startTime: number // minutes from midnight
    endTime: number   // minutes from midnight
  }
  rateLimiting?: {
    enabled: boolean
    maxPerMinute: number
    maxPerHour: number
  }
}

export interface NotificationHistory {
  id: string
  alertId: string
  channel: string
  timestamp: Date
  success: boolean
  error?: string
  deliveryTime?: number // milliseconds
}

export interface NotificationStats {
  total: number
  successful: number
  failed: number
  averageDeliveryTime: number
  byChannel: Record<string, {
    total: number
    successful: number
    failed: number
    averageDeliveryTime: number
  }>
  byPriority: Record<string, {
    total: number
    successful: number
    failed: number
  }>
}
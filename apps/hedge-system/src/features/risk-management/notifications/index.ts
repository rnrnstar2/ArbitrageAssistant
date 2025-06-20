// Main notification system components
export { RiskNotificationSystem } from './RiskNotificationSystem'
export { DesktopNotification, useDesktopNotification } from './DesktopNotification'
export { NotificationSettings } from './NotificationSettings'

// Notification managers and services
export { 
  SoundNotificationManager, 
  createSoundNotificationManager, 
  getDefaultSoundSettings 
} from './SoundNotificationManager'
export { EmailNotificationSender } from './EmailNotificationSender'

// Types
export type {
  RiskAlert,
  NotificationChannel,
  NotificationSettings as NotificationSettingsType,
  DesktopNotificationSettings,
  SoundNotificationSettings,
  EmailNotificationSettings,
  WebhookNotificationSettings,
  NotificationHistory,
  NotificationStats
} from '../types/notification-types'
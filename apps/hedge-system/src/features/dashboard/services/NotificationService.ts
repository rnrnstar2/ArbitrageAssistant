import { invoke } from '@tauri-apps/api/core'
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification'

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'critical'
export type SoundType = 'default' | 'glass' | 'basso' | 'blow' | 'bottle' | 'frog' | 'funk' | 'hero' | 'morse' | 'ping' | 'pop' | 'purr' | 'sosumi' | 'submarine' | 'tink'

export interface NotificationOptions {
  title: string
  body: string
  type?: NotificationType
  icon?: string
  sound?: SoundType | boolean
  persistent?: boolean
  actions?: NotificationAction[]
  silent?: boolean
  tag?: string
}

export interface NotificationAction {
  id: string
  title: string
}

export interface NotificationSettings {
  enableDesktopNotifications: boolean
  enableSounds: boolean
  defaultSound: SoundType
  persistentNotifications: boolean
  autoClose: boolean
  autoCloseDelay: number // seconds
  enableMacOSNotifications: boolean
  maxHistorySize: number
}

export interface NotificationHistory {
  id: string
  title: string
  body: string
  type: NotificationType
  timestamp: Date
  acknowledged: boolean
  persistent: boolean
  tag?: string
}

class NotificationService {
  private static instance: NotificationService
  private settings: NotificationSettings
  private history: NotificationHistory[] = []
  private audioContext: AudioContext | null = null
  private soundCache: Map<SoundType, AudioBuffer> = new Map()
  private permissionGranted: boolean = false

  private constructor() {
    this.settings = this.loadSettings()
    this.initializeAudioContext()
    this.checkPermissions()
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private loadSettings(): NotificationSettings {
    const defaultSettings: NotificationSettings = {
      enableDesktopNotifications: true,
      enableSounds: true,
      defaultSound: 'glass',
      persistentNotifications: false,
      autoClose: true,
      autoCloseDelay: 5,
      enableMacOSNotifications: true,
      maxHistorySize: 100
    }

    try {
      const saved = localStorage.getItem('notification-settings')
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
    } catch {
      return defaultSettings
    }
  }

  private saveSettings(): void {
    localStorage.setItem('notification-settings', JSON.stringify(this.settings))
  }

  private loadHistory(): NotificationHistory[] {
    try {
      const saved = localStorage.getItem('notification-history')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
      }
    } catch {
      // Ignore errors and return empty array
    }
    return []
  }

  private saveHistory(): void {
    // Keep only the latest notifications based on maxHistorySize
    if (this.history.length > this.settings.maxHistorySize) {
      this.history = this.history
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, this.settings.maxHistorySize)
    }
    
    localStorage.setItem('notification-history', JSON.stringify(this.history))
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('Failed to initialize audio context:', error)
    }
  }

  private async checkPermissions(): Promise<void> {
    try {
      this.permissionGranted = await isPermissionGranted()
      if (!this.permissionGranted) {
        const permission = await requestPermission()
        this.permissionGranted = permission === 'granted'
      }
    } catch (error) {
      console.warn('Failed to check notification permissions:', error)
    }
  }

  private async playSound(soundType: SoundType): Promise<void> {
    if (!this.settings.enableSounds || !this.audioContext) return

    try {
      // Use macOS system sounds via osascript if available
      if (this.settings.enableMacOSNotifications && window.__TAURI__) {
        await this.playMacOSSound(soundType)
        return
      }

      // Fallback to web audio (if we had sound files)
      console.log(`Playing sound: ${soundType}`)
    } catch (error) {
      console.warn('Failed to play sound:', error)
    }
  }

  private async playMacOSSound(soundType: SoundType): Promise<void> {
    try {
      const soundName = this.mapSoundTypeToMacOS(soundType)
      await invoke('run_osascript', {
        script: `do shell script "afplay /System/Library/Sounds/${soundName}.aiff"`
      })
    } catch (error) {
      console.warn('Failed to play macOS sound:', error)
    }
  }

  private mapSoundTypeToMacOS(soundType: SoundType): string {
    const soundMap: Record<SoundType, string> = {
      default: 'Glass',
      glass: 'Glass',
      basso: 'Basso',
      blow: 'Blow',
      bottle: 'Bottle',
      frog: 'Frog',
      funk: 'Funk',
      hero: 'Hero',
      morse: 'Morse',
      ping: 'Ping',
      pop: 'Pop',
      purr: 'Purr',
      sosumi: 'Sosumi',
      submarine: 'Submarine',
      tink: 'Tink'
    }
    return soundMap[soundType] || 'Glass'
  }

  private getIconForType(type: NotificationType): string | undefined {
    // In a real implementation, you would map these to actual icon files
    const iconMap: Record<NotificationType, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
      critical: '🚨'
    }
    return iconMap[type]
  }

  private addToHistory(notification: NotificationOptions, id: string): void {
    const historyEntry: NotificationHistory = {
      id,
      title: notification.title,
      body: notification.body,
      type: notification.type || 'info',
      timestamp: new Date(),
      acknowledged: false,
      persistent: notification.persistent || false,
      tag: notification.tag
    }

    this.history.unshift(historyEntry)
    this.saveHistory()
  }

  public async notify(options: NotificationOptions): Promise<string> {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Add to history
    this.addToHistory(options, id)

    // Play sound if enabled
    if (options.sound !== false) {
      const soundType = typeof options.sound === 'string' ? options.sound : this.settings.defaultSound
      await this.playSound(soundType)
    }

    // Show desktop notification if enabled and permission granted
    if (this.settings.enableDesktopNotifications && this.permissionGranted && !options.silent) {
      try {
        await sendNotification({
          title: options.title,
          body: options.body,
          icon: options.icon || this.getIconForType(options.type || 'info')
        })
      } catch (error) {
        console.warn('Failed to send desktop notification:', error)
      }
    }

    // macOS osascript notification for critical alerts
    if (options.type === 'critical' || options.type === 'error') {
      await this.sendMacOSNotification(options.title, options.body, options.type)
    }

    return id
  }

  private async sendMacOSNotification(title: string, body: string, type: NotificationType): Promise<void> {
    if (!this.settings.enableMacOSNotifications || !window.__TAURI__) return

    try {
      const soundName = type === 'critical' ? 'Basso' : 'Glass'
      const script = `display notification "${body}" with title "${title}" sound name "${soundName}"`
      
      await invoke('run_osascript', { script })
    } catch (error) {
      console.warn('Failed to send macOS notification:', error)
    }
  }

  // Convenience methods for different notification types
  public async info(title: string, body: string, options?: Partial<NotificationOptions>): Promise<string> {
    return this.notify({ title, body, type: 'info', ...options })
  }

  public async warning(title: string, body: string, options?: Partial<NotificationOptions>): Promise<string> {
    return this.notify({ title, body, type: 'warning', sound: 'blow', ...options })
  }

  public async error(title: string, body: string, options?: Partial<NotificationOptions>): Promise<string> {
    return this.notify({ title, body, type: 'error', sound: 'basso', ...options })
  }

  public async success(title: string, body: string, options?: Partial<NotificationOptions>): Promise<string> {
    return this.notify({ title, body, type: 'success', sound: 'glass', ...options })
  }

  public async critical(title: string, body: string, options?: Partial<NotificationOptions>): Promise<string> {
    return this.notify({ 
      title, 
      body, 
      type: 'critical', 
      sound: 'basso', 
      persistent: true, 
      ...options 
    })
  }

  // Settings management
  public getSettings(): NotificationSettings {
    return { ...this.settings }
  }

  public updateSettings(newSettings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveSettings()
  }

  // History management
  public getHistory(): NotificationHistory[] {
    if (this.history.length === 0) {
      this.history = this.loadHistory()
    }
    return [...this.history]
  }

  public acknowledgeNotification(id: string): void {
    const notification = this.history.find(n => n.id === id)
    if (notification) {
      notification.acknowledged = true
      this.saveHistory()
    }
  }

  public clearHistory(): void {
    this.history = []
    localStorage.removeItem('notification-history')
  }

  public clearAcknowledged(): void {
    this.history = this.history.filter(n => !n.acknowledged)
    this.saveHistory()
  }

  // Test notifications
  public async testNotification(): Promise<void> {
    await this.info(
      'テスト通知',
      'これはテスト通知です。通知システムが正常に動作しています。',
      { sound: this.settings.defaultSound }
    )
  }

  public async testSound(soundType: SoundType): Promise<void> {
    await this.playSound(soundType)
  }

  // CLAUDE.md compliance - completion notifications
  public async notifyTaskCompletion(taskName: string): Promise<void> {
    await invoke('run_osascript', {
      script: `display notification "タスク完了: ${taskName}" with title "ArbitrageAssistant" sound name "Glass"`
    }).catch(() => {
      // Fallback to regular notification
      this.success('タスク完了', `${taskName}が完了しました`)
    })
  }

  public async notifyTaskError(taskName: string, error: string): Promise<void> {
    await invoke('run_osascript', {
      script: `display notification "エラー: ${error}" with title "ArbitrageAssistant" sound name "Basso"`
    }).catch(() => {
      // Fallback to regular notification
      this.error('タスクエラー', `${taskName}: ${error}`)
    })
  }
}

export const notificationService = NotificationService.getInstance()
export default notificationService
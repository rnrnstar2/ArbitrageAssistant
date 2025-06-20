import { 
  ProcessedAlert, 
  AlertSearchCriteria, 
  AlertHistoryManager as IAlertHistoryManager 
} from './alert-receiver';

export interface AlertStorage {
  alerts: ProcessedAlert[];
  lastCleanup: Date;
  version: string;
}

export interface AlertStatistics {
  totalAlerts: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  alertsByAccount: Record<string, number>;
  recentAlerts: number; // Last 24 hours
  criticalAlerts: number;
}

export class AlertHistoryManager implements IAlertHistoryManager {
  private static readonly STORAGE_KEY = 'arbitrage_assistant_alert_history';
  private static readonly MAX_ALERTS = 10000; // Maximum alerts to keep in memory
  private static readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly RETENTION_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days

  private alertCache: Map<string, ProcessedAlert> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeStorage();
    
    // Setup periodic cleanup
    setInterval(() => {
      this.deleteExpiredAlerts().catch(console.error);
    }, AlertHistoryManager.CLEANUP_INTERVAL);
  }

  async saveAlert(alert: ProcessedAlert): Promise<void> {
    try {
      await this.ensureInitialized();
      
      // Add to cache
      this.alertCache.set(alert.id, alert);
      
      // Persist to storage
      await this.persistToStorage();
      
      console.debug(`Alert saved to history: ${alert.id}`);
      
    } catch (error) {
      console.error('Failed to save alert to history:', error);
      throw error;
    }
  }

  async getAlertHistory(accountId: string, limit: number = 100): Promise<ProcessedAlert[]> {
    await this.ensureInitialized();
    
    const alerts = Array.from(this.alertCache.values())
      .filter(alert => alert.accountId === accountId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    
    return alerts;
  }

  async deleteExpiredAlerts(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const cutoffTime = new Date(Date.now() - AlertHistoryManager.RETENTION_PERIOD);
      const initialCount = this.alertCache.size;
      
      // Remove expired alerts
      for (const [id, alert] of Array.from(this.alertCache.entries())) {
        if (alert.timestamp < cutoffTime || (alert.expiresAt && alert.expiresAt < new Date())) {
          this.alertCache.delete(id);
        }
      }
      
      // If we have too many alerts, remove oldest ones
      if (this.alertCache.size > AlertHistoryManager.MAX_ALERTS) {
        const sortedAlerts = Array.from(this.alertCache.values())
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        const alertsToKeep = sortedAlerts.slice(0, AlertHistoryManager.MAX_ALERTS);
        this.alertCache.clear();
        
        for (const alert of alertsToKeep) {
          this.alertCache.set(alert.id, alert);
        }
      }
      
      const removedCount = initialCount - this.alertCache.size;
      if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} expired alerts from history`);
        await this.persistToStorage();
      }
      
    } catch (error) {
      console.error('Failed to delete expired alerts:', error);
    }
  }

  async searchAlerts(criteria: AlertSearchCriteria): Promise<ProcessedAlert[]> {
    await this.ensureInitialized();
    
    let alerts = Array.from(this.alertCache.values());
    
    // Apply filters
    if (criteria.accountId) {
      alerts = alerts.filter(alert => alert.accountId === criteria.accountId);
    }
    
    if (criteria.type) {
      alerts = alerts.filter(alert => alert.type === criteria.type);
    }
    
    if (criteria.severity) {
      alerts = alerts.filter(alert => alert.severity === criteria.severity);
    }
    
    if (criteria.startDate) {
      alerts = alerts.filter(alert => alert.timestamp >= criteria.startDate!);
    }
    
    if (criteria.endDate) {
      alerts = alerts.filter(alert => alert.timestamp <= criteria.endDate!);
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return alerts;
  }

  // Additional utility methods

  async getAlertById(alertId: string): Promise<ProcessedAlert | null> {
    await this.ensureInitialized();
    return this.alertCache.get(alertId) || null;
  }

  async getAllAlerts(): Promise<ProcessedAlert[]> {
    await this.ensureInitialized();
    return Array.from(this.alertCache.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRecentAlerts(hours: number = 24): Promise<ProcessedAlert[]> {
    await this.ensureInitialized();
    
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.alertCache.values())
      .filter(alert => alert.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAlertStatistics(): Promise<AlertStatistics> {
    await this.ensureInitialized();
    
    const alerts = Array.from(this.alertCache.values());
    const recent24h = await this.getRecentAlerts(24);
    
    const stats: AlertStatistics = {
      totalAlerts: alerts.length,
      alertsByType: {},
      alertsBySeverity: {},
      alertsByAccount: {},
      recentAlerts: recent24h.length,
      criticalAlerts: alerts.filter(alert => alert.severity === 'critical').length
    };
    
    // Count by type
    for (const alert of alerts) {
      stats.alertsByType[alert.type] = (stats.alertsByType[alert.type] || 0) + 1;
      stats.alertsBySeverity[alert.severity] = (stats.alertsBySeverity[alert.severity] || 0) + 1;
      stats.alertsByAccount[alert.accountId] = (stats.alertsByAccount[alert.accountId] || 0) + 1;
    }
    
    return stats;
  }

  async clearHistory(accountId?: string): Promise<void> {
    await this.ensureInitialized();
    
    if (accountId) {
      // Clear alerts for specific account
      for (const [id, alert] of Array.from(this.alertCache.entries())) {
        if (alert.accountId === accountId) {
          this.alertCache.delete(id);
        }
      }
    } else {
      // Clear all alerts
      this.alertCache.clear();
    }
    
    await this.persistToStorage();
    console.log(`Alert history cleared${accountId ? ` for account: ${accountId}` : ''}`);
  }

  async exportHistory(format: 'json' | 'csv' = 'json'): Promise<string> {
    await this.ensureInitialized();
    
    const alerts = Array.from(this.alertCache.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (format === 'csv') {
      return this.exportAsCSV(alerts);
    } else {
      return JSON.stringify(alerts, null, 2);
    }
  }

  async importHistory(data: string, format: 'json' | 'csv' = 'json'): Promise<number> {
    try {
      let alerts: ProcessedAlert[];
      
      if (format === 'csv') {
        alerts = this.importFromCSV(data);
      } else {
        alerts = JSON.parse(data);
      }
      
      // Validate and add alerts
      let importCount = 0;
      for (const alert of alerts) {
        if (this.validateAlert(alert)) {
          // Convert timestamp strings back to Date objects
          alert.timestamp = new Date(alert.timestamp);
          if (alert.expiresAt) {
            alert.expiresAt = new Date(alert.expiresAt);
          }
          
          this.alertCache.set(alert.id, alert);
          importCount++;
        }
      }
      
      await this.persistToStorage();
      console.log(`Imported ${importCount} alerts from ${format.toUpperCase()}`);
      
      return importCount;
      
    } catch (error) {
      console.error('Failed to import alert history:', error);
      throw error;
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      const stored = await this.loadFromStorage();
      
      if (stored && stored.alerts) {
        for (const alert of stored.alerts) {
          // Convert string timestamps back to Date objects
          alert.timestamp = new Date(alert.timestamp);
          if (alert.expiresAt) {
            alert.expiresAt = new Date(alert.expiresAt);
          }
          
          this.alertCache.set(alert.id, alert);
        }
      }
      
      this.isInitialized = true;
      console.log(`Alert history initialized with ${this.alertCache.size} alerts`);
      
    } catch (error) {
      console.error('Failed to initialize alert history storage:', error);
      this.isInitialized = true; // Continue with empty cache
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeStorage();
    }
  }

  private async loadFromStorage(): Promise<AlertStorage | null> {
    try {
      if (typeof window === 'undefined') {
        return null; // Server-side, no storage available
      }
      
      const stored = localStorage.getItem(AlertHistoryManager.STORAGE_KEY);
      if (!stored) {
        return null;
      }
      
      return JSON.parse(stored) as AlertStorage;
      
    } catch (error) {
      console.error('Failed to load alert history from storage:', error);
      return null;
    }
  }

  private async persistToStorage(): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        return; // Server-side, no storage available
      }
      
      const storage: AlertStorage = {
        alerts: Array.from(this.alertCache.values()),
        lastCleanup: new Date(),
        version: '1.0'
      };
      
      localStorage.setItem(AlertHistoryManager.STORAGE_KEY, JSON.stringify(storage));
      
    } catch (error) {
      console.error('Failed to persist alert history to storage:', error);
      
      // If localStorage is full, try to free space by removing old alerts
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, cleaning up old alerts');
        await this.deleteExpiredAlerts();
      }
    }
  }

  private validateAlert(alert: any): alert is ProcessedAlert {
    return (
      alert &&
      typeof alert.id === 'string' &&
      typeof alert.type === 'string' &&
      typeof alert.severity === 'string' &&
      typeof alert.accountId === 'string' &&
      typeof alert.message === 'string' &&
      (alert.timestamp instanceof Date || typeof alert.timestamp === 'string') &&
      alert.category &&
      typeof alert.priority === 'number' &&
      Array.isArray(alert.rules) &&
      Array.isArray(alert.actions)
    );
  }

  private exportAsCSV(alerts: ProcessedAlert[]): string {
    const headers = [
      'ID', 'Type', 'Severity', 'Account ID', 'Message', 'Timestamp', 
      'Priority', 'Category', 'Expires At'
    ];
    
    const rows = alerts.map(alert => [
      alert.id,
      alert.type,
      alert.severity,
      alert.accountId,
      `"${alert.message.replace(/"/g, '""')}"`,
      alert.timestamp.toISOString(),
      alert.priority.toString(),
      alert.category.name,
      alert.expiresAt?.toISOString() || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private importFromCSV(csv: string): ProcessedAlert[] {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    const alerts: ProcessedAlert[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;
      
      try {
        const alert: ProcessedAlert = {
          id: values[0],
          type: values[1] as any,
          severity: values[2] as any,
          timestamp: new Date(values[5]),
          accountId: values[3],
          message: values[4].replace(/^"|"$/g, '').replace(/""/g, '"'),
          priority: parseInt(values[6]),
          category: { name: values[7], level: 1, autoActions: [] },
          rules: [],
          actions: [],
          expiresAt: values[8] ? new Date(values[8]) : undefined
        };
        
        alerts.push(alert);
      } catch (error) {
        console.warn(`Failed to parse CSV line ${i + 1}:`, error);
      }
    }
    
    return alerts;
  }

  // Public getters for monitoring
  public getCacheSize(): number {
    return this.alertCache.size;
  }

  public getStorageKey(): string {
    return AlertHistoryManager.STORAGE_KEY;
  }
}
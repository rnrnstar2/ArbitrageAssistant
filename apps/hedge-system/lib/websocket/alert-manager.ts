import { 
  BaseAlert, 
  ProcessedAlert, 
  AlertCategory, 
  AlertRule, 
  AlertAction, 
  AlertType,
  AlertManager as IAlertManager
} from './alert-receiver';

export interface AlertConfiguration {
  categories: Record<AlertType, AlertCategory>;
  rules: AlertRule[];
  defaultActions: Record<BaseAlert['severity'], AlertAction[]>;
  priorityWeights: {
    severity: number;
    frequency: number;
    category: number;
    age: number;
  };
}

export class AlertManager implements IAlertManager {
  private config: AlertConfiguration;
  private alertFrequencyCounter: Map<string, number> = new Map();
  private alertTimestamps: Map<string, Date[]> = new Map();
  private readonly frequencyWindowMs = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<AlertConfiguration>) {
    this.config = {
      categories: this.getDefaultCategories(),
      rules: this.getDefaultRules(),
      defaultActions: this.getDefaultActions(),
      priorityWeights: {
        severity: 0.4,
        frequency: 0.3,
        category: 0.2,
        age: 0.1
      },
      ...config
    };

    // Clean frequency counters every minute
    setInterval(() => {
      this.cleanFrequencyCounters();
    }, 60 * 1000);
  }

  async processAlert(alert: BaseAlert): Promise<ProcessedAlert> {
    // Update frequency tracking
    this.updateAlertFrequency(alert);

    // Categorize the alert
    const category = this.categorizeAlert(alert);

    // Calculate priority
    const priority = this.calculatePriority(alert);

    // Check applicable rules
    const rules = this.checkAlertRules(alert);

    // Determine actions from rules and defaults
    const actions = this.determineActions(alert, rules);

    // Set expiration if needed
    const expiresAt = this.calculateExpirationTime(alert, category);

    const processedAlert: ProcessedAlert = {
      ...alert,
      category,
      priority,
      rules,
      actions,
      expiresAt
    };

    return processedAlert;
  }

  categorizeAlert(alert: BaseAlert): AlertCategory {
    const category = this.config.categories[alert.type];
    if (!category) {
      // Return default category for unknown types
      return {
        name: 'unknown',
        level: 1,
        autoActions: ['notify']
      };
    }
    return category;
  }

  calculatePriority(alert: BaseAlert): number {
    const weights = this.config.priorityWeights;
    let priority = 0;

    // Severity weight (0-1)
    const severityScore = this.getSeverityScore(alert.severity);
    priority += severityScore * weights.severity;

    // Frequency weight (0-1)
    const frequencyScore = this.getFrequencyScore(alert);
    priority += frequencyScore * weights.frequency;

    // Category weight (0-1)
    const categoryScore = this.getCategoryScore(alert.type);
    priority += categoryScore * weights.category;

    // Age weight (0-1) - newer alerts have higher priority
    const ageScore = this.getAgeScore(alert.timestamp);
    priority += ageScore * weights.age;

    // Normalize to 0-100 scale
    return Math.round(Math.max(0, Math.min(100, priority * 100)));
  }

  checkAlertRules(alert: BaseAlert): AlertRule[] {
    const applicableRules: AlertRule[] = [];

    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;

      if (this.evaluateRuleCondition(rule.condition, alert)) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  private determineActions(alert: BaseAlert, rules: AlertRule[]): AlertAction[] {
    const actions: AlertAction[] = [];
    const actionTypes = new Set<string>();

    // Add actions from rules
    for (const rule of rules) {
      if (!actionTypes.has(rule.action.type)) {
        actions.push(rule.action);
        actionTypes.add(rule.action.type);
      }
    }

    // Add default actions for severity level if not already present
    const defaultActions = this.config.defaultActions[alert.severity] || [];
    for (const defaultAction of defaultActions) {
      if (!actionTypes.has(defaultAction.type)) {
        actions.push(defaultAction);
        actionTypes.add(defaultAction.type);
      }
    }

    return actions;
  }

  private getSeverityScore(severity: BaseAlert['severity']): number {
    switch (severity) {
      case 'critical': return 1.0;
      case 'error': return 0.8;
      case 'warning': return 0.6;
      case 'info': return 0.4;
      default: return 0.2;
    }
  }

  private getFrequencyScore(alert: BaseAlert): number {
    const key = `${alert.accountId}:${alert.type}`;
    const frequency = this.alertFrequencyCounter.get(key) || 0;
    
    // Higher frequency = higher priority (up to a point)
    // After 10 occurrences, priority doesn't increase further
    return Math.min(1.0, frequency / 10);
  }

  private getCategoryScore(alertType: AlertType): number {
    const category = this.config.categories[alertType];
    if (!category) return 0.5;
    
    // Higher category level = higher priority
    return Math.min(1.0, category.level / 5);
  }

  private getAgeScore(timestamp: Date): number {
    const ageMs = Date.now() - timestamp.getTime();
    const maxAgeMs = 60 * 60 * 1000; // 1 hour
    
    // Newer alerts have higher priority
    return Math.max(0, 1 - (ageMs / maxAgeMs));
  }

  private evaluateRuleCondition(condition: string, alert: BaseAlert): boolean {
    try {
      // Simple condition evaluation - can be extended
      const context = {
        alert,
        type: alert.type,
        severity: alert.severity,
        accountId: alert.accountId,
        message: alert.message
      };

      // Basic condition parser - replace with more sophisticated one if needed
      return this.parseCondition(condition, context);
    } catch (error) {
      console.warn('Error evaluating rule condition:', condition, error);
      return false;
    }
  }

  private parseCondition(condition: string, context: any): boolean {
    // Simple condition parser for basic expressions
    // Format: "property operator value"
    // Examples: "severity === 'critical'", "type === 'losscut'"
    
    const cleanCondition = condition.trim();
    
    // Handle equals operator
    if (cleanCondition.includes('===')) {
      const [left, right] = cleanCondition.split('===').map(s => s.trim());
      const leftValue = this.getContextValue(left, context);
      const rightValue = this.parseValue(right);
      return leftValue === rightValue;
    }
    
    // Handle not equals operator
    if (cleanCondition.includes('!==')) {
      const [left, right] = cleanCondition.split('!==').map(s => s.trim());
      const leftValue = this.getContextValue(left, context);
      const rightValue = this.parseValue(right);
      return leftValue !== rightValue;
    }
    
    // Handle contains operator
    if (cleanCondition.includes('includes')) {
      const match = cleanCondition.match(/(\w+)\.includes\((.+)\)/);
      if (match) {
        const [, property, value] = match;
        const contextValue = this.getContextValue(property, context);
        const searchValue = this.parseValue(value);
        return String(contextValue).includes(String(searchValue));
      }
    }
    
    // Default: return false for unknown conditions
    return false;
  }

  private getContextValue(property: string, context: any): any {
    const parts = property.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private parseValue(value: string): any {
    const trimmed = value.trim();
    
    // String literal
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    
    // Number
    if (!isNaN(Number(trimmed))) {
      return Number(trimmed);
    }
    
    // Boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    
    // Default: return as string
    return trimmed;
  }

  private updateAlertFrequency(alert: BaseAlert): void {
    const key = `${alert.accountId}:${alert.type}`;
    
    // Update counter
    const currentCount = this.alertFrequencyCounter.get(key) || 0;
    this.alertFrequencyCounter.set(key, currentCount + 1);
    
    // Update timestamps for window-based frequency calculation
    const timestamps = this.alertTimestamps.get(key) || [];
    timestamps.push(alert.timestamp);
    this.alertTimestamps.set(key, timestamps);
  }

  private cleanFrequencyCounters(): void {
    const cutoffTime = new Date(Date.now() - this.frequencyWindowMs);
    
    for (const [key, timestamps] of Array.from(this.alertTimestamps.entries())) {
      // Remove old timestamps
      const recentTimestamps = timestamps.filter(ts => ts > cutoffTime);
      
      if (recentTimestamps.length === 0) {
        this.alertTimestamps.delete(key);
        this.alertFrequencyCounter.delete(key);
      } else {
        this.alertTimestamps.set(key, recentTimestamps);
        this.alertFrequencyCounter.set(key, recentTimestamps.length);
      }
    }
  }

  private calculateExpirationTime(alert: BaseAlert, category: AlertCategory): Date | undefined {
    // Set expiration based on alert type and severity
    let expirationMinutes: number;
    
    switch (alert.severity) {
      case 'critical':
        expirationMinutes = 60; // 1 hour
        break;
      case 'error':
        expirationMinutes = 120; // 2 hours
        break;
      case 'warning':
        expirationMinutes = 240; // 4 hours
        break;
      case 'info':
        expirationMinutes = 480; // 8 hours
        break;
      default:
        expirationMinutes = 240;
    }
    
    return new Date(alert.timestamp.getTime() + expirationMinutes * 60 * 1000);
  }

  private getDefaultCategories(): Record<AlertType, AlertCategory> {
    return {
      losscut: {
        name: 'Trading Risk',
        level: 5,
        autoActions: ['notify', 'emergency_stop']
      },
      margin_call: {
        name: 'Trading Risk',
        level: 4,
        autoActions: ['notify']
      },
      system_error: {
        name: 'System',
        level: 3,
        autoActions: ['notify']
      },
      trade_error: {
        name: 'Trading',
        level: 3,
        autoActions: ['notify']
      },
      connection_error: {
        name: 'Connectivity',
        level: 2,
        autoActions: ['notify']
      },
      data_error: {
        name: 'Data Quality',
        level: 2,
        autoActions: ['notify']
      }
    };
  }

  private getDefaultRules(): AlertRule[] {
    return [
      {
        id: 'critical_losscut',
        condition: "type === 'losscut' && severity === 'critical'",
        action: {
          type: 'emergency_stop',
          config: { reason: 'Critical losscut alert received' }
        },
        enabled: true
      },
      {
        id: 'repeated_connection_errors',
        condition: "type === 'connection_error'",
        action: {
          type: 'webhook',
          config: { url: 'system_alert_webhook' }
        },
        enabled: true
      },
      {
        id: 'high_frequency_alerts',
        condition: "frequency > 5",
        action: {
          type: 'email',
          config: { subject: 'High frequency alert detected' }
        },
        enabled: true
      }
    ];
  }

  private getDefaultActions(): Record<BaseAlert['severity'], AlertAction[]> {
    return {
      critical: [
        { type: 'notify', config: { sound: 'Basso', persistent: true } },
        { type: 'email', config: { priority: 'high' } }
      ],
      error: [
        { type: 'notify', config: { sound: 'Sosumi', persistent: false } }
      ],
      warning: [
        { type: 'notify', config: { sound: 'Purr', persistent: false } }
      ],
      info: [
        { type: 'notify', config: { sound: 'Glass', persistent: false } }
      ]
    };
  }

  // Public configuration methods
  public updateConfiguration(config: Partial<AlertConfiguration>): void {
    this.config = { ...this.config, ...config };
  }

  public addRule(rule: AlertRule): void {
    const existingIndex = this.config.rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.config.rules[existingIndex] = rule;
    } else {
      this.config.rules.push(rule);
    }
  }

  public removeRule(ruleId: string): void {
    this.config.rules = this.config.rules.filter(r => r.id !== ruleId);
  }

  public getConfiguration(): AlertConfiguration {
    return { ...this.config };
  }

  public getFrequencyStats(): Map<string, number> {
    return new Map(this.alertFrequencyCounter);
  }
}
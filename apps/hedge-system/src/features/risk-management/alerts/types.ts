export interface AlertCondition {
  id: string;
  type: 'margin_level' | 'free_margin' | 'floating_loss' | 'profit_target';
  threshold: number;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  cooldownPeriod: number; // 秒
  isActive: boolean;
  accountId?: string; // 特定の口座に限定
  comparison: 'less_than' | 'greater_than' | 'equals';
}

export interface RiskAlertState {
  id: string;
  conditionId: string;
  accountId: string;
  type: AlertCondition['type'];
  severity: AlertCondition['severity'];
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  isAcknowledged: boolean;
  isSuppressed: boolean; // 誤発報防止
  metadata?: Record<string, any>;
}

export interface AlertChannel {
  type: 'desktop' | 'sound' | 'email' | 'webhook';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface AlertDispatchConfig {
  channels: AlertChannel[];
  priorityThresholds: {
    info: string[];
    warning: string[];
    danger: string[];
    critical: string[];
  };
  globalMute: boolean;
  testMode: boolean;
}

export interface AlertHistory {
  alerts: RiskAlertState[];
  lastCleanup: Date;
  retentionDays: number;
}

export interface MarginLevelAlert extends AlertCondition {
  type: 'margin_level';
  includeBonus: boolean;
}

export interface AlertSuppression {
  alertId: string;
  suppressUntil: Date;
  reason: 'cooldown' | 'oscillation' | 'manual';
  count: number;
}

export interface AlertStats {
  totalAlerts: number;
  alertsBySeverity: Record<AlertCondition['severity'], number>;
  alertsByType: Record<AlertCondition['type'], number>;
  suppressedAlerts: number;
  acknowledgedAlerts: number;
  lastAlertTime?: Date;
}
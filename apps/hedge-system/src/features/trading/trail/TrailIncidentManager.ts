import { EventEmitter } from 'events';
import { TrailError, TrailErrorHandler, TrailRecoveryResult } from './TrailErrorHandler';
import { TrailRecoveryManager, TrailHealthCheck } from './TrailRecoveryManager';
import { TrailSettings, TrailStatus, TRAIL_ERROR_TYPES } from './types';
import { ErrorSeverity } from '../../../lib/trading/error-handling';

/**
 * トレール障害レベル
 */
export enum TrailIncidentLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error', 
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

/**
 * トレール障害情報
 */
export interface TrailIncident {
  id: string;
  level: TrailIncidentLevel;
  title: string;
  description: string;
  positionId?: string;
  trailSettingsId?: string;
  accountId?: string;
  errorCode?: string;
  impact: {
    scope: 'single_position' | 'multiple_positions' | 'account' | 'system';
    estimatedAffectedPositions: number;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
  };
  status: 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  timeToResolution?: number; // milliseconds
  relatedErrors: string[]; // error IDs
  actions: TrailIncidentAction[];
  metrics: {
    errorCount: number;
    affectedUsers: number;
    downtimeMinutes: number;
    recoveryAttempts: number;
  };
  metadata: Record<string, any>;
}

/**
 * 障害対応アクション
 */
export interface TrailIncidentAction {
  id: string;
  type: 'investigation' | 'mitigation' | 'recovery' | 'communication' | 'prevention';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  performedBy?: string;
  performedAt?: Date;
  result?: string;
  duration?: number; // milliseconds
  metadata?: Record<string, any>;
}

/**
 * 障害ログエントリ
 */
export interface TrailIncidentLog {
  id: string;
  incidentId: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  context: Record<string, any>;
  stackTrace?: string;
}

/**
 * 手動復旧支援要求
 */
export interface ManualRecoveryRequest {
  id: string;
  incidentId: string;
  positionId: string;
  requestType: 'diagnosis' | 'recovery' | 'escalation' | 'override';
  description: string;
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  result?: TrailRecoveryResult;
  parameters: Record<string, any>;
}

/**
 * 障害管理設定
 */
export interface TrailIncidentManagerConfig {
  enableAutoTriage: boolean;
  enableAutoEscalation: boolean;
  escalationThresholds: {
    errorCountPerMinute: number;
    affectedPositionsCount: number;
    downtimeMinutes: number;
    failedRecoveryAttempts: number;
  };
  notificationConfig: {
    channels: Array<'console' | 'webhook' | 'email' | 'slack'>;
    immediateNotificationLevels: TrailIncidentLevel[];
    suppressDuplicates: boolean;
    suppressionWindowMs: number;
  };
  logRetentionConfig: {
    retentionDays: number;
    maxLogsPerIncident: number;
    compressOldLogs: boolean;
  };
  recoveryConfig: {
    enableManualRecoveryRequests: boolean;
    requireApprovalForCritical: boolean;
    autoApproveThreshold: TrailIncidentLevel;
    maxPendingRequests: number;
  };
}

const DEFAULT_INCIDENT_CONFIG: TrailIncidentManagerConfig = {
  enableAutoTriage: true,
  enableAutoEscalation: true,
  escalationThresholds: {
    errorCountPerMinute: 10,
    affectedPositionsCount: 5,
    downtimeMinutes: 5,
    failedRecoveryAttempts: 3,
  },
  notificationConfig: {
    channels: ['console'],
    immediateNotificationLevels: [TrailIncidentLevel.ERROR, TrailIncidentLevel.CRITICAL, TrailIncidentLevel.EMERGENCY],
    suppressDuplicates: true,
    suppressionWindowMs: 300000, // 5 minutes
  },
  logRetentionConfig: {
    retentionDays: 30,
    maxLogsPerIncident: 1000,
    compressOldLogs: true,
  },
  recoveryConfig: {
    enableManualRecoveryRequests: true,
    requireApprovalForCritical: true,
    autoApproveThreshold: TrailIncidentLevel.WARNING,
    maxPendingRequests: 10,
  },
};

/**
 * トレール障害管理マネージャー
 * 障害の検出、トリアージ、対応、ログ記録、手動復旧支援を提供
 */
export class TrailIncidentManager extends EventEmitter {
  private config: TrailIncidentManagerConfig;
  private errorHandler: TrailErrorHandler;
  private recoveryManager: TrailRecoveryManager;
  
  // 障害管理
  private incidents: Map<string, TrailIncident> = new Map();
  private incidentLogs: Map<string, TrailIncidentLog[]> = new Map();
  private lastNotifications: Map<string, Date> = new Map(); // 重複通知抑制用
  
  // 手動復旧支援
  private manualRecoveryRequests: Map<string, ManualRecoveryRequest> = new Map();
  
  // 統計
  private metrics = {
    totalIncidents: 0,
    incidentsByLevel: {} as Record<TrailIncidentLevel, number>,
    averageResolutionTime: 0,
    totalManualRequests: 0,
    approvedManualRequests: 0,
    preventedEscalations: 0,
  };

  constructor(
    errorHandler: TrailErrorHandler,
    recoveryManager: TrailRecoveryManager,
    config?: Partial<TrailIncidentManagerConfig>
  ) {
    super();
    this.config = { ...DEFAULT_INCIDENT_CONFIG, ...config };
    this.errorHandler = errorHandler;
    this.recoveryManager = recoveryManager;
    
    this.setupEventListeners();
    this.startMaintenanceTasks();
    
    console.log('[TrailIncidentManager] Initialized with config:', {
      autoTriage: this.config.enableAutoTriage,
      autoEscalation: this.config.enableAutoEscalation,
      manualRecovery: this.config.recoveryConfig.enableManualRecoveryRequests,
    });
  }

  /**
   * トレールエラーから障害を作成
   */
  async createIncidentFromError(error: TrailError, context?: Record<string, any>): Promise<string> {
    const incidentLevel = this.mapErrorSeverityToIncidentLevel(error.severity);
    const impact = this.assessErrorImpact(error);
    
    const incident: TrailIncident = {
      id: this.generateIncidentId(),
      level: incidentLevel,
      title: this.generateIncidentTitle(error),
      description: this.generateIncidentDescription(error, context),
      positionId: error.positionId,
      trailSettingsId: error.trailId,
      accountId: error.context?.accountId,
      errorCode: error.code,
      impact,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      relatedErrors: [error.context?.errorId || 'unknown'],
      actions: [],
      metrics: {
        errorCount: 1,
        affectedUsers: impact.scope === 'system' ? 100 : 1, // 仮の値
        downtimeMinutes: 0,
        recoveryAttempts: 0,
      },
      metadata: {
        originalError: error,
        context,
        createdBy: 'auto_triage',
      },
    };
    
    this.incidents.set(incident.id, incident);
    this.metrics.totalIncidents++;
    this.metrics.incidentsByLevel[incidentLevel] = (this.metrics.incidentsByLevel[incidentLevel] || 0) + 1;
    
    // ログエントリを作成
    await this.addIncidentLog(incident.id, 'info', 'incident_created', 'Incident created from trail error', {
      errorCode: error.code,
      severity: error.severity,
      positionId: error.positionId,
    });
    
    // 自動トリアージ
    if (this.config.enableAutoTriage) {
      await this.performAutoTriage(incident);
    }
    
    // 即座通知が必要なレベルの場合
    if (this.config.notificationConfig.immediateNotificationLevels.includes(incidentLevel)) {
      await this.sendIncidentNotification(incident, 'created');
    }
    
    this.emit('incident_created', {
      incidentId: incident.id,
      level: incidentLevel,
      positionId: error.positionId,
      timestamp: new Date(),
    });
    
    console.log(`[TrailIncidentManager] Created incident ${incident.id} (${incidentLevel}) for position ${error.positionId}`);
    
    return incident.id;
  }

  /**
   * 手動復旧要求を作成
   */
  async createManualRecoveryRequest(
    incidentId: string,
    positionId: string,
    requestType: ManualRecoveryRequest['requestType'],
    description: string,
    requestedBy: string,
    parameters: Record<string, any> = {}
  ): Promise<string> {
    if (!this.config.recoveryConfig.enableManualRecoveryRequests) {
      throw new Error('Manual recovery requests are disabled');
    }
    
    // 保留中の要求数をチェック
    const pendingCount = Array.from(this.manualRecoveryRequests.values())
      .filter(req => req.status === 'pending').length;
    
    if (pendingCount >= this.config.recoveryConfig.maxPendingRequests) {
      throw new Error(`Maximum pending requests (${this.config.recoveryConfig.maxPendingRequests}) exceeded`);
    }
    
    const request: ManualRecoveryRequest = {
      id: this.generateRequestId(),
      incidentId,
      positionId,
      requestType,
      description,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      parameters,
    };
    
    this.manualRecoveryRequests.set(request.id, request);
    this.metrics.totalManualRequests++;
    
    // 自動承認の判定
    const incident = this.incidents.get(incidentId);
    if (incident && this.shouldAutoApprove(incident, request)) {
      await this.approveManualRecoveryRequest(request.id, 'auto_approval');
    }
    
    await this.addIncidentLog(incidentId, 'info', 'manual_recovery_requested', 
      `Manual recovery requested: ${requestType}`, {
        requestId: request.id,
        requestedBy,
        requestType,
      });
    
    this.emit('manual_recovery_requested', {
      requestId: request.id,
      incidentId,
      positionId,
      requestType,
      timestamp: new Date(),
    });
    
    console.log(`[TrailIncidentManager] Created manual recovery request ${request.id} for incident ${incidentId}`);
    
    return request.id;
  }

  /**
   * 手動復旧要求を承認
   */
  async approveManualRecoveryRequest(requestId: string, approvedBy: string): Promise<TrailRecoveryResult> {
    const request = this.manualRecoveryRequests.get(requestId);
    if (!request) {
      throw new Error(`Manual recovery request not found: ${requestId}`);
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending (current status: ${request.status})`);
    }
    
    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    
    await this.addIncidentLog(request.incidentId, 'info', 'manual_recovery_approved',
      `Manual recovery request approved: ${request.requestType}`, {
        requestId,
        approvedBy,
        requestType: request.requestType,
      });
    
    try {
      // 実際の復旧実行
      const result = await this.executeManualRecovery(request);
      
      request.status = 'completed';
      request.result = result;
      
      if (result.success) {
        this.metrics.approvedManualRequests++;
        
        await this.addIncidentLog(request.incidentId, 'info', 'manual_recovery_completed',
          `Manual recovery completed successfully`, {
            requestId,
            recoveryType: request.requestType,
            result: result.message,
          });
      } else {
        await this.addIncidentLog(request.incidentId, 'error', 'manual_recovery_failed',
          `Manual recovery failed: ${result.message}`, {
            requestId,
            recoveryType: request.requestType,
            error: result.message,
          });
      }
      
      this.emit('manual_recovery_completed', {
        requestId,
        incidentId: request.incidentId,
        success: result.success,
        timestamp: new Date(),
      });
      
      return result;
      
    } catch (error) {
      request.status = 'failed';
      
      await this.addIncidentLog(request.incidentId, 'error', 'manual_recovery_execution_failed',
        `Manual recovery execution failed: ${error}`, {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      
      throw error;
    }
  }

  /**
   * 障害を更新
   */
  async updateIncident(
    incidentId: string,
    updates: Partial<Omit<TrailIncident, 'id' | 'createdAt'>>,
    updatedBy?: string
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const oldStatus = incident.status;
    const oldLevel = incident.level;
    
    // 更新を適用
    Object.assign(incident, {
      ...updates,
      updatedAt: new Date(),
    });
    
    // 解決時の処理
    if (updates.status === 'resolved' && oldStatus !== 'resolved') {
      incident.resolvedAt = new Date();
      incident.timeToResolution = incident.resolvedAt.getTime() - incident.createdAt.getTime();
      
      // 平均解決時間を更新
      this.updateAverageResolutionTime(incident.timeToResolution);
    }
    
    await this.addIncidentLog(incidentId, 'info', 'incident_updated',
      `Incident updated by ${updatedBy || 'system'}`, {
        oldStatus,
        newStatus: incident.status,
        oldLevel,
        newLevel: incident.level,
        updatedBy,
      });
    
    // レベルが変更された場合の通知
    if (oldLevel !== incident.level) {
      await this.sendIncidentNotification(incident, 'level_changed');
    }
    
    // 解決時の通知
    if (incident.status === 'resolved' && oldStatus !== 'resolved') {
      await this.sendIncidentNotification(incident, 'resolved');
    }
    
    this.emit('incident_updated', {
      incidentId,
      oldStatus,
      newStatus: incident.status,
      timestamp: new Date(),
    });
  }

  /**
   * 障害にアクションを追加
   */
  async addIncidentAction(
    incidentId: string,
    actionType: TrailIncidentAction['type'],
    description: string,
    performedBy?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const action: TrailIncidentAction = {
      id: this.generateActionId(),
      type: actionType,
      description,
      status: 'completed',
      performedBy,
      performedAt: new Date(),
      metadata,
    };
    
    incident.actions.push(action);
    incident.updatedAt = new Date();
    
    await this.addIncidentLog(incidentId, 'info', 'action_added',
      `Action added: ${actionType} - ${description}`, {
        actionId: action.id,
        actionType,
        performedBy,
      });
    
    return action.id;
  }

  /**
   * 障害統計を取得
   */
  getIncidentStatistics() {
    const openIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.status === 'open');
    
    const recentIncidents = Array.from(this.incidents.values())
      .filter(incident => {
        const hourAgo = new Date(Date.now() - 3600000);
        return incident.createdAt > hourAgo;
      });
    
    return {
      ...this.metrics,
      openIncidentCount: openIncidents.length,
      recentIncidentCount: recentIncidents.length,
      pendingManualRequests: Array.from(this.manualRecoveryRequests.values())
        .filter(req => req.status === 'pending').length,
      totalActiveIncidents: Array.from(this.incidents.values())
        .filter(incident => ['open', 'investigating', 'mitigating'].includes(incident.status)).length,
    };
  }

  /**
   * 障害詳細を取得
   */
  getIncident(incidentId: string): TrailIncident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * 障害ログを取得
   */
  getIncidentLogs(incidentId: string, limit?: number): TrailIncidentLog[] {
    const logs = this.incidentLogs.get(incidentId) || [];
    return limit ? logs.slice(0, limit) : [...logs];
  }

  /**
   * リソース解放
   */
  dispose(): void {
    this.removeAllListeners();
    this.incidents.clear();
    this.incidentLogs.clear();
    this.manualRecoveryRequests.clear();
    this.lastNotifications.clear();
    
    console.log('[TrailIncidentManager] Disposed');
  }

  // Private methods

  private mapErrorSeverityToIncidentLevel(severity: ErrorSeverity): TrailIncidentLevel {
    switch (severity) {
      case ErrorSeverity.LOW:
        return TrailIncidentLevel.INFO;
      case ErrorSeverity.MEDIUM:
        return TrailIncidentLevel.WARNING;
      case ErrorSeverity.HIGH:
        return TrailIncidentLevel.ERROR;
      case ErrorSeverity.CRITICAL:
      default:
        return TrailIncidentLevel.CRITICAL;
    }
  }

  private assessErrorImpact(error: TrailError): TrailIncident['impact'] {
    // エラーの種類に基づいて影響度を評価
    let scope: TrailIncident['impact']['scope'] = 'single_position';
    let estimatedAffectedPositions = 1;
    let businessImpact: TrailIncident['impact']['businessImpact'] = 'low';
    
    switch (error.code) {
      case TRAIL_ERROR_TYPES.CONNECTION_ERROR:
        scope = 'account';
        estimatedAffectedPositions = 10;
        businessImpact = 'high';
        break;
      
      case TRAIL_ERROR_TYPES.EXECUTION_ERROR:
        scope = 'single_position';
        estimatedAffectedPositions = 1;
        businessImpact = 'medium';
        break;
      
      case TRAIL_ERROR_TYPES.CALCULATION_ERROR:
        scope = 'multiple_positions';
        estimatedAffectedPositions = 5;
        businessImpact = 'medium';
        break;
      
      case TRAIL_ERROR_TYPES.TIMEOUT_ERROR:
        scope = 'account';
        estimatedAffectedPositions = 5;
        businessImpact = 'medium';
        break;
      
      default:
        scope = 'single_position';
        estimatedAffectedPositions = 1;
        businessImpact = 'low';
    }
    
    return {
      scope,
      estimatedAffectedPositions,
      businessImpact,
    };
  }

  private generateIncidentTitle(error: TrailError): string {
    const positionInfo = error.positionId ? ` (Position: ${error.positionId})` : '';
    return `Trail ${error.code.replace(/_/g, ' ').toLowerCase()}${positionInfo}`;
  }

  private generateIncidentDescription(error: TrailError, context?: Record<string, any>): string {
    let description = `Trail error occurred: ${error.message}`;
    
    if (error.positionId) {
      description += `\nPosition ID: ${error.positionId}`;
    }
    
    if (error.trailType) {
      description += `\nTrail Type: ${error.trailType}`;
    }
    
    if (error.executionStep) {
      description += `\nExecution Step: ${error.executionStep}`;
    }
    
    if (context) {
      description += `\nAdditional Context: ${JSON.stringify(context, null, 2)}`;
    }
    
    return description;
  }

  private async performAutoTriage(incident: TrailIncident): Promise<void> {
    // レベルに基づく自動アクションの実行
    switch (incident.level) {
      case TrailIncidentLevel.CRITICAL:
      case TrailIncidentLevel.EMERGENCY:
        // クリティカルな障害の場合、即座に調査を開始
        await this.addIncidentAction(
          incident.id,
          'investigation',
          'Auto-started investigation for critical incident',
          'auto_triage'
        );
        
        // 自動エスカレーション
        if (this.config.enableAutoEscalation) {
          await this.updateIncident(incident.id, { status: 'investigating' }, 'auto_triage');
        }
        break;
      
      case TrailIncidentLevel.ERROR:
        // エラーレベルの場合、軽減策を試行
        await this.addIncidentAction(
          incident.id,
          'mitigation',
          'Auto-attempting mitigation for error-level incident',
          'auto_triage'
        );
        break;
      
      case TrailIncidentLevel.WARNING:
        // 警告レベルの場合、監視を継続
        await this.addIncidentAction(
          incident.id,
          'investigation',
          'Auto-monitoring warning-level incident',
          'auto_triage'
        );
        break;
    }
  }

  private shouldAutoApprove(incident: TrailIncident, request: ManualRecoveryRequest): boolean {
    // 自動承認の条件をチェック
    if (!this.config.recoveryConfig.requireApprovalForCritical) {
      return true;
    }
    
    // レベルベースの自動承認
    const levelOrder = [
      TrailIncidentLevel.INFO,
      TrailIncidentLevel.WARNING,
      TrailIncidentLevel.ERROR,
      TrailIncidentLevel.CRITICAL,
      TrailIncidentLevel.EMERGENCY,
    ];
    
    const incidentLevelIndex = levelOrder.indexOf(incident.level);
    const thresholdIndex = levelOrder.indexOf(this.config.recoveryConfig.autoApproveThreshold);
    
    return incidentLevelIndex <= thresholdIndex;
  }

  private async executeManualRecovery(request: ManualRecoveryRequest): Promise<TrailRecoveryResult> {
    const { requestType, positionId, parameters } = request;
    
    try {
      switch (requestType) {
        case 'diagnosis':
          // 診断実行
          return await this.executeDiagnosis(positionId, parameters);
        
        case 'recovery':
          // 復旧実行
          return await this.recoveryManager.executeAdvancedRecovery(
            positionId,
            parameters.recoveryType || 'restart_trail',
            parameters
          );
        
        case 'escalation':
          // エスカレーション実行
          return await this.executeEscalation(request);
        
        case 'override':
          // オーバーライド実行
          return await this.executeOverride(positionId, parameters);
        
        default:
          throw new Error(`Unsupported request type: ${requestType}`);
      }
    } catch (error) {
      return {
        success: false,
        shouldRetry: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async executeDiagnosis(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // ダミーの診断実装
    const healthCheck = await this.recoveryManager.performHealthCheck(
      positionId,
      parameters.trailSettings,
      parameters.currentStatus
    );
    
    return {
      success: true,
      shouldRetry: false,
      message: `Diagnosis completed. Health: ${healthCheck.isHealthy ? 'OK' : 'Issues found'}`,
      data: {
        healthCheck,
        diagnosisTimestamp: new Date(),
      },
    };
  }

  private async executeEscalation(request: ManualRecoveryRequest): Promise<TrailRecoveryResult> {
    // エスカレーション処理（実際の実装では適切なエスカレーション先に通知）
    return {
      success: true,
      shouldRetry: false,
      message: 'Incident escalated to higher level support',
      data: {
        escalatedAt: new Date(),
        escalationLevel: request.parameters.level || 'L2',
      },
    };
  }

  private async executeOverride(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // オーバーライド処理（強制的な状態変更など）
    return {
      success: true,
      shouldRetry: false,
      message: 'Override executed successfully',
      data: {
        overrideAction: parameters.action,
        executedAt: new Date(),
      },
    };
  }

  private async addIncidentLog(
    incidentId: string,
    level: TrailIncidentLog['level'],
    source: string,
    message: string,
    context: Record<string, any> = {}
  ): Promise<void> {
    const logEntry: TrailIncidentLog = {
      id: this.generateLogId(),
      incidentId,
      timestamp: new Date(),
      level,
      source,
      message,
      context,
    };
    
    let logs = this.incidentLogs.get(incidentId) || [];
    logs.unshift(logEntry);
    
    // ログ数制限
    if (logs.length > this.config.logRetentionConfig.maxLogsPerIncident) {
      logs = logs.slice(0, this.config.logRetentionConfig.maxLogsPerIncident);
    }
    
    this.incidentLogs.set(incidentId, logs);
  }

  private async sendIncidentNotification(incident: TrailIncident, eventType: 'created' | 'level_changed' | 'resolved'): Promise<void> {
    // 重複通知の抑制
    if (this.config.notificationConfig.suppressDuplicates) {
      const suppressionKey = `${incident.id}_${eventType}`;
      const lastNotification = this.lastNotifications.get(suppressionKey);
      
      if (lastNotification) {
        const timeSince = Date.now() - lastNotification.getTime();
        if (timeSince < this.config.notificationConfig.suppressionWindowMs) {
          return; // 抑制
        }
      }
      
      this.lastNotifications.set(suppressionKey, new Date());
    }
    
    const notification = {
      type: 'trail_incident',
      eventType,
      incident: {
        id: incident.id,
        level: incident.level,
        title: incident.title,
        status: incident.status,
        positionId: incident.positionId,
        impact: incident.impact,
      },
      timestamp: new Date(),
    };
    
    for (const channel of this.config.notificationConfig.channels) {
      try {
        await this.sendNotificationToChannel(notification, channel);
      } catch (error) {
        console.error(`[TrailIncidentManager] Failed to send notification to ${channel}:`, error);
      }
    }
  }

  private async sendNotificationToChannel(notification: any, channel: string): Promise<void> {
    switch (channel) {
      case 'console':
        console.warn(`[TRAIL INCIDENT] ${notification.incident.level.toUpperCase()}: ${notification.incident.title}`, {
          incidentId: notification.incident.id,
          status: notification.incident.status,
          positionId: notification.incident.positionId,
          impact: notification.incident.impact,
        });
        break;
      
      case 'webhook':
        // Webhook実装は将来的に追加
        console.log('[TrailIncidentManager] Webhook notification not implemented');
        break;
      
      case 'email':
        // Email実装は将来的に追加
        console.log('[TrailIncidentManager] Email notification not implemented');
        break;
      
      case 'slack':
        // Slack実装は将来的に追加
        console.log('[TrailIncidentManager] Slack notification not implemented');
        break;
    }
  }

  private setupEventListeners(): void {
    // エラーハンドラーのイベントを監視
    this.errorHandler.on('trail_error', async (event) => {
      try {
        await this.createIncidentFromError(event.error, event);
      } catch (error) {
        console.error('[TrailIncidentManager] Failed to create incident from error:', error);
      }
    });
    
    // 復旧マネージャーのイベントを監視
    this.recoveryManager.on('advanced_recovery_failed', async (event) => {
      try {
        // 復旧失敗時の自動エスカレーション
        if (this.config.enableAutoEscalation) {
          const positionIncidents = Array.from(this.incidents.values())
            .filter(incident => 
              incident.positionId === event.positionId && 
              ['open', 'investigating'].includes(incident.status)
            );
          
          for (const incident of positionIncidents) {
            incident.metrics.recoveryAttempts++;
            
            if (incident.metrics.recoveryAttempts >= this.config.escalationThresholds.failedRecoveryAttempts) {
              await this.updateIncident(incident.id, {
                level: TrailIncidentLevel.CRITICAL,
                status: 'investigating',
              }, 'auto_escalation');
            }
          }
        }
      } catch (error) {
        console.error('[TrailIncidentManager] Failed to handle recovery failure:', error);
      }
    });
  }

  private startMaintenanceTasks(): void {
    // 定期的なクリーンアップタスク
    setInterval(() => {
      this.performMaintenance();
    }, 3600000); // 1 hour
  }

  private async performMaintenance(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.logRetentionConfig.retentionDays);
    
    // 古い解決済み障害のクリーンアップ
    for (const [incidentId, incident] of this.incidents) {
      if (incident.status === 'resolved' && incident.resolvedAt && incident.resolvedAt < cutoffDate) {
        this.incidents.delete(incidentId);
        this.incidentLogs.delete(incidentId);
      }
    }
    
    // 古い完了済み手動復旧要求のクリーンアップ
    for (const [requestId, request] of this.manualRecoveryRequests) {
      if (['completed', 'failed'].includes(request.status) && 
          request.requestedAt < cutoffDate) {
        this.manualRecoveryRequests.delete(requestId);
      }
    }
    
    console.log('[TrailIncidentManager] Maintenance completed');
  }

  private updateAverageResolutionTime(resolutionTime: number): void {
    const resolvedCount = Array.from(this.incidents.values())
      .filter(incident => incident.status === 'resolved').length;
    
    if (resolvedCount === 1) {
      this.metrics.averageResolutionTime = resolutionTime;
    } else {
      this.metrics.averageResolutionTime = 
        ((this.metrics.averageResolutionTime * (resolvedCount - 1)) + resolutionTime) / resolvedCount;
    }
  }

  private generateIncidentId(): string {
    return `INC_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateRequestId(): string {
    return `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateActionId(): string {
    return `ACT_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateLogId(): string {
    return `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * TrailIncidentManagerのファクトリー関数
 */
export function createTrailIncidentManager(
  errorHandler: TrailErrorHandler,
  recoveryManager: TrailRecoveryManager,
  config?: Partial<TrailIncidentManagerConfig>
): TrailIncidentManager {
  return new TrailIncidentManager(errorHandler, recoveryManager, config);
}
/**
 * 決済システム用通知機能
 * 
 * 成功・エラー・警告通知、進行状況表示、リアルタイム通知を提供
 */

import { CloseFormData, CloseResult, BatchCloseInput, BatchCloseResult } from "./types";
import { CloseError, CloseErrorSeverity } from "./error-handler";
import { ValidationResult, ValidationError, ValidationWarning } from "./validation";
import { PreCloseCheckResult, CheckBlocker, CheckWarning } from "./pre-close-checker";

export enum NotificationType {
  SUCCESS = "success",
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
  PROGRESS = "progress",
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  duration?: number; // ms
  actions?: NotificationAction[];
  data?: Record<string, any>;
  persistent?: boolean;
  sound?: boolean;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
  variant?: "primary" | "secondary" | "destructive";
}

export interface ProgressNotification extends Notification {
  type: NotificationType.PROGRESS;
  progress: ProgressState;
}

export interface ProgressState {
  current: number;
  total: number;
  percentage: number;
  status: string;
  estimatedTimeRemaining?: number;
  details?: string[];
}

export interface NotificationOptions {
  duration?: number;
  persistent?: boolean;
  sound?: boolean;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
}

export interface NotificationTheme {
  success: {
    color: string;
    icon: string;
  };
  error: {
    color: string;
    icon: string;
  };
  warning: {
    color: string;
    icon: string;
  };
  info: {
    color: string;
    icon: string;
  };
  progress: {
    color: string;
    icon: string;
  };
}

export interface ToastConfig {
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center";
  maxVisible: number;
  defaultDuration: number;
  enableSound: boolean;
  enableAnimation: boolean;
}

export class CloseNotificationSystem {
  private notifications: Map<string, Notification> = new Map();
  private listeners: Array<(notification: Notification) => void> = [];
  private config: ToastConfig;
  private notificationCount: number = 0;

  constructor(config?: Partial<ToastConfig>) {
    this.config = {
      position: "top-right",
      maxVisible: 5,
      defaultDuration: 5000,
      enableSound: true,
      enableAnimation: true,
      ...config,
    };
  }

  /**
   * 決済成功通知
   */
  notifyCloseSuccess(
    result: CloseResult,
    closeData: CloseFormData,
    options?: NotificationOptions
  ): void {
    const profit = result.profit || 0;
    const profitText = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
    
    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.SUCCESS,
      priority: NotificationPriority.MEDIUM,
      title: "決済完了",
      message: `ポジション ${result.positionId} が正常に決済されました（損益: ${profitText}）`,
      timestamp: new Date(),
      duration: this.config.defaultDuration,
      sound: true,
      data: {
        result,
        closeData,
        profit,
      },
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * 一括決済成功通知
   */
  notifyBatchCloseSuccess(
    result: BatchCloseResult,
    batchData: BatchCloseInput,
    options?: NotificationOptions
  ): void {
    const totalProfit = result.results.reduce((sum, r) => sum + (r.profit || 0), 0);
    const profitText = totalProfit >= 0 ? `+${totalProfit.toFixed(2)}` : totalProfit.toFixed(2);

    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.SUCCESS,
      priority: NotificationPriority.HIGH,
      title: "一括決済完了",
      message: `${result.successful}件のポジションが正常に決済されました（総損益: ${profitText}）`,
      timestamp: new Date(),
      duration: this.config.defaultDuration * 2,
      sound: true,
      data: {
        result,
        batchData,
        totalProfit,
      },
      actions: result.failed > 0 ? [
        {
          id: "view-failed",
          label: "失敗詳細を確認",
          action: () => this.showFailureDetails(result),
          variant: "secondary",
        }
      ] : undefined,
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * 決済エラー通知
   */
  notifyCloseError(
    error: CloseError,
    closeData?: CloseFormData,
    options?: NotificationOptions
  ): void {
    const priority = this.mapErrorSeverityToPriority(error.severity);
    
    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.ERROR,
      priority,
      title: "決済エラー",
      message: error.message,
      timestamp: new Date(),
      duration: error.severity === CloseErrorSeverity.CRITICAL ? 0 : this.config.defaultDuration * 2,
      persistent: error.severity === CloseErrorSeverity.CRITICAL,
      sound: true,
      data: {
        error,
        closeData,
      },
      actions: this.createErrorActions(error),
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * バリデーションエラー通知
   */
  notifyValidationErrors(
    validationResult: ValidationResult,
    context?: string,
    options?: NotificationOptions
  ): void {
    if (validationResult.errors.length === 0) return;

    const errorCount = validationResult.errors.length;
    const warningCount = validationResult.warnings.length;

    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.ERROR,
      priority: NotificationPriority.HIGH,
      title: "入力値エラー",
      message: `${errorCount}件のエラーが検出されました${warningCount > 0 ? `（警告${warningCount}件）` : ''}`,
      timestamp: new Date(),
      duration: this.config.defaultDuration * 2,
      data: {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        context,
      },
      actions: [
        {
          id: "show-details",
          label: "詳細を確認",
          action: () => this.showValidationDetails(validationResult),
          variant: "primary",
        }
      ],
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * 事前チェック警告通知
   */
  notifyPreCheckWarnings(
    checkResult: PreCloseCheckResult,
    options?: NotificationOptions
  ): void {
    if (checkResult.blockers.length > 0) {
      this.notifyPreCheckBlockers(checkResult.blockers, options);
      return;
    }

    if (checkResult.warnings.length === 0) return;

    const highPriorityWarnings = checkResult.warnings.filter(w => 
      w.category === "account_risk" || w.category === "market_risk"
    );

    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.WARNING,
      priority: highPriorityWarnings.length > 0 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      title: "決済前の確認事項",
      message: `${checkResult.warnings.length}件の注意事項があります`,
      timestamp: new Date(),
      duration: this.config.defaultDuration * 2,
      data: {
        warnings: checkResult.warnings,
        recommendations: checkResult.recommendations,
      },
      actions: [
        {
          id: "show-warnings",
          label: "詳細を確認",
          action: () => this.showPreCheckDetails(checkResult),
          variant: "primary",
        },
        {
          id: "proceed-anyway",
          label: "実行を続行",
          action: () => this.dismissNotification(notification.id),
          variant: "secondary",
        }
      ],
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * 事前チェックブロッカー通知
   */
  notifyPreCheckBlockers(
    blockers: CheckBlocker[],
    options?: NotificationOptions
  ): void {
    const criticalBlockers = blockers.filter(b => b.severity === "critical");
    
    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.ERROR,
      priority: NotificationPriority.URGENT,
      title: "決済実行不可",
      message: `${blockers.length}件の問題により決済を実行できません`,
      timestamp: new Date(),
      duration: 0,
      persistent: true,
      sound: true,
      data: {
        blockers,
      },
      actions: [
        {
          id: "show-blockers",
          label: "問題を確認",
          action: () => this.showBlockerDetails(blockers),
          variant: "primary",
        }
      ],
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * 進行状況通知
   */
  notifyProgress(
    title: string,
    progress: ProgressState,
    options?: NotificationOptions
  ): string {
    const progressNotification: ProgressNotification = {
      id: this.generateId(),
      type: NotificationType.PROGRESS,
      priority: NotificationPriority.MEDIUM,
      title,
      message: progress.status,
      timestamp: new Date(),
      duration: 0,
      persistent: true,
      progress,
      data: {
        startTime: new Date(),
      },
      ...options,
    };

    this.showNotification(progressNotification);
    return progressNotification.id;
  }

  /**
   * 進行状況更新
   */
  updateProgress(
    notificationId: string,
    progress: Partial<ProgressState>
  ): void {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.type !== NotificationType.PROGRESS) {
      return;
    }

    const progressNotification = notification as ProgressNotification;
    progressNotification.progress = {
      ...progressNotification.progress,
      ...progress,
    };

    if (progressNotification.progress.current && progressNotification.progress.total) {
      progressNotification.progress.percentage = 
        (progressNotification.progress.current / progressNotification.progress.total) * 100;
    }

    progressNotification.message = progress.status || progressNotification.progress.status;
    
    this.updateNotification(progressNotification);
  }

  /**
   * 進行状況完了
   */
  completeProgress(
    notificationId: string,
    finalMessage?: string,
    autoClose: boolean = true
  ): void {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.type !== NotificationType.PROGRESS) {
      return;
    }

    const progressNotification = notification as ProgressNotification;
    progressNotification.progress.percentage = 100;
    progressNotification.progress.status = finalMessage || "完了";
    progressNotification.message = progressNotification.progress.status;
    
    if (autoClose) {
      setTimeout(() => {
        this.dismissNotification(notificationId);
      }, 2000);
    }

    this.updateNotification(progressNotification);
  }

  /**
   * 汎用情報通知
   */
  notifyInfo(
    title: string,
    message: string,
    options?: NotificationOptions
  ): void {
    const notification: Notification = {
      id: this.generateId(),
      type: NotificationType.INFO,
      priority: NotificationPriority.LOW,
      title,
      message,
      timestamp: new Date(),
      duration: this.config.defaultDuration,
      ...options,
    };

    this.showNotification(notification);
  }

  /**
   * 通知の表示
   */
  private showNotification(notification: Notification): void {
    this.notifications.set(notification.id, notification);
    
    // 最大表示数の制限
    if (this.notifications.size > this.config.maxVisible) {
      const oldestNonPersistent = Array.from(this.notifications.values())
        .filter(n => !n.persistent)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      
      if (oldestNonPersistent) {
        this.dismissNotification(oldestNonPersistent.id);
      }
    }

    // 音声通知
    if (notification.sound && this.config.enableSound) {
      this.playNotificationSound(notification.type);
    }

    // 自動消去のスケジュール
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, notification.duration);
    }

    // リスナーに通知
    this.notifyListeners(notification);
  }

  /**
   * 通知の更新
   */
  private updateNotification(notification: Notification): void {
    this.notifications.set(notification.id, notification);
    this.notifyListeners(notification);
  }

  /**
   * 通知の削除
   */
  dismissNotification(id: string): void {
    this.notifications.delete(id);
    this.notifyListeners({ id } as Notification);
  }

  /**
   * 全通知の削除
   */
  clearAllNotifications(): void {
    this.notifications.clear();
    this.notifyListeners({ id: "clear-all" } as Notification);
  }

  /**
   * エラー重要度から通知優先度へのマッピング
   */
  private mapErrorSeverityToPriority(severity: CloseErrorSeverity): NotificationPriority {
    switch (severity) {
      case CloseErrorSeverity.CRITICAL:
        return NotificationPriority.URGENT;
      case CloseErrorSeverity.HIGH:
        return NotificationPriority.HIGH;
      case CloseErrorSeverity.MEDIUM:
        return NotificationPriority.MEDIUM;
      default:
        return NotificationPriority.LOW;
    }
  }

  /**
   * エラー用アクションボタンの作成
   */
  private createErrorActions(error: CloseError): NotificationAction[] {
    const actions: NotificationAction[] = [];

    if (error.retryable) {
      actions.push({
        id: "retry",
        label: "再試行",
        action: () => this.retryOperation(error),
        variant: "primary",
      });
    }

    actions.push({
      id: "view-details",
      label: "詳細を確認",
      action: () => this.showErrorDetails(error),
      variant: "secondary",
    });

    if (error.severity === CloseErrorSeverity.CRITICAL) {
      actions.push({
        id: "contact-support",
        label: "サポートに連絡",
        action: () => this.contactSupport(error),
        variant: "secondary",
      });
    }

    return actions;
  }

  /**
   * 通知音の再生
   */
  private playNotificationSound(type: NotificationType): void {
    if (typeof window === 'undefined') return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 通知タイプ別の音程設定
      switch (type) {
        case NotificationType.SUCCESS:
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
          break;
        case NotificationType.ERROR:
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
          break;
        case NotificationType.WARNING:
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          break;
        default:
          oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
      }

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }

  /**
   * ID生成
   */
  private generateId(): string {
    return `notification-${++this.notificationCount}-${Date.now()}`;
  }

  /**
   * リスナーへの通知
   */
  private notifyListeners(notification: Notification): void {
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error("Error in notification listener:", error);
      }
    });
  }

  /**
   * 詳細表示メソッド（実装は呼び出し側で提供）
   */
  private showErrorDetails(error: CloseError): void {
    console.log("Error details:", error);
  }

  private showValidationDetails(result: ValidationResult): void {
    console.log("Validation details:", result);
  }

  private showPreCheckDetails(result: PreCloseCheckResult): void {
    console.log("Pre-check details:", result);
  }

  private showBlockerDetails(blockers: CheckBlocker[]): void {
    console.log("Blocker details:", blockers);
  }

  private showFailureDetails(result: BatchCloseResult): void {
    console.log("Failure details:", result);
  }

  private retryOperation(error: CloseError): void {
    console.log("Retrying operation:", error);
  }

  private contactSupport(error: CloseError): void {
    console.log("Contacting support:", error);
  }

  /**
   * 通知リスナーの登録
   */
  addListener(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    
    // リスナー削除関数を返す
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 現在の通知一覧を取得
   */
  getNotifications(): Notification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<ToastConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.clearAllNotifications();
    this.listeners = [];
  }
}

/**
 * 通知システムのファクトリー関数
 */
export function createNotificationSystem(config?: Partial<ToastConfig>): CloseNotificationSystem {
  return new CloseNotificationSystem(config);
}
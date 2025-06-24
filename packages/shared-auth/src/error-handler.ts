/**
 * 統一認証エラーハンドラー - MVP システム設計書準拠
 * 
 * 設計原則：
 * - 全認証エラーの統一処理
 * - 自動回復機能
 * - エラーログ・通知の統一化
 * - セキュリティ監査ログ
 */

import { AuthError, AuthErrorType } from './types';

export interface ErrorContext {
  userId?: string;
  action: string;
  appType: 'admin' | 'hedge-system';
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface ErrorHandlerOptions {
  enableNotifications?: boolean;
  enableAutoRecovery?: boolean;
  enableSecurityAudit?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
}

export class AuthErrorHandler {
  private static options: ErrorHandlerOptions = {
    enableNotifications: true,
    enableAutoRecovery: true,
    enableSecurityAudit: true,
    logLevel: 'error'
  };

  /**
   * 設定の更新
   */
  static configure(options: Partial<ErrorHandlerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * メイン認証エラー処理
   */
  static async handle(
    error: AuthError | Error,
    context: ErrorContext
  ): Promise<void> {
    const authError = this.normalizeError(error);
    const errorLog = this.createErrorLog(authError, context);
    
    // ログ出力
    this.logError(errorLog);
    
    // セキュリティ監査
    if (this.options.enableSecurityAudit) {
      await this.auditSecurityEvent(authError, context);
    }
    
    // 通知
    if (this.options.enableNotifications) {
      await this.notifyError(authError, context);
    }
    
    // 自動回復試行
    if (this.options.enableAutoRecovery) {
      await this.attemptAutoRecovery(authError, context);
    }
  }

  /**
   * エラーの正規化
   */
  private static normalizeError(error: AuthError | Error): AuthError {
    if (error instanceof AuthError) {
      return error;
    }
    
    // Amplify エラーからAuthErrorへの変換
    if (error.name === 'NotAuthorizedException') {
      return new AuthError(AuthErrorType.INVALID_CREDENTIALS, '認証情報が無効です', error);
    }
    
    if (error.name === 'UserNotConfirmedException') {
      return new AuthError(AuthErrorType.UNAUTHORIZED, 'メール認証が完了していません', error);
    }
    
    if (error.name === 'NetworkError') {
      return new AuthError(AuthErrorType.NETWORK_ERROR, 'ネットワークエラーが発生しました', error);
    }
    
    // その他のエラー
    return new AuthError(AuthErrorType.NETWORK_ERROR, error.message || '不明なエラー', error);
  }

  /**
   * エラーログの作成
   */
  private static createErrorLog(error: AuthError, context: ErrorContext) {
    return {
      timestamp: context.timestamp,
      errorType: error.type,
      message: error.message,
      context: {
        userId: context.userId,
        action: context.action,
        appType: context.appType,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress
      },
      stack: error.stack,
      originalError: error.originalError ? {
        name: error.originalError.name,
        message: error.originalError.message
      } : undefined
    };
  }

  /**
   * ログ出力
   */
  private static logError(errorLog: any): void {
    const level = this.options.logLevel || 'error';
    
    switch (level) {
      case 'error':
        console.error('🔥 Auth Error:', errorLog);
        break;
      case 'warn':
        console.warn('⚠️ Auth Warning:', errorLog);
        break;
      case 'info':
        console.info('ℹ️ Auth Info:', errorLog);
        break;
    }
  }

  /**
   * セキュリティ監査ログ
   */
  private static async auditSecurityEvent(
    error: AuthError, 
    context: ErrorContext
  ): Promise<void> {
    // セキュリティイベントの重要度判定
    const isSecurityCritical = [
      AuthErrorType.UNAUTHORIZED,
      AuthErrorType.FORBIDDEN,
      AuthErrorType.INVALID_CREDENTIALS
    ].includes(error.type);
    
    if (isSecurityCritical) {
      console.warn('🚨 Security Audit:', {
        event: 'AUTH_SECURITY_EVENT',
        severity: 'HIGH',
        errorType: error.type,
        userId: context.userId,
        action: context.action,
        appType: context.appType,
        timestamp: context.timestamp,
        ipAddress: context.ipAddress
      });
      
      // 将来的に外部セキュリティ監査システムに送信可能
      // await this.sendToSecurityAuditSystem(auditLog);
    }
  }

  /**
   * エラー通知
   */
  private static async notifyError(
    error: AuthError,
    context: ErrorContext
  ): Promise<void> {
    // 重要なエラーの場合のみ通知
    const shouldNotify = [
      AuthErrorType.TOKEN_EXPIRED,
      AuthErrorType.NETWORK_ERROR
    ].includes(error.type);
    
    if (shouldNotify && typeof window !== 'undefined') {
      // ブラウザ環境でのみ通知実行
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('認証エラー', {
            body: error.message,
            icon: '/icon-error.png'
          });
        }
      } catch (notificationError) {
        console.warn('通知の送信に失敗:', notificationError);
      }
    }
  }

  /**
   * 自動回復機能
   */
  private static async attemptAutoRecovery(
    error: AuthError,
    context: ErrorContext
  ): Promise<void> {
    switch (error.type) {
      case AuthErrorType.TOKEN_EXPIRED:
        console.log('🔄 Attempting token refresh...');
        // トークンリフレッシュ試行
        await this.attemptTokenRefresh();
        break;
        
      case AuthErrorType.NETWORK_ERROR:
        console.log('🔄 Attempting network recovery...');
        // ネットワーク回復待機
        await this.attemptNetworkRecovery();
        break;
        
      default:
        // 自動回復不可
        console.log('❌ Auto recovery not available for error type:', error.type);
    }
  }

  /**
   * トークンリフレッシュ試行
   */
  private static async attemptTokenRefresh(): Promise<void> {
    try {
      // AuthServiceのrefreshSessionを呼び出し
      // 実装は後でAuthServiceと連携
      console.log('Token refresh attempted');
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }

  /**
   * ネットワーク回復試行
   */
  private static async attemptNetworkRecovery(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Network recovery timeout completed');
        resolve();
      }, 5000); // 5秒待機
    });
  }

  /**
   * エラー統計取得
   */
  static getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<AuthErrorType, number>;
    lastErrorTime?: string;
  } {
    // 将来的にエラー統計を実装
    return {
      totalErrors: 0,
      errorsByType: {
        [AuthErrorType.UNAUTHORIZED]: 0,
        [AuthErrorType.FORBIDDEN]: 0,
        [AuthErrorType.TOKEN_EXPIRED]: 0,
        [AuthErrorType.INVALID_CREDENTIALS]: 0,
        [AuthErrorType.NETWORK_ERROR]: 0
      }
    };
  }

  /**
   * ヘルパー: エラーコンテキストの作成
   */
  static createContext(
    action: string,
    appType: 'admin' | 'hedge-system',
    userId?: string
  ): ErrorContext {
    return {
      userId,
      action,
      appType,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    };
  }
}
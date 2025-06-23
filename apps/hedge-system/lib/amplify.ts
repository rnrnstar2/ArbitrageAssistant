import { Amplify } from 'aws-amplify';
import { AuthService } from '@repo/shared-auth';
import outputs from '../amplify_outputs.json';

// Hedge System特有のAmplify設定
export function configureAmplifyForHedgeSystem() {
  // MVP段階では基本設定のみ使用
  Amplify.configure(outputs);
  
  console.log('🚀 Amplify configured for Hedge System');
}

// AuthServiceのインスタンスを作成
export const authService = new AuthService({
  enableWebSocket: true,
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
});

// セキュリティ監査ログ
export class SecurityLogger {
  private static instance: SecurityLogger;
  
  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  logAuthAttempt(email: string, success: boolean, reason?: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'AUTH_ATTEMPT',
      email,
      success,
      reason,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[SECURITY]', logEntry);
    }

    // 本番環境では適切なログシステムに送信
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to monitoring service
    }
  }

  logSecurityEvent(event: string, details: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_EVENT',
      event,
      details,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
    };

    if (process.env.NODE_ENV === 'development') {
      console.warn('[SECURITY]', logEntry);
    }

    // 本番環境では適切なログシステムに送信
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to monitoring service
    }
  }
}

// 不正アクセス検知
export class FraudDetector {
  private failedAttempts: Map<string, number> = new Map();
  private lockedUsers: Map<string, number> = new Map();

  isUserLocked(email: string): boolean {
    const lockTime = this.lockedUsers.get(email);
    if (!lockTime) return false;

    if (Date.now() - lockTime > 300000) { // 5分後にロック解除
      this.lockedUsers.delete(email);
      this.failedAttempts.delete(email);
      return false;
    }

    return true;
  }

  recordFailedAttempt(email: string): boolean {
    if (this.isUserLocked(email)) {
      return true; // すでにロック中
    }

    const attempts = (this.failedAttempts.get(email) || 0) + 1;
    this.failedAttempts.set(email, attempts);

    if (attempts >= 5) {
      this.lockedUsers.set(email, Date.now());
      SecurityLogger.getInstance().logSecurityEvent('USER_LOCKED', {
        email,
        attempts,
        reason: 'Too many failed login attempts',
      });
      return true;
    }

    return false;
  }

  recordSuccessfulLogin(email: string) {
    this.failedAttempts.delete(email);
    this.lockedUsers.delete(email);
  }
}

export const fraudDetector = new FraudDetector();
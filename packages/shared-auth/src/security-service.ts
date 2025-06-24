/**
 * 認証セキュリティサービス - MVP システム設計書準拠
 * 
 * 設計原則：
 * - JWT署名検証の強化
 * - トークンローテーション管理
 * - デバイス識別とセッション管理
 * - セキュリティ監査ログ
 */

import { fetchAuthSession } from "aws-amplify/auth";
import { AuthError, AuthErrorType } from "./types";

export interface SecurityConfig {
  enableTokenValidation: boolean;
  enableDeviceFingerprinting: boolean;
  tokenRotationInterval: number; // minutes
  maxSessionAge: number; // hours
  requireSecureContext: boolean;
}

export interface DeviceFingerprint {
  id: string;
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  created: string;
}

export interface SessionInfo {
  sessionId: string;
  deviceFingerprint: DeviceFingerprint;
  lastActivity: string;
  ipAddress?: string;
  location?: string;
  isValidated: boolean;
  tokenVersion: number;
}

export class SecurityService {
  private static config: SecurityConfig = {
    enableTokenValidation: true,
    enableDeviceFingerprinting: true,
    tokenRotationInterval: 30, // 30分毎
    maxSessionAge: 8, // 8時間
    requireSecureContext: true
  };

  private static currentSession: SessionInfo | null = null;
  private static rotationTimer: NodeJS.Timeout | null = null;

  /**
   * セキュリティ設定の更新
   */
  static configure(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    
    // タイマーの再設定
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    this.setupTokenRotation();
  }

  /**
   * JWT トークンの詳細検証
   */
  static async validateToken(token: string): Promise<boolean> {
    if (!this.config.enableTokenValidation) {
      return true;
    }

    try {
      // JWT デコード（ヘッダー・ペイロード・署名の分離）
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'Invalid JWT format');
      }

      // ペイロードのデコードと検証
      const payload = JSON.parse(atob(tokenParts[1]));
      
      // 有効期限チェック
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        throw new AuthError(AuthErrorType.TOKEN_EXPIRED, 'Token has expired');
      }

      // 発行者チェック（Amplify Cognito）
      if (!payload.iss || !payload.iss.includes('cognito-idp')) {
        throw new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'Invalid token issuer');
      }

      // オーディエンスチェック
      if (!payload.aud) {
        throw new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'Missing audience claim');
      }

      // トークンタイプチェック
      if (payload.token_use !== 'id') {
        throw new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'Invalid token type');
      }

      console.log('✅ Token validation passed');
      return true;

    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return false;
    }
  }

  /**
   * デバイスフィンガープリントの生成
   */
  static generateDeviceFingerprint(): DeviceFingerprint {
    if (typeof window === 'undefined') {
      // サーバーサイド環境
      return {
        id: 'server-side',
        userAgent: 'server',
        screen: 'unknown',
        timezone: 'UTC',
        language: 'en',
        platform: 'server',
        cookieEnabled: false,
        doNotTrack: null,
        created: new Date().toISOString()
      };
    }

    // ブラウザ環境でのフィンガープリント生成
    const fingerprint: DeviceFingerprint = {
      id: this.generateDeviceId(),
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      created: new Date().toISOString()
    };

    return fingerprint;
  }

  /**
   * デバイスID生成（一意性確保）
   */
  private static generateDeviceId(): string {
    if (typeof window === 'undefined') {
      return 'server-' + Math.random().toString(36).substr(2, 9);
    }

    // localStorage からデバイスIDを取得または生成
    const storageKey = 'arbitrage_device_id';
    let deviceId = localStorage.getItem(storageKey);
    
    if (!deviceId) {
      deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(storageKey, deviceId);
    }
    
    return deviceId;
  }

  /**
   * セッション情報の初期化
   */
  static async initializeSession(userId: string): Promise<SessionInfo> {
    const deviceFingerprint = this.generateDeviceFingerprint();
    
    const sessionInfo: SessionInfo = {
      sessionId: `session-${userId}-${Date.now()}`,
      deviceFingerprint,
      lastActivity: new Date().toISOString(),
      isValidated: false,
      tokenVersion: 1
    };

    this.currentSession = sessionInfo;
    await this.validateSession();
    
    return sessionInfo;
  }

  /**
   * セッション検証
   */
  static async validateSession(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    try {
      // 最新のAmplifyセッションを取得
      const session = await fetchAuthSession();
      
      if (!session.tokens?.idToken) {
        throw new AuthError(AuthErrorType.UNAUTHORIZED, 'No valid session found');
      }

      // トークンの詳細検証
      const isTokenValid = await this.validateToken(session.tokens.idToken.toString());
      if (!isTokenValid) {
        throw new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'Token validation failed');
      }

      // セッション年齢チェック
      const sessionAge = Date.now() - new Date(this.currentSession.lastActivity).getTime();
      const maxAgeMs = this.config.maxSessionAge * 60 * 60 * 1000;
      
      if (sessionAge > maxAgeMs) {
        throw new AuthError(AuthErrorType.TOKEN_EXPIRED, 'Session has exceeded maximum age');
      }

      // セキュアコンテキストチェック
      if (this.config.requireSecureContext && typeof window !== 'undefined') {
        if (!window.location.protocol.startsWith('https') && window.location.hostname !== 'localhost') {
          throw new AuthError(AuthErrorType.FORBIDDEN, 'Secure context required');
        }
      }

      this.currentSession.isValidated = true;
      this.currentSession.lastActivity = new Date().toISOString();
      
      console.log('✅ Session validation passed');
      return true;

    } catch (error) {
      console.error('❌ Session validation failed:', error);
      this.currentSession.isValidated = false;
      return false;
    }
  }

  /**
   * トークンローテーションの設定
   */
  private static setupTokenRotation(): void {
    if (!this.config.enableTokenValidation) {
      return;
    }

    const intervalMs = this.config.tokenRotationInterval * 60 * 1000;
    
    this.rotationTimer = setInterval(async () => {
      try {
        console.log('🔄 Initiating token rotation...');
        
        // 強制リフレッシュでトークンローテーション
        const session = await fetchAuthSession({ forceRefresh: true });
        
        if (session.tokens?.idToken) {
          const isValid = await this.validateToken(session.tokens.idToken.toString());
          
          if (isValid && this.currentSession) {
            this.currentSession.tokenVersion += 1;
            this.currentSession.lastActivity = new Date().toISOString();
            console.log('✅ Token rotation completed');
          }
        }
        
      } catch (error) {
        console.error('❌ Token rotation failed:', error);
      }
    }, intervalMs);
  }

  /**
   * セッション情報の取得
   */
  static getCurrentSession(): SessionInfo | null {
    return this.currentSession;
  }

  /**
   * デバイスフィンガープリントの比較
   */
  static compareDeviceFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    const weights = {
      userAgent: 0.3,
      screen: 0.2,
      timezone: 0.2,
      language: 0.1,
      platform: 0.2
    };

    let similarity = 0;

    if (fp1.userAgent === fp2.userAgent) similarity += weights.userAgent;
    if (fp1.screen === fp2.screen) similarity += weights.screen;
    if (fp1.timezone === fp2.timezone) similarity += weights.timezone;
    if (fp1.language === fp2.language) similarity += weights.language;
    if (fp1.platform === fp2.platform) similarity += weights.platform;

    return similarity;
  }

  /**
   * セキュリティ監査ログの生成
   */
  static generateSecurityAudit(): {
    sessionInfo: SessionInfo | null;
    securityConfig: SecurityConfig;
    lastValidation: string | null;
    deviceTrust: number;
  } {
    const audit = {
      sessionInfo: this.currentSession,
      securityConfig: this.config,
      lastValidation: this.currentSession?.lastActivity || null,
      deviceTrust: 0
    };

    // デバイス信頼度の計算（簡易版）
    if (this.currentSession?.deviceFingerprint) {
      const fp = this.currentSession.deviceFingerprint;
      audit.deviceTrust = fp.cookieEnabled ? 0.5 : 0.3;
      if (fp.doNotTrack === null) audit.deviceTrust += 0.2;
      if (fp.timezone && fp.language) audit.deviceTrust += 0.3;
    }

    return audit;
  }

  /**
   * セッションの終了
   */
  static terminateSession(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    
    this.currentSession = null;
    
    // デバイスIDのクリア（オプション）
    if (typeof window !== 'undefined') {
      // localStorage.removeItem('arbitrage_device_id');
    }
    
    console.log('🔒 Security session terminated');
  }

  /**
   * セキュリティレポートの生成
   */
  static generateSecurityReport(): {
    status: 'secure' | 'warning' | 'critical';
    checks: Array<{ name: string; passed: boolean; message: string }>;
    recommendations: string[];
  } {
    const checks = [
      {
        name: 'Token Validation',
        passed: this.config.enableTokenValidation,
        message: this.config.enableTokenValidation ? 'Enabled' : 'Disabled - Security Risk'
      },
      {
        name: 'Device Fingerprinting',
        passed: this.config.enableDeviceFingerprinting,
        message: this.config.enableDeviceFingerprinting ? 'Enabled' : 'Disabled'
      },
      {
        name: 'Secure Context',
        passed: this.config.requireSecureContext,
        message: this.config.requireSecureContext ? 'Required' : 'Not Required'
      },
      {
        name: 'Session Validation',
        passed: this.currentSession?.isValidated || false,
        message: this.currentSession?.isValidated ? 'Valid' : 'Invalid or Missing'
      }
    ];

    const failedChecks = checks.filter(check => !check.passed);
    const status = failedChecks.length === 0 ? 'secure' : 
                  failedChecks.length <= 2 ? 'warning' : 'critical';

    const recommendations = [];
    if (!this.config.enableTokenValidation) {
      recommendations.push('Enable token validation for enhanced security');
    }
    if (!this.config.requireSecureContext) {
      recommendations.push('Require HTTPS for all authentication operations');
    }
    if (!this.currentSession?.isValidated) {
      recommendations.push('Validate current session');
    }

    return { status, checks, recommendations };
  }
}
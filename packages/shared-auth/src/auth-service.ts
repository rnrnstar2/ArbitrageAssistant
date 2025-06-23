"use client";

import { type AuthUser, getCurrentUser, signIn, signOut, fetchAuthSession } from "aws-amplify/auth";
import { AuthContextType, WebSocketConnectionOptions, AuthProviderOptions, AuthError, AuthErrorType, WSAuthConfig } from "./types";

export class AuthService {
  private user: AuthUser | null = null;
  private isLoading = true;
  private authToken: string | null = null;
  private groups: string[] = [];
  private options: AuthProviderOptions;
  private listeners: Set<() => void> = new Set();
  private sessionRefreshTimer: NodeJS.Timeout | null = null;

  constructor(options: AuthProviderOptions = {}) {
    this.options = options;
    
    // 設定チェックを遅延実行（Amplify.configure()が完了するまで待機）
    setTimeout(() => {
      this.checkAuthState();
    }, 100);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async checkAuthState(): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new AuthError(AuthErrorType.NETWORK_ERROR, 'Authentication check timeout')), 10000);
    });

    try {
      const getCurrentUserPromise = getCurrentUser();
      const currentUser = await Promise.race([getCurrentUserPromise, timeoutPromise]);
      this.user = currentUser;
      
      // セッション情報を取得してグループを抽出
      const sessionPromise = fetchAuthSession();
      const session = await Promise.race([sessionPromise, timeoutPromise]);
      
      if (session.tokens?.idToken) {
        this.authToken = session.tokens.idToken.toString();
        // JWTトークンからグループ情報を抽出
        const payload = session.tokens.idToken.payload;
        this.groups = (payload['cognito:groups'] as string[]) || [];
        
        // セッション自動更新タイマーを設定
        this.setupSessionRefresh(session.tokens.idToken.payload.exp as number);
      }
      
    } catch (error) {
      this.user = null;
      this.authToken = null;
      this.groups = [];
      
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(AuthErrorType.NETWORK_ERROR, 'Authentication failed', error as Error);
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  private setupSessionRefresh(expTime: number): void {
    // 有効期限の5分前にリフレッシュ
    const refreshTime = (expTime * 1000) - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      this.sessionRefreshTimer = setTimeout(() => {
        this.refreshSession();
      }, refreshTime);
    }
  }

  async refreshSession(): Promise<void> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (session.tokens?.idToken) {
        this.authToken = session.tokens.idToken.toString();
        const payload = session.tokens.idToken.payload;
        this.groups = (payload['cognito:groups'] as string[]) || [];
        
        this.setupSessionRefresh(payload.exp as number);
        this.notify();
      }
    } catch (error) {
      throw new AuthError(AuthErrorType.TOKEN_EXPIRED, 'Session refresh failed', error as Error);
    }
  }

  async signIn(email: string, password: string): Promise<unknown> {
    try {
      const result = await signIn({ 
        username: email, 
        password,
        options: {
          authFlowType: 'USER_SRP_AUTH',
        },
      });

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        throw new AuthError(AuthErrorType.UNAUTHORIZED, 'メールアドレスの確認が必要です');
      }

      await this.checkAuthState();
      return result;
      
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'ログインに失敗しました', error as Error);
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.sessionRefreshTimer) {
        clearTimeout(this.sessionRefreshTimer);
        this.sessionRefreshTimer = null;
      }
      
      await signOut();
      this.user = null;
      this.authToken = null;
      this.groups = [];
      this.notify();
    } catch (error) {
      throw new AuthError(AuthErrorType.NETWORK_ERROR, 'ログアウトに失敗しました', error as Error);
    }
  }

  hasPermission(operation: string, _resource: string): boolean {
    if (!this.user || this.groups.length === 0) {
      return false;
    }

    // 管理者は全権限
    if (this.groups.includes('admin')) {
      return true;
    }

    // オペレーターの権限チェック
    if (this.groups.includes('operator')) {
      return ['read', 'update'].includes(operation);
    }

    // ビューアーの権限チェック
    if (this.groups.includes('viewer')) {
      return operation === 'read';
    }

    return false;
  }

  generateWSAuthToken(): WSAuthConfig {
    if (!this.authToken || !this.user) {
      throw new AuthError(AuthErrorType.UNAUTHORIZED, 'WebSocket認証トークンの生成に失敗しました');
    }

    return {
      token: this.authToken,
      sessionId: `ws-${this.user.userId}-${Date.now()}`,
      expiry: Date.now() + (60 * 60 * 1000), // 1時間後
    };
  }

  validateWSAuthToken(token: string): boolean {
    // 簡易的な検証（実際の実装では署名検証等が必要）
    return token === this.authToken;
  }

  getWebSocketConnectionOptions(): WebSocketConnectionOptions | null {
    if (!this.options.enableWebSocket || !this.user || !this.authToken) {
      return null;
    }

    const clientId = `client-${this.user.userId}`;
    const url = this.options.websocketUrl || process.env.NEXT_PUBLIC_WEBSOCKET_URL || "";
    
    return {
      authToken: this.authToken,
      clientId,
      userId: this.user.userId,
      url,
    };
  }

  getState(): Pick<AuthContextType, 'user' | 'isAuthenticated' | 'isLoading' | 'authToken' | 'groups'> {
    return {
      user: this.user,
      isAuthenticated: !!this.user,
      isLoading: this.isLoading,
      authToken: this.authToken,
      groups: this.groups,
    };
  }
}
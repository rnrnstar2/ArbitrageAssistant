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
      this.checkAuthState().catch((error) => {
        console.error('Initial auth state check failed:', error);
        this.isLoading = false;
        this.notify();
      });
    }, 500);
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
    try {
      // まずセッションを確認（認証されていない場合でもエラーにならない）
      const session = await fetchAuthSession();
      
      if (session.tokens?.idToken) {
        // 認証されている場合、ユーザー情報を取得
        try {
          this.user = await getCurrentUser();
          this.authToken = session.tokens.idToken.toString();
          
          // JWTトークンからグループ情報を抽出
          const payload = session.tokens.idToken.payload;
          this.groups = (payload['cognito:groups'] as string[]) || [];
          
          // セッション自動更新タイマーを設定（expが存在する場合のみ）
          if (payload.exp && typeof payload.exp === 'number') {
            this.setupSessionRefresh(payload.exp);
          }
        } catch (userError) {
          console.warn('Failed to get current user:', userError);
          this.user = null;
          this.authToken = null;
          this.groups = [];
        }
      } else {
        // 認証されていない状態（正常な状態）
        this.user = null;
        this.authToken = null;
        this.groups = [];
      }
      
    } catch (error) {
      // セッション取得エラー（ログのみ出力し、エラーを投げない）
      console.warn('AuthService.checkAuthState session error:', error);
      this.user = null;
      this.authToken = null;
      this.groups = [];
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
        
        if (payload.exp && typeof payload.exp === 'number') {
          this.setupSessionRefresh(payload.exp);
        }
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
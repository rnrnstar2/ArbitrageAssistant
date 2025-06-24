import { type AuthUser, getCurrentUser, signIn, signOut, fetchAuthSession } from "aws-amplify/auth";
import { AuthContextType, WebSocketConnectionOptions, AuthProviderOptions, AuthError, AuthErrorType, WSAuthConfig } from "./types";
import { AuthErrorHandler } from "./error-handler";
import { SecurityService } from "./security-service";

export class AuthService {
  private user: AuthUser | null = null;
  private isLoading = true;
  private authToken: string | null = null;
  private groups: string[] = [];
  private options: AuthProviderOptions;
  private listeners: Set<() => void> = new Set();
  private sessionRefreshTimer: NodeJS.Timeout | null = null;
  private appType: 'admin' | 'hedge-system' = 'admin';

  constructor(options: AuthProviderOptions = {}) {
    this.options = options;
    this.appType = options.appType || 'admin';
    
    // セキュリティサービスの初期化
    SecurityService.configure({
      enableTokenValidation: true,
      enableDeviceFingerprinting: true,
      tokenRotationInterval: 30,
      maxSessionAge: this.appType === 'hedge-system' ? 24 : 8,
      requireSecureContext: true
    });
    
    // 初期認証状態チェック（即座に実行）
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    // ブラウザ環境でのみ実行
    if (typeof window === 'undefined') {
      this.isLoading = false;
      this.notify();
      return;
    }
    
    // Amplify設定の完了を待機（少し遅延）
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await this.checkAuthState();
    } catch (error) {
      const context = AuthErrorHandler.createContext('initial_auth_check', this.appType);
      AuthErrorHandler.handle(error, context);
      // checkAuthState の finally ブロックで isLoading = false が設定されるため、ここでは設定しない
    }
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
      const authError = new AuthError(AuthErrorType.TOKEN_EXPIRED, 'Session refresh failed', error as Error);
      const context = AuthErrorHandler.createContext('refresh_session', this.appType, this.user?.userId);
      await AuthErrorHandler.handle(authError, context);
      throw authError;
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
        const authError = new AuthError(AuthErrorType.UNAUTHORIZED, 'メールアドレスの確認が必要です');
        const context = AuthErrorHandler.createContext('sign_in', this.appType, email);
        await AuthErrorHandler.handle(authError, context);
        throw authError;
      }

      await this.checkAuthState();
      
      // セキュリティセッションの初期化
      if (this.user?.userId) {
        await SecurityService.initializeSession(this.user.userId);
      }
      
      // サインイン成功後の状態更新を確実に実行
      this.notify();
      
      return result;
      
    } catch (error) {
      if (error instanceof AuthError) {
        // 既にハンドル済みの場合はそのまま再スロー
        throw error;
      }
      
      const authError = new AuthError(AuthErrorType.INVALID_CREDENTIALS, 'ログインに失敗しました', error as Error);
      const context = AuthErrorHandler.createContext('sign_in', this.appType, email);
      await AuthErrorHandler.handle(authError, context);
      throw authError;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.sessionRefreshTimer) {
        clearTimeout(this.sessionRefreshTimer);
        this.sessionRefreshTimer = null;
      }
      
      await signOut();
      
      // セキュリティセッションの終了
      SecurityService.terminateSession();
      
      this.user = null;
      this.authToken = null;
      this.groups = [];
      this.notify();
    } catch (error) {
      const authError = new AuthError(AuthErrorType.NETWORK_ERROR, 'ログアウトに失敗しました', error as Error);
      const context = AuthErrorHandler.createContext('sign_out', this.appType, this.user?.userId);
      await AuthErrorHandler.handle(authError, context);
      throw authError;
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

  async validateWSAuthToken(token: string): Promise<boolean> {
    // 基本的なトークン一致確認
    if (token !== this.authToken) {
      return false;
    }
    
    // セキュリティサービスによる詳細検証
    return await SecurityService.validateToken(token);
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
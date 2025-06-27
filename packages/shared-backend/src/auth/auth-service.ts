import { signIn, signUp, signOut, confirmSignUp, resetPassword, confirmResetPassword, getCurrentUser, type SignInInput, type SignUpInput } from 'aws-amplify/auth';
import { jwtManager, type JWTTokens } from './jwt-manager';

export interface SignUpData {
  email: string;
  password: string;
  fullname: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  groups: string[];
  isAdmin: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: JWTTokens | null;
}

/**
 * 認証サービスクラス
 * フロントエンドアプリケーション用の統一認証インターフェース
 */
export class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    tokens: null,
  };
  private listeners: Array<(state: AuthState) => void> = [];

  private constructor() {
    // 初期化時に認証状態を確認
    this.checkAuthState();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 認証状態の変更を監視
   */
  public onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this.listeners.push(callback);
    
    // 現在の状態を即座に通知
    callback(this.authState);
    
    // リスナーを削除する関数を返す
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 認証状態を更新し、リスナーに通知
   */
  private updateAuthState(newState: Partial<AuthState>) {
    this.authState = { ...this.authState, ...newState };
    this.listeners.forEach(listener => listener(this.authState));
  }

  /**
   * 現在の認証状態をチェック
   */
  public async checkAuthState(): Promise<AuthState> {
    try {
      const user = await jwtManager.getCurrentUser();
      if (!user) {
        this.updateAuthState({
          isAuthenticated: false,
          user: null,
          tokens: null,
        });
        return this.authState;
      }

      const tokens = await jwtManager.getCurrentTokens();
      const groups = await jwtManager.getUserGroups();
      const isAdmin = await jwtManager.isAdmin();

      const authUser: AuthUser = {
        userId: user.userId,
        email: user.signInDetails?.loginId || '',
        name: user.signInDetails?.loginId || '',
        groups,
        isAdmin,
      };

      this.updateAuthState({
        isAuthenticated: true,
        user: authUser,
        tokens,
      });

      return this.authState;
    } catch (error) {
      console.error('Failed to check auth state:', error);
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        tokens: null,
      });
      return this.authState;
    }
  }

  /**
   * ユーザーサインアップ
   */
  public async signUp(data: SignUpData): Promise<{ isSignUpComplete: boolean; nextStep: any }> {
    try {
      const signUpInput: SignUpInput = {
        username: data.email,
        password: data.password,
        options: {
          userAttributes: {
            email: data.email,
            'custom:fullname': data.fullname,
          },
        },
      };

      const result = await signUp(signUpInput);
      
      console.log('Sign up successful:', result);
      return result;
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  }

  /**
   * サインアップ確認（確認コード入力）
   */
  public async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    try {
      await confirmSignUp({
        username: email,
        confirmationCode,
      });
      
      console.log('Sign up confirmed successfully');
      
      // 確認後、認証状態を更新
      await this.checkAuthState();
    } catch (error) {
      console.error('Sign up confirmation failed:', error);
      throw error;
    }
  }

  /**
   * ユーザーサインイン
   */
  public async signIn(data: SignInData): Promise<AuthState> {
    try {
      const signInInput: SignInInput = {
        username: data.email,
        password: data.password,
      };

      const result = await signIn(signInInput);
      
      if (result.isSignedIn) {
        console.log('Sign in successful');
        await this.checkAuthState();
      } else {
        console.log('Sign in requires additional steps:', result.nextStep);
        throw new Error('Sign in requires additional steps');
      }

      return this.authState;
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  /**
   * ユーザーサインアウト
   */
  public async signOut(): Promise<void> {
    try {
      await jwtManager.signOut();
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        tokens: null,
      });
      
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * パスワードリセット開始
   */
  public async resetPassword(email: string): Promise<void> {
    try {
      await resetPassword({ username: email });
      console.log('Password reset email sent');
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * パスワードリセット確認
   */
  public async confirmResetPassword(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode,
        newPassword,
      });
      console.log('Password reset confirmed successfully');
    } catch (error) {
      console.error('Password reset confirmation failed:', error);
      throw error;
    }
  }

  /**
   * 有効なアクセストークンを取得
   */
  public async getValidAccessToken(): Promise<string | null> {
    return await jwtManager.getValidAccessToken();
  }

  /**
   * Authorization ヘッダー用の値を取得
   */
  public async getAuthorizationHeader(): Promise<string | null> {
    return await jwtManager.getAuthorizationHeader();
  }

  /**
   * 現在のユーザーがアクセス権限を持っているかチェック
   */
  public async hasPermission(requiredGroups: string[]): Promise<boolean> {
    if (!this.authState.isAuthenticated || !this.authState.user) {
      return false;
    }

    const userGroups = this.authState.user.groups;
    
    // 管理者は全権限を持つ
    if (userGroups.includes('admin')) {
      return true;
    }

    // 必要なグループのいずれかに属している場合
    return requiredGroups.some(group => userGroups.includes(group));
  }

  /**
   * 現在の認証状態を取得
   */
  public getCurrentAuthState(): AuthState {
    return this.authState;
  }

  /**
   * ユーザーIDを取得
   */
  public getCurrentUserId(): string | null {
    return this.authState.user?.userId || null;
  }

  /**
   * ユーザー情報を取得
   */
  public getCurrentUser(): AuthUser | null {
    return this.authState.user;
  }

  /**
   * 管理者かどうかをチェック
   */
  public isAdmin(): boolean {
    return this.authState.user?.isAdmin || false;
  }

  /**
   * 認証済みかどうかチェック
   */
  public isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * デバッグ用：認証情報をログ出力
   */
  public async logAuthInfo(): Promise<void> {
    console.group('Authentication Information');
    console.log('Auth State:', this.authState);
    await jwtManager.logTokenInfo();
    console.groupEnd();
  }
}

// シングルトンインスタンスをエクスポート
export const authService = AuthService.getInstance();
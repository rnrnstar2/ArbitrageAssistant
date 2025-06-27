import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import type { AuthSession, AuthTokens } from 'aws-amplify/auth';

export interface JWTTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}

export interface TokenInfo {
  token: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  'cognito:groups'?: string[];
}

/**
 * JWT管理ユーティリティクラス
 * アクセストークン・IDトークン・リフレッシュトークンの管理を行う
 */
export class JWTManager {
  private static instance: JWTManager;
  private tokenRefreshPromise: Promise<AuthSession> | null = null;

  private constructor() {}

  public static getInstance(): JWTManager {
    if (!JWTManager.instance) {
      JWTManager.instance = new JWTManager();
    }
    return JWTManager.instance;
  }

  /**
   * 現在の認証セッションを取得
   */
  public async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const session = await fetchAuthSession();
      return session;
    } catch (error) {
      console.warn('Failed to get current session:', error);
      return null;
    }
  }

  /**
   * 現在のJWTトークンを取得
   */
  public async getCurrentTokens(): Promise<JWTTokens | null> {
    try {
      const session = await this.getCurrentSession();
      if (!session?.tokens) {
        return null;
      }

      const { accessToken, idToken } = session.tokens;
      
      return {
        accessToken: accessToken.toString(),
        idToken: idToken?.toString() || '',
        refreshToken: undefined, // リフレッシュトークンは直接取得できない
      };
    } catch (error) {
      console.error('Failed to get current tokens:', error);
      return null;
    }
  }

  /**
   * JWTトークンをデコード（検証なし）
   */
  public decodeJWT(token: string): TokenInfo | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(atob(parts[1]));
      return payload as TokenInfo;
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }

  /**
   * トークンの有効期限をチェック
   * @param token JWT token
   * @param bufferMinutes 有効期限前の余裕時間（分）
   */
  public isTokenExpired(token: string, bufferMinutes: number = 5): boolean {
    const decoded = this.decodeJWT(token);
    if (!decoded?.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferSeconds = bufferMinutes * 60;
    
    return decoded.exp <= (now + bufferSeconds);
  }

  /**
   * トークンが期限切れの場合、自動的にリフレッシュ
   */
  public async getValidAccessToken(): Promise<string | null> {
    try {
      const session = await this.getCurrentSession();
      if (!session?.tokens?.accessToken) {
        return null;
      }

      const accessToken = session.tokens.accessToken.toString();
      
      // トークンの有効期限をチェック
      if (this.isTokenExpired(accessToken)) {
        console.log('Access token expired, attempting refresh...');
        
        // 既にリフレッシュ中の場合は待機
        if (this.tokenRefreshPromise) {
          const refreshedSession = await this.tokenRefreshPromise;
          return refreshedSession.tokens?.accessToken?.toString() || null;
        }

        // 新しいリフレッシュを開始
        this.tokenRefreshPromise = this.refreshTokens();
        const refreshedSession = await this.tokenRefreshPromise;
        this.tokenRefreshPromise = null;
        
        return refreshedSession.tokens?.accessToken?.toString() || null;
      }

      return accessToken;
    } catch (error) {
      console.error('Failed to get valid access token:', error);
      this.tokenRefreshPromise = null;
      return null;
    }
  }

  /**
   * トークンをリフレッシュ
   */
  private async refreshTokens(): Promise<AuthSession> {
    try {
      // Amplify Auth v6では自動的にトークンリフレッシュが行われる
      // fetchAuthSession()呼び出しで自動的にリフレッシュされる
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (!session.tokens) {
        throw new Error('Failed to refresh tokens');
      }

      console.log('Tokens refreshed successfully');
      return session;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * ユーザー情報を取得
   */
  public async getCurrentUser() {
    try {
      const user = await getCurrentUser();
      return user;
    } catch (error) {
      console.warn('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * ユーザーのグループ情報を取得
   */
  public async getUserGroups(): Promise<string[]> {
    try {
      const session = await this.getCurrentSession();
      if (!session?.tokens?.accessToken) {
        return [];
      }

      const decoded = this.decodeJWT(session.tokens.accessToken.toString());
      return decoded?.['cognito:groups'] || [];
    } catch (error) {
      console.error('Failed to get user groups:', error);
      return [];
    }
  }

  /**
   * ユーザーが管理者かどうかをチェック
   */
  public async isAdmin(): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes('admin');
  }

  /**
   * ユーザーが特定のグループに属しているかチェック
   */
  public async hasGroup(groupName: string): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes(groupName);
  }

  /**
   * 認証状態をクリア（ログアウト）
   */
  public async signOut(): Promise<void> {
    try {
      await signOut();
      this.tokenRefreshPromise = null;
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Authorization ヘッダー用の値を取得
   */
  public async getAuthorizationHeader(): Promise<string | null> {
    const token = await this.getValidAccessToken();
    return token ? `Bearer ${token}` : null;
  }

  /**
   * トークン情報をログ出力（デバッグ用）
   */
  public async logTokenInfo(): Promise<void> {
    try {
      const tokens = await this.getCurrentTokens();
      if (!tokens) {
        console.log('No tokens available');
        return;
      }

      const accessTokenInfo = this.decodeJWT(tokens.accessToken);
      const idTokenInfo = tokens.idToken ? this.decodeJWT(tokens.idToken) : null;

      console.group('JWT Token Information');
      console.log('Access Token Info:', accessTokenInfo);
      console.log('ID Token Info:', idTokenInfo);
      console.log('Access Token Expired:', this.isTokenExpired(tokens.accessToken));
      if (tokens.idToken) {
        console.log('ID Token Expired:', this.isTokenExpired(tokens.idToken));
      }
      console.groupEnd();
    } catch (error) {
      console.error('Failed to log token info:', error);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const jwtManager = JWTManager.getInstance();
// JWT管理
export {
  JWTManager,
  jwtManager,
  type JWTTokens,
  type TokenInfo,
} from './jwt-manager';

// 認証サービス
export {
  AuthService,
  authService,
  type SignUpData,
  type SignInData,
  type AuthUser,
  type AuthState,
} from './auth-service';

// 認証フロー強化
export {
  AuthFlows,
  authFlows,
  type SignUpResult,
  type SignInResult,
  type PasswordResetResult,
  type AuthFormValidation,
} from './auth-flows';

// マルチクライアント統合
export {
  MultiClientIntegration,
  multiClientIntegration,
  type ClientConfig,
  type IntegrationTestResult,
  type MultiClientStatus,
} from './multi-client-integration';

// 便利な型定義とユーティリティ
export interface AuthConfig {
  // カスタム認証設定用（将来の拡張用）
  tokenRefreshBuffer?: number; // トークンリフレッシュのバッファ時間（分）
  autoRefresh?: boolean; // 自動リフレッシュを有効にするか
}

// 認証エラー定義
export class AuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// よく使用される認証チェック関数
export const authUtils = {
  /**
   * ユーザーが管理者権限を持っているかチェック
   */
  async requireAdmin(): Promise<void> {
    const isAdmin = await authService.isAdmin();
    if (!isAdmin) {
      throw new AuthError('管理者権限が必要です', 'INSUFFICIENT_PERMISSIONS');
    }
  },

  /**
   * ユーザーが認証済みかチェック
   */
  async requireAuth(): Promise<void> {
    const isAuthenticated = authService.isAuthenticated();
    if (!isAuthenticated) {
      throw new AuthError('認証が必要です', 'UNAUTHENTICATED');
    }
  },

  /**
   * ユーザーが特定のグループに属しているかチェック
   */
  async requireGroup(groups: string[]): Promise<void> {
    const hasPermission = await authService.hasPermission(groups);
    if (!hasPermission) {
      throw new AuthError(`必要な権限: ${groups.join(', ')}`, 'INSUFFICIENT_PERMISSIONS');
    }
  },

  /**
   * 現在のユーザーIDを取得（認証チェック付き）
   */
  async getCurrentUserId(): Promise<string> {
    await this.requireAuth();
    const userId = authService.getCurrentUserId();
    if (!userId) {
      throw new AuthError('ユーザーIDを取得できません', 'USER_ID_NOT_FOUND');
    }
    return userId;
  },
};
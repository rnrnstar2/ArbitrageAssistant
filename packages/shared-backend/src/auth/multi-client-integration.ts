import { authService, type AuthState } from './auth-service';
import { jwtManager } from './jwt-manager';
import { authFlows } from './auth-flows';

export interface ClientConfig {
  appType: 'admin' | 'hedge-system';
  enableWebSocket: boolean;
  websocketUrl?: string;
  expectedGroups: string[];
  requiredPermissions: string[];
}

export interface IntegrationTestResult {
  clientType: string;
  success: boolean;
  errors: string[];
  details: {
    authenticationTest: boolean;
    jwtValidation: boolean;
    permissionCheck: boolean;
    websocketCompatibility?: boolean;
  };
}

export interface MultiClientStatus {
  admin: {
    authenticated: boolean;
    userGroups: string[];
    hasAdminAccess: boolean;
  };
  hedgeSystem: {
    authenticated: boolean;
    userGroups: string[];
    hasClientAccess: boolean;
    websocketReady: boolean;
  };
  crossClientCompatibility: boolean;
}

/**
 * マルチクライアント認証統合ユーティリティ
 * 管理画面とHedge Systemの認証統合をテスト・検証する
 */
export class MultiClientIntegration {
  private static instance: MultiClientIntegration;

  private constructor() {}

  public static getInstance(): MultiClientIntegration {
    if (!MultiClientIntegration.instance) {
      MultiClientIntegration.instance = new MultiClientIntegration();
    }
    return MultiClientIntegration.instance;
  }

  /**
   * クライアント設定を取得
   */
  public getClientConfigs(): Record<string, ClientConfig> {
    return {
      admin: {
        appType: 'admin',
        enableWebSocket: false,
        expectedGroups: ['admin', 'client'],
        requiredPermissions: ['admin'],
      },
      hedgeSystem: {
        appType: 'hedge-system',
        enableWebSocket: true,
        websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
        expectedGroups: ['client'],
        requiredPermissions: ['client'],
      },
    };
  }

  /**
   * 認証状態の基本検証
   */
  public async validateAuthenticationState(): Promise<{
    isValid: boolean;
    authState: AuthState;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // 認証状態を確認
      const authState = await authService.checkAuthState();

      if (!authState.isAuthenticated) {
        errors.push('ユーザーが認証されていません');
      }

      if (!authState.user) {
        errors.push('ユーザー情報が取得できません');
      }

      if (!authState.tokens) {
        errors.push('認証トークンが取得できません');
      }

      // JWTトークンの検証
      if (authState.tokens) {
        const isAccessTokenValid = !jwtManager.isTokenExpired(authState.tokens.accessToken);
        if (!isAccessTokenValid) {
          errors.push('アクセストークンが期限切れです');
        }

        if (authState.tokens.idToken) {
          const isIdTokenValid = !jwtManager.isTokenExpired(authState.tokens.idToken);
          if (!isIdTokenValid) {
            errors.push('IDトークンが期限切れです');
          }
        }
      }

      return {
        isValid: errors.length === 0,
        authState,
        errors,
      };
    } catch (error) {
      errors.push(`認証状態の検証に失敗: ${error instanceof Error ? error.message : '不明なエラー'}`);
      
      return {
        isValid: false,
        authState: {
          isAuthenticated: false,
          user: null,
          tokens: null,
        },
        errors,
      };
    }
  }

  /**
   * クライアント別統合テスト
   */
  public async testClientIntegration(clientType: 'admin' | 'hedge-system'): Promise<IntegrationTestResult> {
    const config = this.getClientConfigs()[clientType];
    const errors: string[] = [];
    const details = {
      authenticationTest: false,
      jwtValidation: false,
      permissionCheck: false,
      websocketCompatibility: false,
    };

    try {
      // 1. 認証テスト
      const authValidation = await this.validateAuthenticationState();
      details.authenticationTest = authValidation.isValid;
      if (!authValidation.isValid) {
        errors.push(...authValidation.errors);
      }

      // 2. JWTトークン検証
      try {
        const validToken = await jwtManager.getValidAccessToken();
        details.jwtValidation = !!validToken;
        if (!validToken) {
          errors.push('有効なアクセストークンが取得できません');
        }
      } catch (error) {
        errors.push(`JWTトークン検証失敗: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }

      // 3. 権限チェック
      try {
        const hasPermission = await authService.hasPermission(config.requiredPermissions);
        details.permissionCheck = hasPermission;
        if (!hasPermission) {
          errors.push(`必要な権限がありません: ${config.requiredPermissions.join(', ')}`);
        }
      } catch (error) {
        errors.push(`権限チェック失敗: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }

      // 4. WebSocket互換性テスト（hedge-systemの場合）
      if (config.enableWebSocket) {
        try {
          const websocketReady = this.checkWebSocketCompatibility(config);
          details.websocketCompatibility = websocketReady;
          if (!websocketReady) {
            errors.push('WebSocket設定に問題があります');
          }
        } catch (error) {
          errors.push(`WebSocket互換性テスト失敗: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      } else {
        details.websocketCompatibility = true; // WebSocketが不要な場合は成功とする
      }

      return {
        clientType,
        success: errors.length === 0,
        errors,
        details,
      };
    } catch (error) {
      errors.push(`統合テスト実行エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      
      return {
        clientType,
        success: false,
        errors,
        details,
      };
    }
  }

  /**
   * WebSocket互換性をチェック
   */
  private checkWebSocketCompatibility(config: ClientConfig): boolean {
    // WebSocket URLの設定確認
    if (config.enableWebSocket && !config.websocketUrl) {
      console.warn('WebSocket is enabled but no URL is configured');
      return false;
    }

    // WebSocket URLの形式確認
    if (config.websocketUrl) {
      try {
        const url = new URL(config.websocketUrl);
        const isValidProtocol = url.protocol === 'ws:' || url.protocol === 'wss:';
        if (!isValidProtocol) {
          console.warn('Invalid WebSocket protocol:', url.protocol);
          return false;
        }
      } catch (error) {
        console.warn('Invalid WebSocket URL format:', config.websocketUrl);
        return false;
      }
    }

    return true;
  }

  /**
   * 全クライアントの統合テスト実行
   */
  public async testAllClients(): Promise<Record<string, IntegrationTestResult>> {
    const results: Record<string, IntegrationTestResult> = {};

    for (const clientType of ['admin', 'hedge-system'] as const) {
      results[clientType] = await this.testClientIntegration(clientType);
    }

    return results;
  }

  /**
   * マルチクライアント統合状況の取得
   */
  public async getMultiClientStatus(): Promise<MultiClientStatus> {
    const authState = await authService.getCurrentAuthState();
    const userGroups = authState.user?.groups || [];

    return {
      admin: {
        authenticated: authState.isAuthenticated,
        userGroups,
        hasAdminAccess: userGroups.includes('admin'),
      },
      hedgeSystem: {
        authenticated: authState.isAuthenticated,
        userGroups,
        hasClientAccess: userGroups.includes('client'),
        websocketReady: this.checkWebSocketCompatibility({
          appType: 'hedge-system',
          enableWebSocket: true,
          websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
          expectedGroups: ['client'],
          requiredPermissions: ['client'],
        }),
      },
      crossClientCompatibility: authState.isAuthenticated && userGroups.length > 0,
    };
  }

  /**
   * 認証フローの統合テスト
   */
  public async testAuthenticationFlows(): Promise<{
    signUpFlow: boolean;
    signInFlow: boolean;
    tokenRefresh: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let signUpFlow = false;
    let signInFlow = false;
    let tokenRefresh = false;

    try {
      // サインアップフォーム検証テスト
      const testSignUpData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        fullname: 'Test User',
      };

      const signUpValidation = authFlows.validateSignUpForm(testSignUpData);
      signUpFlow = signUpValidation.isValid;
      if (!signUpFlow) {
        errors.push(`サインアップフォーム検証失敗: ${Object.values(signUpValidation.errors).join(', ')}`);
      }

      // サインインフォーム検証テスト
      const testSignInData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const signInValidation = authFlows.validateSignInForm(testSignInData);
      signInFlow = signInValidation.isValid;
      if (!signInFlow) {
        errors.push(`サインインフォーム検証失敗: ${Object.values(signInValidation.errors).join(', ')}`);
      }

      // トークンリフレッシュテスト（現在認証済みの場合）
      if (authService.isAuthenticated()) {
        try {
          const validToken = await jwtManager.getValidAccessToken();
          tokenRefresh = !!validToken;
          if (!tokenRefresh) {
            errors.push('トークンリフレッシュに失敗しました');
          }
        } catch (error) {
          errors.push(`トークンリフレッシュエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      } else {
        tokenRefresh = true; // 未認証の場合はスキップ
      }

    } catch (error) {
      errors.push(`認証フローテストエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }

    return {
      signUpFlow,
      signInFlow,
      tokenRefresh,
      errors,
    };
  }

  /**
   * 統合テスト結果のサマリー表示
   */
  public async generateIntegrationReport(): Promise<string> {
    const allResults = await this.testAllClients();
    const authFlowResults = await this.testAuthenticationFlows();
    const multiClientStatus = await this.getMultiClientStatus();

    let report = '🔐 マルチクライアント認証統合レポート\n';
    report += '===========================================\n\n';

    // 全体ステータス
    const allSuccess = Object.values(allResults).every(result => result.success);
    report += `📊 統合テスト結果: ${allSuccess ? '✅ 成功' : '❌ 失敗'}\n\n`;

    // クライアント別結果
    report += '📱 クライアント別テスト結果:\n';
    for (const [clientType, result] of Object.entries(allResults)) {
      report += `  ${clientType}: ${result.success ? '✅' : '❌'}\n`;
      if (result.errors.length > 0) {
        report += `    エラー: ${result.errors.join(', ')}\n`;
      }
    }
    report += '\n';

    // 認証フロー結果
    report += '🔄 認証フローテスト結果:\n';
    report += `  サインアップ: ${authFlowResults.signUpFlow ? '✅' : '❌'}\n`;
    report += `  サインイン: ${authFlowResults.signInFlow ? '✅' : '❌'}\n`;
    report += `  トークンリフレッシュ: ${authFlowResults.tokenRefresh ? '✅' : '❌'}\n`;
    if (authFlowResults.errors.length > 0) {
      report += `  エラー: ${authFlowResults.errors.join(', ')}\n`;
    }
    report += '\n';

    // マルチクライアント状況
    report += '🌐 マルチクライアント状況:\n';
    report += `  Admin認証: ${multiClientStatus.admin.authenticated ? '✅' : '❌'}\n`;
    report += `  Hedge System認証: ${multiClientStatus.hedgeSystem.authenticated ? '✅' : '❌'}\n`;
    report += `  クロスクライアント互換性: ${multiClientStatus.crossClientCompatibility ? '✅' : '❌'}\n`;
    report += `  WebSocket準備: ${multiClientStatus.hedgeSystem.websocketReady ? '✅' : '❌'}\n`;

    return report;
  }
}

// シングルトンインスタンスをエクスポート
export const multiClientIntegration = MultiClientIntegration.getInstance();
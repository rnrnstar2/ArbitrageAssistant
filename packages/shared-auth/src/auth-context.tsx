/**
 * 統一認証コンテキスト - MVP システム設計書準拠
 * 
 * 設計原則：
 * - アプリケーション間での認証状態統一管理
 * - TypeScript型安全性の確保
 * - パフォーマンス最適化（useMemo, useCallback）
 * - エラーハンドリングの統合
 */

"use client";

import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react';
import { AuthService } from './auth-service';
import { AuthErrorHandler } from './error-handler';
import { AuthContextType, AuthProviderOptions } from './types';

// AuthContext の作成
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Props
export interface AuthProviderProps {
  children: React.ReactNode;
  options?: AuthProviderOptions;
  fallback?: React.ReactNode;
  enableDebugLogs?: boolean;
}

/**
 * 統一認証プロバイダー
 * admin/hedge-system間で認証状態を共有
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ 
  children, 
  options = {},
  fallback = null,
  enableDebugLogs = false
}) => {
  // AuthService インスタンスの作成（メモ化）
  const authService = useMemo(() => {
    if (enableDebugLogs) {
      console.log('🔧 Creating AuthService instance with options:', options);
    }
    return new AuthService(options);
  }, [options, enableDebugLogs]);

  // 認証状態の管理（初期状態を同期的に設定）
  const [state, setState] = useState<Pick<AuthContextType, 'user' | 'isAuthenticated' | 'isLoading' | 'authToken' | 'groups'>>(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    authToken: null,
    groups: []
  }));
  
  // 初期化完了フラグ
  const [isInitialized, setIsInitialized] = useState(false);

  // AuthServiceの状態変更を監視
  useEffect(() => {
    const unsubscribe = authService.subscribe(() => {
      const newState = authService.getState();
      if (enableDebugLogs) {
        console.log('🔄 Auth state updated:', newState);
      }
      setState({
        user: newState.user,
        isAuthenticated: newState.isAuthenticated,
        isLoading: newState.isLoading,
        authToken: newState.authToken,
        groups: newState.groups
      });
      
      // 初回の認証チェック完了時にフラグを設定
      if (!isInitialized && !newState.isLoading) {
        setIsInitialized(true);
        if (enableDebugLogs) {
          console.log('✅ AuthProvider initialized');
        }
      }
    });

    // 初期状態を即座に取得
    const initialState = authService.getState();
    setState({
      user: initialState.user,
      isAuthenticated: initialState.isAuthenticated,
      isLoading: initialState.isLoading,
      authToken: initialState.authToken,
      groups: initialState.groups
    });
    if (enableDebugLogs) {
      console.log('🔄 Initial auth state set:', initialState);
    }

    return unsubscribe;
  }, [authService, enableDebugLogs, isInitialized]);

  // エラーハンドラーの設定
  useEffect(() => {
    AuthErrorHandler.configure({
      enableNotifications: true,
      enableAutoRecovery: true,
      enableSecurityAudit: true,
      logLevel: enableDebugLogs ? 'info' : 'error'
    });
  }, [enableDebugLogs]);

  // メソッドのメモ化
  const signIn = useCallback(async (email: string, password: string) => {
    if (enableDebugLogs) {
      console.log('🔑 Signing in user:', email);
    }
    return authService.signIn(email, password);
  }, [authService, enableDebugLogs]);

  const signOut = useCallback(async () => {
    if (enableDebugLogs) {
      console.log('🚪 Signing out user');
    }
    return authService.signOut();
  }, [authService, enableDebugLogs]);

  const checkAuthState = useCallback(async () => {
    if (enableDebugLogs) {
      console.log('🔍 Checking auth state');
    }
    return authService.checkAuthState();
  }, [authService, enableDebugLogs]);

  const refreshSession = useCallback(async () => {
    if (enableDebugLogs) {
      console.log('🔄 Refreshing session');
    }
    return authService.refreshSession();
  }, [authService, enableDebugLogs]);

  const hasPermission = useCallback((operation: string, resource: string) => {
    return authService.hasPermission(operation, resource);
  }, [authService]);

  const getWebSocketConnectionOptions = useCallback(() => {
    return authService.getWebSocketConnectionOptions();
  }, [authService]);

  // Context値の作成（メモ化）
  const contextValue = useMemo<AuthContextType>(() => ({
    ...state,
    signIn,
    signOut,
    checkAuthState,
    refreshSession,
    hasPermission,
    getWebSocketConnectionOptions
  }), [
    state,
    signIn,
    signOut,
    checkAuthState,
    refreshSession,
    hasPermission,
    getWebSocketConnectionOptions
  ]);

  // ローディング中のフォールバック
  if (state.isLoading && fallback) {
    return <>{fallback}</>;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 認証コンテキストを使用するためのカスタムフック
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * 認証状態を簡潔に取得するカスタムフック
 */
export const useAuthState = () => {
  const { user, isAuthenticated, isLoading, groups } = useAuth();
  
  return {
    user,
    isAuthenticated,
    isLoading,
    groups,
    userId: user?.userId
  };
};

/**
 * 権限チェック用カスタムフック
 */
export const usePermission = () => {
  const { hasPermission } = useAuth();
  
  return useCallback((operation: string, resource: string = '') => {
    return hasPermission(operation, resource);
  }, [hasPermission]);
};

/**
 * WebSocket接続用カスタムフック
 */
export const useWebSocketAuth = () => {
  const { getWebSocketConnectionOptions, isAuthenticated } = useAuth();
  
  return useMemo(() => {
    if (!isAuthenticated) {
      return null;
    }
    
    return getWebSocketConnectionOptions();
  }, [getWebSocketConnectionOptions, isAuthenticated]);
};

/**
 * 認証状態の詳細情報を提供するカスタムフック
 */
export const useAuthDetails = () => {
  const auth = useAuth();
  
  return useMemo(() => ({
    ...auth,
    // 便利なヘルパー
    isAdmin: auth.groups.includes('ADMIN'),
    isClient: auth.groups.includes('CLIENT'),
    hasAnyRole: auth.groups.length > 0,
    
    // 認証トークンの有効性
    hasValidToken: !!auth.authToken,
    
    // WebSocket準備状況
    isWebSocketReady: !!auth.getWebSocketConnectionOptions()
  }), [auth]);
};

/**
 * デバッグ用：認証状態の監視フック
 */
export const useAuthDebug = (enabled: boolean = false) => {
  const auth = useAuth();
  
  useEffect(() => {
    if (enabled) {
      console.log('🐛 Auth Debug State:', {
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        user: auth.user?.userId,
        groups: auth.groups,
        hasToken: !!auth.authToken
      });
    }
  }, [auth, enabled]);
  
  return enabled ? auth : null;
};
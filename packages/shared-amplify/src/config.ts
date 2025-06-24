/**
 * 環境別最適化Amplify設定 - MVP システム設計書準拠
 * 
 * 設計原則：
 * - amplify_outputs.jsonの一元管理
 * - アプリタイプ別最適化設定
 * - 環境別パフォーマンス調整
 * - 型安全な設定値の提供
 */

import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../amplify_outputs.json';

// アプリタイプ別設定インターフェース
export interface AppOptimizedConfig {
  appType: 'admin' | 'hedge-system';
  sessionTimeout: number; // seconds
  cookieStorage: 'secure' | 'local' | 'memory';
  enableOfflineSupport: boolean;
  cacheSettings: {
    maxAge: number; // seconds
    maxEntries: number;
  };
  networkSettings: {
    timeout: number; // ms
    retryCount: number;
    batchDelay: number; // ms
  };
  securitySettings: {
    requireHTTPS: boolean;
    enableCSP: boolean;
    tokenRotationInterval: number; // minutes
  };
}

// デフォルト設定
const DEFAULT_ADMIN_CONFIG: AppOptimizedConfig = {
  appType: 'admin',
  sessionTimeout: 8 * 60 * 60, // 8時間
  cookieStorage: 'secure',
  enableOfflineSupport: false,
  cacheSettings: {
    maxAge: 5 * 60, // 5分
    maxEntries: 100
  },
  networkSettings: {
    timeout: 30000, // 30秒
    retryCount: 3,
    batchDelay: 50 // 50ms
  },
  securitySettings: {
    requireHTTPS: true,
    enableCSP: true,
    tokenRotationInterval: 30 // 30分
  }
};

const DEFAULT_HEDGE_CONFIG: AppOptimizedConfig = {
  appType: 'hedge-system',
  sessionTimeout: 24 * 60 * 60, // 24時間
  cookieStorage: 'local',
  enableOfflineSupport: true,
  cacheSettings: {
    maxAge: 10 * 60, // 10分
    maxEntries: 200
  },
  networkSettings: {
    timeout: 45000, // 45秒（WebSocket通信考慮）
    retryCount: 5,
    batchDelay: 100 // 100ms
  },
  securitySettings: {
    requireHTTPS: false, // localhost対応
    enableCSP: false,
    tokenRotationInterval: 60 // 60分
  }
};

// 型安全な設定オブジェクト
export const amplifyConfig = amplifyOutputs;

/**
 * アプリタイプ別最適化設定の取得
 */
export const getOptimizedAmplifyConfig = (appType: 'admin' | 'hedge-system'): AppOptimizedConfig => {
  const baseConfig = appType === 'admin' ? DEFAULT_ADMIN_CONFIG : DEFAULT_HEDGE_CONFIG;
  
  // 環境別調整
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  const optimizedConfig: AppOptimizedConfig = {
    ...baseConfig,
    securitySettings: {
      ...baseConfig.securitySettings,
      requireHTTPS: isProduction && appType === 'admin',
    },
    networkSettings: {
      ...baseConfig.networkSettings,
      timeout: isDevelopment ? baseConfig.networkSettings.timeout / 2 : baseConfig.networkSettings.timeout,
      retryCount: isDevelopment ? 1 : baseConfig.networkSettings.retryCount,
    },
    cacheSettings: {
      ...baseConfig.cacheSettings,
      maxAge: isDevelopment ? 30 : baseConfig.cacheSettings.maxAge, // 開発時は30秒
    }
  };
  
  return optimizedConfig;
};

/**
 * Amplify設定の初期化（アプリタイプ別最適化）
 * パッケージ読み込み時またはアプリケーション起動時に呼び出し
 */
export const configureAmplify = (appType: 'admin' | 'hedge-system' = 'admin') => {
  try {
    const optimizedConfig = getOptimizedAmplifyConfig(appType);
    
    Amplify.configure(amplifyOutputs, {
      ssr: false  // SSRを無効化（Tauri対応）
    });
    
    console.log(`✅ AWS Amplify configured for ${appType} with optimizations:`, {
      timeout: optimizedConfig.networkSettings.timeout,
      retryCount: optimizedConfig.networkSettings.retryCount,
      sessionTimeout: optimizedConfig.sessionTimeout,
      cacheMaxAge: optimizedConfig.cacheSettings.maxAge
    });
    
    return true;
  } catch (error) {
    console.error('❌ Failed to configure AWS Amplify:', error);
    return false;
  }
};

/**
 * Amplify設定の状態確認
 */
export const getAmplifyConfig = () => {
  try {
    return Amplify.getConfig();
  } catch (error) {
    console.warn('⚠️ Amplify not configured yet');
    return null;
  }
};

/**
 * GraphQL API エンドポイント取得
 */
export const getGraphQLEndpoint = (): string => {
  return amplifyOutputs.data.url;
};

/**
 * AWS リージョン取得  
 */
export const getAWSRegion = (): string => {
  return amplifyOutputs.data.aws_region;
};

/**
 * Cognito User Pool ID 取得
 */
export const getUserPoolId = (): string => {
  return amplifyOutputs.auth.user_pool_id;
};

/**
 * Cognito User Pool Client ID 取得
 */
export const getUserPoolClientId = (): string => {
  return amplifyOutputs.auth.user_pool_client_id;
};

/**
 * 環境別設定の取得
 */
export const getEnvironmentConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    isDevelopment,
    isProduction,
    enableDebugLogs: isDevelopment,
    enablePerformanceMonitoring: isProduction,
    apiRetryCount: isDevelopment ? 1 : 3,
    apiTimeout: isDevelopment ? 10000 : 30000
  };
};

/**
 * 接続状態の確認
 */
export const isAmplifyConfigured = (): boolean => {
  try {
    const config = Amplify.getConfig();
    return !!(config?.API?.GraphQL?.endpoint);
  } catch {
    return false;
  }
};

/**
 * 設定の再初期化（エラー回復用）
 */
export const reconfigureAmplify = (): boolean => {
  console.log('🔄 Reconfiguring AWS Amplify...');
  return configureAmplify();
};

/**
 * 設定レポートの生成
 */
export const generateConfigReport = (appType: 'admin' | 'hedge-system') => {
  const config = getOptimizedAmplifyConfig(appType);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    appType,
    environment: isDevelopment ? 'development' : 'production',
    config,
    amplifyEndpoint: amplifyOutputs.data.url,
    region: amplifyOutputs.data.aws_region,
    userPoolId: amplifyOutputs.auth.user_pool_id,
    recommendations: [
      config.securitySettings.requireHTTPS ? '✅ HTTPS required' : '⚠️ HTTPS not required',
      config.enableOfflineSupport ? '✅ Offline support enabled' : 'ℹ️ Offline support disabled',
      config.networkSettings.retryCount > 1 ? '✅ Network retry configured' : '⚠️ No network retry',
    ]
  };
};

// 自動設定の実行（パッケージ読み込み時）
// NOTE: この設定により、shared-amplifyをimportするだけで自動設定される
if (typeof window !== 'undefined') {
  // ブラウザ環境でのみ自動設定を実行
  // アプリタイプは環境変数または URL から推測
  const appType = window.location.pathname.includes('admin') ? 'admin' : 'hedge-system';
  configureAmplify(appType);
} else {
  // サーバーサイド環境では手動設定を要求
  console.log('⚠️ Server-side environment detected. Manual Amplify configuration required.');
}
/**
 * Amplify設定の一元管理 - MVP システム設計書準拠
 * 
 * 設計原則：
 * - amplify_outputs.jsonの一元管理
 * - 自動設定でアプリケーション側の設定不要
 * - 型安全な設定値の提供
 */

import { Amplify } from 'aws-amplify';
import amplifyOutputs from '../amplify_outputs.json';

// 型安全な設定オブジェクト
export const amplifyConfig = amplifyOutputs;

/**
 * Amplify設定の初期化（パフォーマンス最適化 + Tauri対応）
 * パッケージ読み込み時またはアプリケーション起動時に呼び出し
 */
export const configureAmplify = () => {
  try {
    Amplify.configure(amplifyOutputs, {
      ssr: false,  // SSRを無効化（Tauri対応）
      // パフォーマンス最適化設定（Amplify v6対応）
      // ネットワーク最適化
      requestHandler: {
        timeout: 30000, // 30秒タイムアウト
        retryCount: 3
      }
    });
    
    console.log('✅ AWS Amplify configured successfully with performance optimizations');
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

// 自動設定の実行（パッケージ読み込み時）
// NOTE: この設定により、shared-amplifyをimportするだけで自動設定される
if (typeof window !== 'undefined') {
  // ブラウザ環境でのみ自動設定を実行
  configureAmplify();
} else {
  // サーバーサイド環境では手動設定を要求
  console.log('⚠️ Server-side environment detected. Manual Amplify configuration required.');
}
/**
 * 事前設定済みAmplifyクライアント - MVP システム設計書準拠
 * 
 * 設計原則：
 * - 型安全なGraphQLクライアント
 * - userIdベースの認証情報取得
 * - エラーハンドリングの統一
 */

import { generateClient, type Client } from 'aws-amplify/api';
import { getCurrentUser as amplifyGetCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';

// 型安全なGraphQLクライアント
export const amplifyClient: Client<Schema> = generateClient<Schema>();

/**
 * 現在のユーザーID取得
 * MVP設計書v7.0のuserIdベース最適化対応
 */
export const getCurrentUserId = async (): Promise<string> => {
  try {
    const user = await amplifyGetCurrentUser();
    return user.userId;
  } catch (error) {
    console.error('❌ User not authenticated:', error);
    throw new Error('User not authenticated');
  }
};

/**
 * 現在のユーザー情報取得
 */
export const getCurrentUser = async () => {
  try {
    const user = await amplifyGetCurrentUser();
    return user;
  } catch (error) {
    console.error('❌ Failed to get current user:', error);
    throw new Error('Failed to get current user');
  }
};

/**
 * 認証状態確認
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
};

/**
 * ユーザーの認証状態とuserIdを安全に取得
 */
export const getAuthState = async (): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  user?: any;
}> => {
  try {
    const user = await getCurrentUser();
    return {
      isAuthenticated: true,
      userId: user.userId,
      user
    };
  } catch {
    return {
      isAuthenticated: false
    };
  }
};

/**
 * GraphQL操作のエラーハンドリング
 */
export const handleGraphQLError = (error: any): Error => {
  console.error('🔥 GraphQL Error:', error);
  
  if (error.errors && error.errors.length > 0) {
    const firstError = error.errors[0];
    return new Error(firstError.message || 'GraphQL operation failed');
  }
  
  if (error.message) {
    return new Error(error.message);
  }
  
  return new Error('Unknown GraphQL error');
};

/**
 * GraphQL操作のリトライ機能
 */
export const retryGraphQLOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`⚠️ GraphQL operation attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw handleGraphQLError(error);
      }
      
      // 指数バックオフでリトライ
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
  
  throw new Error('Max retries exceeded');
};
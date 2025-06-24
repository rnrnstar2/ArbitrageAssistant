/**
 * 高性能Amplifyクライアント - MVP システム設計書準拠
 * 
 * 設計原則：
 * - 型安全なGraphQLクライアント
 * - userIdベースの認証情報取得
 * - エラーハンドリングの統一
 * - パフォーマンス最適化（キャッシュ、バッチ処理、メモ化）
 */

import { generateClient, type Client } from 'aws-amplify/api';
import { getCurrentUser as amplifyGetCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';

// パフォーマンス最適化用のインターフェース
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface BatchRequest {
  id: string;
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// キャッシュとバッチ処理の管理
class PerformanceManager {
  private cache = new Map<string, CacheEntry<any>>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分

  /**
   * キャッシュからデータを取得
   */
  getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL チェック
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * データをキャッシュに保存
   */
  setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * キャッシュをクリア
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * バッチ処理にリクエストを追加
   */
  addToBatch<T>(id: string, operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.batchQueue.push({ id, operation, resolve, reject });
      
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.BATCH_DELAY);
      }
    });
  }

  /**
   * バッチ処理の実行
   */
  private async processBatch(): Promise<void> {
    const currentBatch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    // 並列実行でパフォーマンス向上
    const results = await Promise.allSettled(
      currentBatch.map(async (request) => {
        try {
          const result = await request.operation();
          request.resolve(result);
          return { id: request.id, result };
        } catch (error) {
          request.reject(error);
          return { id: request.id, error };
        }
      })
    );

    console.log(`📊 Batch processed: ${results.length} operations`);
  }

  /**
   * キャッシュ統計の取得
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      queueSize: this.batchQueue.length
    };
  }
}

// パフォーマンスマネージャーのインスタンス
const performanceManager = new PerformanceManager();

// メモ化された型安全なGraphQLクライアント
let clientInstance: Client<Schema> | null = null;
export const amplifyClient: Client<Schema> = (() => {
  if (!clientInstance) {
    clientInstance = generateClient<Schema>();
    console.log('🚀 Amplify client initialized');
  }
  return clientInstance;
})();

/**
 * 現在のユーザーID取得（キャッシュ対応）
 * MVP設計書v7.0のuserIdベース最適化対応
 */
export const getCurrentUserId = async (): Promise<string> => {
  const cacheKey = 'current_user_id';
  
  // キャッシュから取得を試行
  const cachedUserId = performanceManager.getFromCache<string>(cacheKey);
  if (cachedUserId) {
    return cachedUserId;
  }

  try {
    const user = await amplifyGetCurrentUser();
    
    // 30秒間キャッシュ（頻繁に呼ばれるため短時間）
    performanceManager.setCache(cacheKey, user.userId, 30 * 1000);
    
    return user.userId;
  } catch (error) {
    console.error('❌ User not authenticated:', error);
    throw new Error('User not authenticated');
  }
};

/**
 * 現在のユーザー情報取得（キャッシュ対応）
 */
export const getCurrentUser = async () => {
  const cacheKey = 'current_user';
  
  // キャッシュから取得を試行
  const cachedUser = performanceManager.getFromCache(cacheKey);
  if (cachedUser) {
    return cachedUser;
  }

  try {
    const user = await amplifyGetCurrentUser();
    
    // 2分間キャッシュ
    performanceManager.setCache(cacheKey, user, 2 * 60 * 1000);
    
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
      userId: (user as any).userId || (user as any).username,
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
 * 高性能GraphQL操作のリトライ機能（バッチ処理対応）
 */
export const retryGraphQLOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  enableBatch: boolean = false
): Promise<T> => {
  const operationId = `graphql_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (enableBatch) {
    return performanceManager.addToBatch(operationId, async () => {
      return await executeWithRetry(operation, maxRetries, delay);
    });
  }
  
  return await executeWithRetry(operation, maxRetries, delay);
};

/**
 * リトライロジックの実行
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  delay: number
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        console.warn(`⚠️ Slow GraphQL operation: ${duration}ms`);
      }
      
      return result;
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
}

/**
 * キャッシュ付きGraphQL操作
 */
export const cachedGraphQLOperation = async <T>(
  cacheKey: string,
  operation: () => Promise<T>,
  ttl: number = 5 * 60 * 1000
): Promise<T> => {
  const cached = performanceManager.getFromCache<T>(cacheKey);
  if (cached) {
    console.log(`📋 Cache hit: ${cacheKey}`);
    return cached;
  }
  
  const result = await operation();
  performanceManager.setCache(cacheKey, result, ttl);
  console.log(`💾 Cached: ${cacheKey}`);
  
  return result;
};

/**
 * バッチGraphQL操作（複数の操作を効率的に実行）
 */
export const batchGraphQLOperations = async <T>(
  operations: Array<{ id: string; operation: () => Promise<T> }>
): Promise<Array<{ id: string; result?: T; error?: any }>> => {
  console.log(`🚀 Batching ${operations.length} operations`);
  
  const results = await Promise.allSettled(
    operations.map(async ({ id, operation }) => {
      try {
        const result = await operation();
        return { id, result };
      } catch (error) {
        return { id, error };
      }
    })
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return { id: operations[index].id, error: result.reason };
    }
  });
};

/**
 * パフォーマンス統計の取得
 */
export const getPerformanceStats = () => {
  return {
    cache: performanceManager.getCacheStats(),
    timestamp: new Date().toISOString()
  };
};

/**
 * キャッシュのクリア
 */
export const clearPerformanceCache = (pattern?: string) => {
  performanceManager.clearCache(pattern);
  console.log(`🧹 Performance cache cleared${pattern ? ` (pattern: ${pattern})` : ''}`);
};
/**
 * 統一エラーハンドリング
 * MVP システム設計書準拠のエラー処理
 */

export class AmplifyError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AmplifyError';
  }
}

/**
 * GraphQLサービスエラーの統一ハンドリング
 */
export const handleServiceError = (error: any, operation: string): never => {
  console.error(`❌ ${operation} failed:`, error);
  
  if (error.errors && error.errors.length > 0) {
    throw new AmplifyError(error.errors[0].message, error.errors[0].errorType);
  }
  
  if (error.message) {
    throw new AmplifyError(error.message);
  }
  
  throw new AmplifyError(`${operation} failed`, 'UNKNOWN_ERROR', error);
};

/**
 * 認証エラーの統一ハンドリング
 */
export const handleAuthError = (error: any, operation: string): never => {
  console.error(`🔐 ${operation} authentication failed:`, error);
  
  if (error.code === 'NotAuthorizedException') {
    throw new AmplifyError('認証が必要です', 'NOT_AUTHORIZED', error);
  }
  
  if (error.code === 'UserNotConfirmedException') {
    throw new AmplifyError('ユーザーの確認が必要です', 'USER_NOT_CONFIRMED', error);
  }
  
  throw new AmplifyError(`${operation} failed`, 'AUTH_ERROR', error);
};

/**
 * バリデーションエラーの統一ハンドリング
 */
export const handleValidationError = (field: string, message: string): never => {
  throw new AmplifyError(`${field}: ${message}`, 'VALIDATION_ERROR');
};

/**
 * 操作結果の統一フォーマット
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: AmplifyError;
}

/**
 * 安全な操作実行（エラーキャッチ付き）
 */
export const safeExecute = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<ServiceResult<T>> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error(`🔥 ${operationName} failed:`, error);
    
    if (error instanceof AmplifyError) {
      return { success: false, error };
    }
    
    const amplifyError = new AmplifyError(
      `${operationName} failed`,
      'UNKNOWN_ERROR',
      error
    );
    
    return { success: false, error: amplifyError };
  }
};

/**
 * リトライ可能な操作実行
 */
export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`⚠️ ${operationName} attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        handleServiceError(error, operationName);
      }
      
      // 指数バックオフでリトライ
      await new Promise(resolve => 
        setTimeout(resolve, delay * Math.pow(2, attempt - 1))
      );
    }
  }
  
  throw new AmplifyError(`${operationName} max retries exceeded`);
};
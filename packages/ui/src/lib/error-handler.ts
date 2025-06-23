/**
 * エラーハンドリングユーティリティ
 */

export interface AppError {
  message: string;
  userMessage?: string;
  code?: string;
  context?: unknown;
}

/**
 * AWS Amplify認証エラーをハンドリング
 */
export function handleAuthError(error: unknown, context?: unknown): AppError {
  console.error('Auth Error:', error, context);

  let userMessage = '';
  let code = '';

  if (typeof error === 'string') {
    userMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: string }).message;
    
    // AWS Amplifyの一般的なエラーメッセージを日本語に変換
    if (message.includes('User does not exist')) {
      userMessage = 'ユーザーが存在しません';
      code = 'USER_NOT_FOUND';
    } else if (message.includes('Incorrect username or password')) {
      userMessage = 'メールアドレスまたはパスワードが正しくありません';
      code = 'INVALID_CREDENTIALS';
    } else if (message.includes('User is not confirmed')) {
      userMessage = 'メールアドレスの確認が必要です';
      code = 'USER_NOT_CONFIRMED';
    } else if (message.includes('Password attempts exceeded')) {
      userMessage = 'パスワードの試行回数が上限に達しました。しばらく後に再試行してください';
      code = 'PASSWORD_ATTEMPTS_EXCEEDED';
    } else if (message.includes('Network Error') || message.includes('NetworkError')) {
      userMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください';
      code = 'NETWORK_ERROR';
    } else if (message.includes('Username cannot be empty')) {
      userMessage = 'メールアドレスを入力してください';
      code = 'EMPTY_USERNAME';
    } else if (message.includes('Password cannot be empty')) {
      userMessage = 'パスワードを入力してください';
      code = 'EMPTY_PASSWORD';
    } else if (message.includes('Auth UserPool not configured')) {
      userMessage = 'AWS認証設定が正しく構成されていません。管理者にお問い合わせください';
      code = 'AUTH_NOT_CONFIGURED';
    } else {
      userMessage = message;
    }
  } else {
    userMessage = 'ログインに失敗しました';
  }

  return {
    message: (error as Error)?.message || String(error) || 'Unknown error',
    userMessage,
    code,
    context,
  };
}

/**
 * 一般的なAPIエラーをハンドリング
 */
export function handleApiError(error: unknown, context?: unknown): AppError {
  console.error('API Error:', error, context);

  let userMessage = '';
  let code = '';

  if (error && typeof error === 'object' && 'response' in error) {
    // HTTPレスポンスエラー
    const response = (error as { response: { status: number; data?: { message?: string } } }).response;
    const status = response.status;
    const data = response.data;

    switch (status) {
      case 400:
        userMessage = data?.message || 'リクエストが正しくありません';
        code = 'BAD_REQUEST';
        break;
      case 401:
        userMessage = '認証が必要です';
        code = 'UNAUTHORIZED';
        break;
      case 403:
        userMessage = 'アクセス権限がありません';
        code = 'FORBIDDEN';
        break;
      case 404:
        userMessage = '要求されたリソースが見つかりません';
        code = 'NOT_FOUND';
        break;
      case 500:
        userMessage = 'サーバーエラーが発生しました';
        code = 'INTERNAL_SERVER_ERROR';
        break;
      default:
        userMessage = `エラーが発生しました (${status})`;
        code = 'HTTP_ERROR';
    }
  } else if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'NETWORK_ERROR') {
    userMessage = 'ネットワークエラーが発生しました';
    code = 'NETWORK_ERROR';
  } else {
    userMessage = (error as Error)?.message || 'エラーが発生しました';
  }

  return {
    message: (error as Error)?.message || String(error) || 'Unknown error',
    userMessage,
    code,
    context,
  };
}
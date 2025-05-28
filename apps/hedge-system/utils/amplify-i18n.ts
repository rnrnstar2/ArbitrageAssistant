import { I18n } from 'aws-amplify/utils';
import { translations } from '@aws-amplify/ui-react';

// AWS Amplifyの標準翻訳を適用
I18n.putVocabularies(translations);
I18n.setLanguage('ja');

// カスタム日本語翻訳辞書
const customVocabularies = {
  ja: {
    // 認証関連の基本用語
    'Sign In': 'ログイン',
    'Sign Up': '新規登録',
    'Sign Out': 'ログアウト',
    'Password': 'パスワード',
    'Email': 'メールアドレス',
    'Confirm': '確認',
    'Confirmation Code': '確認コード',
    'Resend Code': 'コードを再送信',
    'Back to Sign In': 'ログインに戻る',
    
    // エラーメッセージのカスタムマッピング
    'User does not exist.': 'ユーザーが見つかりません',
    'Incorrect username or password.': 'メールアドレスまたはパスワードが正しくありません',
    'User is not confirmed.': 'アカウントが確認されていません。確認コードを入力してください',
    'Password did not conform with policy': 'パスワードは8文字以上で、大文字・小文字・数字・記号を含む必要があります',
    'Invalid verification code provided, please try again.': '確認コードが正しくありません',
    'User already exists': 'このメールアドレスは既に登録されています',
    'Invalid password format': 'パスワードが要件を満たしていません',
    'Network error': 'ネットワークエラーが発生しました。インターネット接続を確認してください',
    'An account with the given email already exists.': 'このメールアドレスは既に登録されています',
    'Username cannot be empty': 'メールアドレスを入力してください',
    'Password cannot be empty': 'パスワードを入力してください',
    'Confirmation code cannot be empty': '確認コードを入力してください',
    'Password must have uppercase characters': 'パスワードには大文字を含める必要があります',
    'Password must have lowercase characters': 'パスワードには小文字を含める必要があります',
    'Password must have numeric characters': 'パスワードには数字を含める必要があります',
    'Password must have symbol characters': 'パスワードには記号を含める必要があります',
  }
};

// カスタム翻訳を追加
I18n.putVocabularies(customVocabularies);

// エラーコードと日本語メッセージのマッピング（Amplify/Cognitoのエラーコード用）
export const authErrorMessages: Record<string, string> = {
  // サインイン関連
  'UserNotFoundException': 'ユーザーが見つかりません',
  'NotAuthorizedException': 'メールアドレスまたはパスワードが正しくありません',
  'UserNotConfirmedException': 'アカウントが確認されていません。確認コードを入力してください',
  'PasswordResetRequiredException': 'パスワードのリセットが必要です',
  'TooManyRequestsException': 'リクエストが多すぎます。しばらく待ってから再試行してください',
  'TooManyFailedAttemptsException': 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください',
  
  // サインアップ関連
  'UsernameExistsException': 'このメールアドレスは既に登録されています',
  'InvalidPasswordException': 'パスワードが要件を満たしていません',
  'InvalidParameterException': '入力内容に誤りがあります',
  
  // 確認コード関連
  'CodeMismatchException': '確認コードが正しくありません',
  'ExpiredCodeException': '確認コードの有効期限が切れています。新しいコードを再送信してください',
  'LimitExceededException': '確認コードの送信回数が上限に達しました',
  'ResourceNotFoundException': 'リソースが見つかりません',
  
  // ネットワーク関連
  'NetworkError': 'ネットワークエラーが発生しました。インターネット接続を確認してください',
};

/**
 * Amplify認証エラーを日本語に変換する
 * @param error - Amplifyから返されるエラーオブジェクト
 * @returns 日本語のエラーメッセージ
 */
export function translateAuthError(error: any): string {
  // エラーコードをチェック
  const errorCode = error?.name || error?.code || '';
  if (authErrorMessages[errorCode]) {
    return authErrorMessages[errorCode];
  }
  
  // I18nで翻訳を試みる
  const message = error?.message || '';
  const translatedMessage = I18n.get(message);
  
  // 翻訳が見つかった場合は翻訳を返す
  if (translatedMessage !== message) {
    return translatedMessage;
  }
  
  // メッセージ内の特定のパターンを検索（フォールバック）
  if (message.includes('Password did not conform with policy')) {
    return 'パスワードは8文字以上で、大文字・小文字・数字・記号を含む必要があります';
  }
  if (message.includes('Invalid verification code')) {
    return '確認コードが正しくありません';
  }
  if (message.includes('User already exists')) {
    return 'このメールアドレスは既に登録されています';
  }
  if (message.includes('Incorrect username or password')) {
    return 'メールアドレスまたはパスワードが正しくありません';
  }
  if (message.includes('User is not confirmed')) {
    return 'アカウントが確認されていません';
  }
  if (message.includes('Network Error') || message.includes('Failed to fetch')) {
    return 'ネットワークエラーが発生しました。インターネット接続を確認してください';
  }
  
  // デフォルトメッセージ
  return message || 'エラーが発生しました';
}

/**
 * 汎用的なテキスト翻訳関数
 * @param text - 翻訳するテキスト
 * @returns 翻訳されたテキスト
 */
export function translate(text: string): string {
  return I18n.get(text);
}
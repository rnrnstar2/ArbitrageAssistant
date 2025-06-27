import { authService, type SignUpData, type SignInData } from './auth-service';

export interface SignUpResult {
  success: boolean;
  requiresConfirmation: boolean;
  message: string;
  details?: any;
}

export interface SignInResult {
  success: boolean;
  user?: any;
  message: string;
  requiresMFA?: boolean;
  requiresNewPassword?: boolean;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
}

export interface AuthFormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * 認証フロー強化ユーティリティクラス
 * サインアップ・サインイン・パスワード管理の最適化されたフローを提供
 */
export class AuthFlows {
  private static instance: AuthFlows;

  private constructor() {}

  public static getInstance(): AuthFlows {
    if (!AuthFlows.instance) {
      AuthFlows.instance = new AuthFlows();
    }
    return AuthFlows.instance;
  }

  /**
   * メールアドレスの形式を検証
   */
  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * パスワードの強度を検証
   */
  public validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('パスワードは8文字以上である必要があります');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('パスワードには大文字を含む必要があります');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('パスワードには小文字を含む必要があります');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('パスワードには数字を含む必要があります');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('パスワードには特殊文字を含む必要があります');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * サインアップフォームを検証
   */
  public validateSignUpForm(data: SignUpData): AuthFormValidation {
    const errors: Record<string, string> = {};

    // メールアドレス検証
    if (!data.email) {
      errors.email = 'メールアドレスは必須です';
    } else if (!this.validateEmail(data.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    // 名前検証
    if (!data.fullname || data.fullname.trim().length === 0) {
      errors.fullname = '氏名は必須です';
    } else if (data.fullname.length < 2) {
      errors.fullname = '氏名は2文字以上で入力してください';
    }

    // パスワード検証
    if (!data.password) {
      errors.password = 'パスワードは必須です';
    } else {
      const passwordValidation = this.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors.join('、');
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * サインインフォームを検証
   */
  public validateSignInForm(data: SignInData): AuthFormValidation {
    const errors: Record<string, string> = {};

    if (!data.email) {
      errors.email = 'メールアドレスは必須です';
    } else if (!this.validateEmail(data.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    if (!data.password) {
      errors.password = 'パスワードは必須です';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 強化されたサインアップフロー
   */
  public async enhancedSignUp(data: SignUpData): Promise<SignUpResult> {
    try {
      // フォーム検証
      const validation = this.validateSignUpForm(data);
      if (!validation.isValid) {
        return {
          success: false,
          requiresConfirmation: false,
          message: 'フォームに不正な入力があります',
          details: validation.errors,
        };
      }

      // サインアップ実行
      const result = await authService.signUp(data);

      if (result.isSignUpComplete) {
        return {
          success: true,
          requiresConfirmation: false,
          message: 'アカウントが正常に作成されました',
          details: result,
        };
      } else {
        return {
          success: true,
          requiresConfirmation: true,
          message: 'メールアドレスに送信された確認コードを入力してください',
          details: result,
        };
      }
    } catch (error: any) {
      console.error('Enhanced sign up failed:', error);
      
      // エラーメッセージの最適化
      let message = 'アカウント作成に失敗しました';
      
      if (error.name === 'UsernameExistsException') {
        message = 'このメールアドレスは既に使用されています';
      } else if (error.name === 'InvalidPasswordException') {
        message = 'パスワードが要件を満たしていません';
      } else if (error.name === 'InvalidParameterException') {
        message = '入力内容に問題があります';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        requiresConfirmation: false,
        message,
        details: error,
      };
    }
  }

  /**
   * 強化されたサインイン フロー
   */
  public async enhancedSignIn(data: SignInData): Promise<SignInResult> {
    try {
      // フォーム検証
      const validation = this.validateSignInForm(data);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'フォームに不正な入力があります',
        };
      }

      // サインイン実行
      const authState = await authService.signIn(data);

      if (authState.isAuthenticated) {
        return {
          success: true,
          user: authState.user,
          message: 'ログインが成功しました',
        };
      } else {
        return {
          success: false,
          message: 'ログインに失敗しました',
        };
      }
    } catch (error: any) {
      console.error('Enhanced sign in failed:', error);
      
      // エラーメッセージの最適化
      let message = 'ログインに失敗しました';
      
      if (error.name === 'NotAuthorizedException') {
        message = 'メールアドレスまたはパスワードが間違っています';
      } else if (error.name === 'UserNotConfirmedException') {
        message = 'アカウントの確認が完了していません。メールを確認してください';
      } else if (error.name === 'UserNotFoundException') {
        message = 'このメールアドレスは登録されていません';
      } else if (error.name === 'TooManyRequestsException') {
        message = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        message,
        requiresMFA: error.name === 'ChallengeName' && error.challengeName === 'SMS_MFA',
        requiresNewPassword: error.name === 'ChallengeName' && error.challengeName === 'NEW_PASSWORD_REQUIRED',
      };
    }
  }

  /**
   * 確認コード検証（サインアップ確認）
   */
  public async confirmSignUp(email: string, confirmationCode: string): Promise<SignUpResult> {
    try {
      if (!email || !confirmationCode) {
        return {
          success: false,
          requiresConfirmation: false,
          message: 'メールアドレスと確認コードは必須です',
        };
      }

      await authService.confirmSignUp(email, confirmationCode);

      return {
        success: true,
        requiresConfirmation: false,
        message: 'アカウントの確認が完了しました。ログインできます',
      };
    } catch (error: any) {
      console.error('Confirm sign up failed:', error);
      
      let message = '確認に失敗しました';
      
      if (error.name === 'CodeMismatchException') {
        message = '確認コードが間違っています';
      } else if (error.name === 'ExpiredCodeException') {
        message = '確認コードの有効期限が切れています';
      } else if (error.name === 'LimitExceededException') {
        message = '確認試行回数が多すぎます。しばらく待ってから再試行してください';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        requiresConfirmation: true,
        message,
        details: error,
      };
    }
  }

  /**
   * 強化されたパスワードリセットフロー
   */
  public async enhancedPasswordReset(email: string): Promise<PasswordResetResult> {
    try {
      if (!email) {
        return {
          success: false,
          message: 'メールアドレスは必須です',
        };
      }

      if (!this.validateEmail(email)) {
        return {
          success: false,
          message: '有効なメールアドレスを入力してください',
        };
      }

      await authService.resetPassword(email);

      return {
        success: true,
        message: 'パスワードリセット用のメールを送信しました',
      };
    } catch (error: any) {
      console.error('Enhanced password reset failed:', error);
      
      let message = 'パスワードリセットに失敗しました';
      
      if (error.name === 'UserNotFoundException') {
        message = 'このメールアドレスは登録されていません';
      } else if (error.name === 'LimitExceededException') {
        message = 'パスワードリセット試行回数が多すぎます。しばらく待ってから再試行してください';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        message,
      };
    }
  }

  /**
   * パスワードリセット確認
   */
  public async confirmPasswordReset(
    email: string,
    confirmationCode: string,
    newPassword: string
  ): Promise<PasswordResetResult> {
    try {
      if (!email || !confirmationCode || !newPassword) {
        return {
          success: false,
          message: 'すべての項目を入力してください',
        };
      }

      // 新しいパスワードの検証
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors.join('、'),
        };
      }

      await authService.confirmResetPassword(email, confirmationCode, newPassword);

      return {
        success: true,
        message: 'パスワードが正常に変更されました',
      };
    } catch (error: any) {
      console.error('Confirm password reset failed:', error);
      
      let message = 'パスワード変更に失敗しました';
      
      if (error.name === 'CodeMismatchException') {
        message = '確認コードが間違っています';
      } else if (error.name === 'ExpiredCodeException') {
        message = '確認コードの有効期限が切れています';
      } else if (error.name === 'InvalidPasswordException') {
        message = 'パスワードが要件を満たしていません';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        message,
      };
    }
  }

  /**
   * セッション確認（ページ読み込み時など）
   */
  public async checkAuthSession(): Promise<{
    isAuthenticated: boolean;
    user: any;
    message: string;
  }> {
    try {
      const authState = await authService.checkAuthState();

      return {
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        message: authState.isAuthenticated ? 'ユーザーは認証済みです' : 'ユーザーは未認証です',
      };
    } catch (error) {
      console.error('Check auth session failed:', error);
      
      return {
        isAuthenticated: false,
        user: null,
        message: '認証状態の確認に失敗しました',
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const authFlows = AuthFlows.getInstance();
'use client';

import { useState, useCallback } from 'react';
import {
  useForm,
  UseFormProps,
  UseFormReturn,
  FieldValues,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';

// オプション設定の型定義
interface SmartFormOptions<TFormData extends FieldValues> {
  // バリデーションスキーマ（zodスキーマまたはカスタム関数）
  validationSchema?:
    | ZodSchema<TFormData>
    | ((data: TFormData) => string | null);

  // 成功時の処理
  onSuccess?: (data: TFormData, result?: any) => void;

  // エラー時の処理（カスタムエラーハンドリング）
  onError?: (error: any) => void;

  // 送信後の処理
  onFinally?: () => void;

  // フォームリセット設定
  resetOnSuccess?: boolean;

  // ローディング状態のカスタマイズ
  loadingDelay?: number; // ローディング表示の遅延時間（ms）

  // react-hook-formの追加オプション
  formOptions?: UseFormProps<TFormData>;
}

// 戻り値の型定義
interface SmartFormReturn<TFormData extends FieldValues> {
  // フォーム状態
  isLoading: boolean;
  isSubmitting: boolean; // 実際の送信中状態
  error: string | null;
  isSuccess: boolean;

  // react-hook-formの機能
  form: UseFormReturn<TFormData>;

  // 送信ハンドラー
  handleSubmit: (
    submitFn: (data: TFormData) => Promise<any>
  ) => (data: TFormData) => Promise<void>;

  // 手動状態管理
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  markSuccess: () => void;
}

/**
 * 統一されたフォーム状態管理とバリデーションを提供するカスタムフック
 *
 * @example
 * ```tsx
 * const loginForm = useSmartForm({
 *   validationSchema: loginSchema,
 * });
 *
 * const onSubmit = loginForm.handleSubmit(async (data) => {
 *   return await signIn(data.email, data.password);
 * });
 * ```
 */
export function useSmartForm<TFormData extends FieldValues = any>(
  options: SmartFormOptions<TFormData> = {}
): SmartFormReturn<TFormData> {

  // フォーム状態
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // react-hook-formの設定
  const formConfig: UseFormProps<TFormData> = {
    mode: 'onChange', // フォーム入力時にリアルタイムでバリデーション
    ...options.formOptions,
  };

  // zodスキーマがある場合はresolverを設定
  if (
    options.validationSchema &&
    typeof options.validationSchema === 'object' &&
    'parse' in options.validationSchema
  ) {
    formConfig.resolver = zodResolver(
      options.validationSchema as ZodSchema<TFormData>
    );
  }

  const form = useForm<TFormData>(formConfig);

  // エラーをクリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 成功状態をマーク
  const markSuccess = useCallback(() => {
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000); // 3秒後に自動クリア
  }, []);

  // 送信ハンドラーを生成
  const handleSubmit = useCallback(
    (submitFn: (data: TFormData) => Promise<any>) =>
      async (data: TFormData) => {
        // ローディング開始・エラークリア
        setError(null);
        setIsSuccess(false);

        // 遅延ローディングの設定
        const loadingDelay = options.loadingDelay || 200; // デフォルト200ms
        const loadingTimer = setTimeout(() => {
          setIsLoading(true);
        }, loadingDelay);

        setIsSubmitting(true);

        try {
          // カスタムバリデーション（関数型の場合）
          if (
            options.validationSchema &&
            typeof options.validationSchema === 'function'
          ) {
            const validationError = options.validationSchema(data);
            if (validationError) {
              setError(validationError);
              return;
            }
          }

          // API呼び出し実行
          const result = await submitFn(data);

          // 成功処理
          markSuccess();

          // フォームリセット
          if (options.resetOnSuccess) {
            form.reset();
          }

          // 成功時のコールバック
          if (options.onSuccess) {
            options.onSuccess(data, result);
          }
        } catch (err: any) {
          // エラー処理
          const errorMessage = err?.message || '処理中にエラーが発生しました';
          setError(errorMessage);

          // エラー時のコールバック
          if (options.onError) {
            options.onError(err);
          }

          // 開発環境でのデバッグ情報
          if (process.env.NODE_ENV === 'development') {
            console.error('Smart Form Error:', {
              error: err,
              data,
              timestamp: new Date().toISOString(),
            });
          }
        } finally {
          clearTimeout(loadingTimer);
          setIsLoading(false);
          setIsSubmitting(false);

          // 完了時のコールバック
          if (options.onFinally) {
            options.onFinally();
          }
        }
      },
    [options, form, markSuccess]
  );

  return {
    // 状態
    isLoading,
    isSubmitting,
    error,
    isSuccess,

    // フォーム
    form,

    // ハンドラー
    handleSubmit,

    // 手動制御
    setError,
    setLoading: setIsLoading,
    clearError,
    markSuccess,
  };
}

// 便利なヘルパー関数もエクスポート
export const createSmartFormSchema = <T extends FieldValues>(
  schema: ZodSchema<T>
) => schema;

// よく使われるバリデーションパターン
export const commonValidations = {
  required: (fieldName: string) => `${fieldName}は必須です`,
  email: 'メールアドレスの形式が正しくありません',
  minLength: (min: number) => `${min}文字以上で入力してください`,
  maxLength: (max: number) => `${max}文字以下で入力してください`,
  passwordMatch: 'パスワードが一致しません',
  positiveNumber: '正の数値を入力してください',
};
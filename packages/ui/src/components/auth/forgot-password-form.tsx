"use client";

import { useState } from "react";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useSmartForm } from "../../hooks/use-smart-form";
import { handleAuthError } from "../../lib/error-handler";
import { Loader2, CheckCircle, KeyRound, Mail } from "lucide-react";
import * as z from "zod";

// パスワードリセット要求用スキーマ
const requestResetSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
});

// パスワードリセット確認用スキーマ
const confirmResetSchema = z
  .object({
    code: z.string().min(6, '確認コードは6桁です').max(6, '確認コードは6桁です'),
    newPassword: z
      .string()
      .min(8, '8文字以上で入力してください')
      .regex(/[a-z]/, '小文字を含める必要があります')
      .regex(/\d/, '数字を含める必要があります'),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

type RequestResetFormValues = z.infer<typeof requestResetSchema>;
type ConfirmResetFormValues = z.infer<typeof confirmResetSchema>;

interface ForgotPasswordFormProps {
  onSignIn: () => void;
  className?: string;
  cardClassName?: string;
}

export function ForgotPasswordForm({ onSignIn, className, cardClassName }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');

  // リセット要求用フォーム
  const requestForm = useSmartForm<RequestResetFormValues>({
    validationSchema: requestResetSchema,
    onError: error => {
      const appError = handleAuthError(error, { component: 'ForgotPasswordForm', step: 'request' });
      requestForm.setError(appError.userMessage || appError.message);
    },
    onSuccess: (data) => {
      setEmail(data.email);
      setStep('confirm');
    },
  });

  // リセット確認用フォーム
  const confirmForm = useSmartForm<ConfirmResetFormValues>({
    validationSchema: confirmResetSchema,
    onError: error => {
      const appError = handleAuthError(error, { component: 'ForgotPasswordForm', step: 'confirm' });
      confirmForm.setError(appError.userMessage || appError.message);
    },
    onSuccess: () => {
      onSignIn();
    },
  });

  // パスワード要件チェック用のヘルパー関数
  const getPasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasSymbols: /[^A-Za-z0-9]/.test(password),
    };
  };

  const handleRequestReset = requestForm.handleSubmit(
    async (values: RequestResetFormValues) => {
      return await resetPassword({
        username: values.email,
      });
    }
  );

  const handleConfirmReset = confirmForm.handleSubmit(
    async (values: ConfirmResetFormValues) => {
      return await confirmResetPassword({
        username: email,
        confirmationCode: values.code,
        newPassword: values.newPassword,
      });
    }
  );

  if (step === 'confirm') {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4 ${className || ''}`}>
        <Card className={`w-full max-w-md ${cardClassName || ''}`}>
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <KeyRound className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                新しいパスワードを設定
              </CardTitle>
              <CardDescription className="text-gray-600 px-2">
                <strong className="text-purple-600">{email}</strong> に送信されたコードと新しいパスワードを入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={confirmForm.form.handleSubmit(handleConfirmReset)}
                className="space-y-4"
              >
                {/* エラー表示 */}
                {confirmForm.error && (
                  <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg whitespace-pre-line">
                    {confirmForm.error}
                  </div>
                )}

                {/* 成功表示 */}
                {confirmForm.isSuccess && (
                  <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    パスワードがリセットされました。新しいパスワードでログインしてください。
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="confirmationCode" className="text-gray-700 font-medium">
                    確認コード
                  </Label>
                  <Input
                    id="confirmationCode"
                    placeholder="6桁の確認コード"
                    maxLength={6}
                    className="h-11 bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500 text-center text-lg tracking-widest selection:bg-blue-500 selection:text-white"
                    {...confirmForm.form.register('code')}
                  />
                  {confirmForm.form.formState.errors.code && (
                    <p className="text-sm text-red-600">
                      {confirmForm.form.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-gray-700 font-medium">
                    新しいパスワード
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500 selection:bg-blue-500 selection:text-white"
                    {...confirmForm.form.register('newPassword')}
                  />
                  {confirmForm.form.formState.errors.newPassword && (
                    <p className="text-sm text-red-600">
                      {confirmForm.form.formState.errors.newPassword.message}
                    </p>
                  )}

                  {/* パスワード要件表示 */}
                  {confirmForm.form.watch('newPassword') && (
                    <div className="text-xs space-y-1 mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="text-gray-600 mb-2 font-medium">
                        パスワード要件:
                      </div>
                      {(() => {
                        const password = confirmForm.form.watch('newPassword');
                        const requirements = getPasswordRequirements(password);
                        return (
                          <>
                            <div
                              className={`flex items-center gap-2 ${requirements.minLength ? 'text-green-600' : 'text-red-600'}`}
                            >
                              <span className="text-sm">{requirements.minLength ? '✓' : '✗'}</span>
                              <span>
                                8文字以上 <span className='text-red-500'>*</span>
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-2 ${requirements.hasLowercase ? 'text-green-600' : 'text-red-600'}`}
                            >
                              <span className="text-sm">{requirements.hasLowercase ? '✓' : '✗'}</span>
                              <span>
                                小文字を含む <span className='text-red-500'>*</span>
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-2 ${requirements.hasNumbers ? 'text-green-600' : 'text-red-600'}`}
                            >
                              <span className="text-sm">{requirements.hasNumbers ? '✓' : '✗'}</span>
                              <span>
                                数字を含む <span className='text-red-500'>*</span>
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-2 ${requirements.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}
                            >
                              <span className="text-sm">{requirements.hasUppercase ? '✓' : '○'}</span>
                              <span className='text-gray-600'>
                                大文字を含む（推奨）
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-2 ${requirements.hasSymbols ? 'text-green-600' : 'text-gray-400'}`}
                            >
                              <span className="text-sm">{requirements.hasSymbols ? '✓' : '○'}</span>
                              <span className='text-gray-600'>
                                記号を含む（推奨）
                              </span>
                            </div>
                            <div className='text-xs text-gray-500 mt-2'>
                              <span className='text-red-500'>*</span> 必須項目
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                    パスワード（確認）
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500 selection:bg-blue-500 selection:text-white"
                    {...confirmForm.form.register('confirmPassword')}
                  />
                  {confirmForm.form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">
                      {confirmForm.form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium"
                  disabled={confirmForm.isSubmitting}
                >
                  {confirmForm.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      設定中...
                    </>
                  ) : (
                    'パスワードを設定'
                  )}
                </Button>
              </form>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={onSignIn} 
                  className="text-purple-600 hover:text-purple-700"
                >
                  ログインに戻る
                </Button>
              </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-red-50 p-4 ${className || ''}`}>
      <Card className={`w-full max-w-md ${cardClassName || ''}`}>
          <CardHeader className="text-center pb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <Mail className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              パスワードリセット
            </CardTitle>
            <CardDescription className="text-gray-600">
              登録されたメールアドレスにリセットコードを送信します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={requestForm.form.handleSubmit(handleRequestReset)}
              className="space-y-4"
            >
              {/* エラー表示 */}
              {requestForm.error && (
                <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg whitespace-pre-line">
                  {requestForm.error}
                </div>
              )}

              {/* 成功表示 */}
              {requestForm.isSuccess && (
                <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  リセットコードをメールに送信しました。
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  className="h-11 bg-white border-gray-200 focus:border-orange-500 focus:ring-orange-500 selection:bg-blue-500 selection:text-white"
                  {...requestForm.form.register('email')}
                />
                {requestForm.form.formState.errors.email && (
                  <p className="text-sm text-red-600">
                    {requestForm.form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                disabled={requestForm.isSubmitting}
              >
                {requestForm.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  'リセットコードを送信'
                )}
              </Button>
            </form>
            
            <div className="text-center">
              <Button 
                variant="link" 
                onClick={onSignIn} 
                className="text-orange-600 hover:text-orange-700"
              >
                ログインに戻る
              </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useSmartForm } from "../../hooks/use-smart-form";
import { handleAuthError } from "../../lib/error-handler";
import { Loader2, CheckCircle, UserPlus } from "lucide-react";
import { signUp } from "aws-amplify/auth";
import * as z from "zod";

// バリデーションスキーマ
const signUpSchema = z
  .object({
    name: z.string().min(1, 'お名前は必須です'),
    email: z.string().email('メールアドレスの形式が正しくありません'),
    password: z
      .string()
      .min(8, '8文字以上で入力してください')
      .regex(/[a-z]/, '小文字を含める必要があります')
      .regex(/\d/, '数字を含める必要があります'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  title?: string;
  description?: string;
  onSignIn: () => void;
  onConfirmSignUp: (email: string) => void;
  className?: string;
  cardClassName?: string;
}

export function SignUpForm({ 
  title = "アカウント作成",
  description = "新しいアカウントを作成してください",
  onSignIn, 
  onConfirmSignUp,
  className,
  cardClassName
}: SignUpFormProps) {
  // useSmartFormを使用
  const smartForm = useSmartForm<SignUpFormValues>({
    validationSchema: signUpSchema,
    onError: error => {
      const appError = handleAuthError(error, { component: 'SignUpForm' });
      smartForm.setError(appError.userMessage || appError.message);
    },
    onSuccess: data => {
      onConfirmSignUp(data.email);
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

  const handleSignUp = smartForm.handleSubmit(
    async (values: SignUpFormValues) => {
      const attributes: Record<string, string> = {
        email: values.email,
        name: values.name,
      };

      const result = await signUp({
        username: values.email,
        password: values.password,
        options: {
          userAttributes: attributes,
        },
      });

      return result;
    }
  );

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4 ${className || ''}`}>
      <Card className={`w-full max-w-md mx-auto ${cardClassName || ''}`}>
          <CardHeader className="text-center pb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <UserPlus className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {title}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={smartForm.form.handleSubmit(handleSignUp)}
              className="space-y-4"
            >
              {/* エラー表示 */}
              {smartForm.error && (
                <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg whitespace-pre-line">
                  {smartForm.error}
                </div>
              )}

              {/* 成功表示 */}
              {smartForm.isSuccess && (
                <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  アカウントを作成しました。確認コードをメールに送信しました。
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 font-medium">
                  お名前
                </Label>
                <Input
                  id="name"
                  placeholder="管理者 太郎"
                  className="h-11 bg-white border-gray-200 focus:border-green-500 focus:ring-green-500"
                  {...smartForm.form.register('name')}
                />
                {smartForm.form.formState.errors.name && (
                  <p className="text-sm text-red-600">
                    {smartForm.form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  className="h-11 bg-white border-gray-200 focus:border-green-500 focus:ring-green-500"
                  {...smartForm.form.register('email')}
                />
                {smartForm.form.formState.errors.email && (
                  <p className="text-sm text-red-600">
                    {smartForm.form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-11 bg-white border-gray-200 focus:border-green-500 focus:ring-green-500"
                  {...smartForm.form.register('password')}
                />
                {smartForm.form.formState.errors.password && (
                  <p className="text-sm text-red-600">
                    {smartForm.form.formState.errors.password.message}
                  </p>
                )}

                {/* パスワード要件表示 */}
                {smartForm.form.watch('password') && (
                  <div className="text-xs space-y-1 mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-600 mb-2 font-medium">
                      パスワード要件:
                    </div>
                    {(() => {
                      const password = smartForm.form.watch('password');
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
                  className="h-11 bg-white border-gray-200 focus:border-green-500 focus:ring-green-500"
                  {...smartForm.form.register('confirmPassword')}
                />
                {smartForm.form.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-600">
                    {smartForm.form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium"
                disabled={smartForm.isSubmitting}
              >
                {smartForm.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    作成中...
                  </>
                ) : (
                  'アカウント作成'
                )}
              </Button>
            </form>
            
            <div className="text-center">
              <div className="text-sm text-gray-600">
                すでにアカウントをお持ちの方は{" "}
                <Button variant="link" onClick={onSignIn} className="p-0 h-auto text-green-600 hover:text-green-700">
                  こちらからログイン
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
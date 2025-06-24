"use client";

// import { useAuth } from "./auth-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useSmartForm } from "../../hooks/use-smart-form";
import { handleAuthError } from "../../lib/error-handler";
import { Loader2, CheckCircle, LogIn } from "lucide-react";
import * as z from "zod";

// バリデーションスキーマ
const signInSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

type SignInFormValues = z.infer<typeof signInSchema>;

interface LoginFormProps {
  title?: string;
  description?: string;
  emailPlaceholder?: string;
  submitButtonText?: string;
  onSignUp?: () => void;
  onForgotPassword?: () => void;
  className?: string;
  cardClassName?: string;
  signIn?: (email: string, password: string) => Promise<unknown>;
  isLoading?: boolean;
}

export function LoginForm({ 
  title = "ログイン",
  description = "アカウントにログインしてください",
  emailPlaceholder = "email@example.com",
  submitButtonText = "ログイン",
  onSignUp, 
  onForgotPassword,
  className,
  cardClassName,
  signIn,
  isLoading: authLoading = false
}: LoginFormProps) {

  // useSmartFormを使用
  const smartForm = useSmartForm<SignInFormValues>({
    validationSchema: signInSchema,
    onError: error => {
      const appError = handleAuthError(error, { component: 'LoginForm' });
      smartForm.setError(appError.userMessage || appError.message);
    },
  });

  const handleSignIn = smartForm.handleSubmit(
    async (values: SignInFormValues) => {
      if (!signIn) {
        throw new Error('signIn function not provided');
      }
      return await signIn(values.email, values.password);
    }
  );

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 ${className || ''}`}>
      <Card className={`w-full max-w-md mx-auto ${cardClassName || ''}`}>
          <CardHeader className="text-center pb-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <LogIn className="w-6 h-6 text-blue-600" />
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
              onSubmit={smartForm.form.handleSubmit(handleSignIn)}
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
                <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  ログイン成功しました。ダッシュボードに移動します...
                </div>
              )}

              {/* 認証更新中表示 */}
              {authLoading && (
                <div className="p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  認証情報を確認中...
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={emailPlaceholder}
                  className="h-11 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 selection:bg-blue-500 selection:text-white"
                  {...smartForm.form.register('email')}
                />
                {smartForm.form.formState.errors.email && (
                  <p className="text-sm text-destructive">
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
                  className="h-11 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 selection:bg-blue-500 selection:text-white"
                  {...smartForm.form.register('password')}
                />
                {smartForm.form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {smartForm.form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-medium"
                disabled={smartForm.isSubmitting || authLoading}
              >
                {smartForm.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {smartForm.isLoading ? 'ログイン中...' : '処理中...'}
                  </>
                ) : authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    認証確認中...
                  </>
                ) : (
                  submitButtonText
                )}
              </Button>
            </form>

            <div className="mt-4 text-center space-y-2">
              {onForgotPassword && (
                <Button variant="link" onClick={onForgotPassword} className="text-sm">
                  パスワードを忘れた方はこちら
                </Button>
              )}
              {onSignUp && (
                <div className="text-sm text-muted-foreground">
                  アカウントをお持ちでない方は{" "}
                  <Button variant="link" onClick={onSignUp} className="p-0 h-auto">
                    こちらから登録
                  </Button>
                </div>
              )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
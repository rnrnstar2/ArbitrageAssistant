"use client";

import { useAuth } from "./auth-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useSmartForm } from "../../hooks/use-smart-form";
import { handleAuthError } from "../../lib/error-handler";
import { Loader2, CheckCircle } from "lucide-react";
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
}

export function LoginForm({ 
  title = "ログイン",
  description = "アカウントにログインしてください",
  emailPlaceholder = "email@example.com",
  submitButtonText = "ログイン",
  onSignUp, 
  onForgotPassword,
  className,
  cardClassName
}: LoginFormProps) {
  const { signIn, isLoading: authLoading } = useAuth();

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
      return await signIn(values.email, values.password);
    }
  );

  return (
    <div className={`min-h-screen flex items-center justify-center bg-background p-4 ${className || ''}`}>
      <Card className={`w-full max-w-md mx-auto ${cardClassName || ''}`}>
          <CardHeader>
            <CardTitle>
              {title}
            </CardTitle>
            <CardDescription>
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
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md whitespace-pre-line">
                  {smartForm.error}
                </div>
              )}

              {/* 成功表示 */}
              {smartForm.isSuccess && (
                <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  ログイン成功しました。ダッシュボードに移動します...
                </div>
              )}

              {/* 認証更新中表示 */}
              {authLoading && (
                <div className="p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  認証情報を確認中...
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={emailPlaceholder}
                  {...smartForm.form.register('email')}
                />
                {smartForm.form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {smartForm.form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
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
                className="w-full"
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
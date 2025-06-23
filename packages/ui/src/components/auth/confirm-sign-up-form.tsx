"use client";

import { useState } from "react";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useSmartForm } from "../../hooks/use-smart-form";
import { handleAuthError } from "../../lib/error-handler";
import { Loader2, CheckCircle, Mail, RefreshCw } from "lucide-react";
import * as z from "zod";

// バリデーションスキーマ
const confirmSchema = z.object({
  code: z.string().min(6, '確認コードは6桁です').max(6, '確認コードは6桁です'),
});

type ConfirmFormValues = z.infer<typeof confirmSchema>;

interface ConfirmSignUpFormProps {
  email: string;
  onSignIn: () => void;
  className?: string;
  cardClassName?: string;
}

export function ConfirmSignUpForm({ email, onSignIn, className, cardClassName }: ConfirmSignUpFormProps) {
  const [resending, setResending] = useState(false);

  // useSmartFormを使用
  const smartForm = useSmartForm<ConfirmFormValues>({
    validationSchema: confirmSchema,
    onError: error => {
      const appError = handleAuthError(error, { component: 'ConfirmSignUpForm' });
      smartForm.setError(appError.userMessage || appError.message);
    },
    onSuccess: () => {
      onSignIn();
    },
  });

  const handleConfirmSignUp = smartForm.handleSubmit(
    async (values: ConfirmFormValues) => {
      return await confirmSignUp({
        username: email,
        confirmationCode: values.code,
      });
    }
  );

  const handleResendCode = async () => {
    setResending(true);

    try {
      await resendSignUpCode({
        username: email,
      });

      // 成功メッセージを表示
      smartForm.markSuccess();
    } catch (error) {
      const appError = handleAuthError(error, { component: 'ConfirmSignUpForm', action: 'resend' });
      smartForm.setError(appError.userMessage || appError.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 ${className || ''}`}>
      <Card className={`w-full max-w-md mx-auto ${cardClassName || ''}`}>
          <CardHeader className="text-center pb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              メール確認
            </CardTitle>
            <CardDescription className="text-gray-600 px-2">
              <strong className="text-blue-600">{email}</strong> に送信された確認コードを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={smartForm.form.handleSubmit(handleConfirmSignUp)}
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
                  確認コードを再送信しました。メールをご確認ください。
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
                  className="h-11 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-center text-lg tracking-widest"
                  {...smartForm.form.register('code')}
                />
                {smartForm.form.formState.errors.code && (
                  <p className="text-sm text-red-600">
                    {smartForm.form.formState.errors.code.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={smartForm.isSubmitting}
              >
                {smartForm.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    確認中...
                  </>
                ) : (
                  'アカウントを確認'
                )}
              </Button>
            </form>
            
            <div className="text-center space-y-3">
              <div className="text-sm text-gray-600">
                確認コードが届かない場合
              </div>
              <Button
                variant="outline"
                onClick={handleResendCode}
                disabled={resending || smartForm.isSubmitting}
                className="w-full h-10 border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    再送信中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    確認コードを再送信
                  </>
                )}
              </Button>
              
              <div className="text-sm text-gray-600">
                <Button 
                  variant="link" 
                  onClick={onSignIn} 
                  className="p-0 h-auto text-blue-600 hover:text-blue-700"
                >
                  ログインに戻る
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useState } from "react";
import { signIn, signUp, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { AlertCircle } from "lucide-react";
import { translateAuthError } from "../../utils/amplify-i18n";

interface LoginFormProps extends React.ComponentPropsWithoutRef<"div"> {
  onSignIn: () => void;
}

export function LoginForm({ onSignIn, className, ...props }: LoginFormProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "confirm">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn({ username: email, password });
      onSignIn();
    } catch (err: unknown) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });
      setMode("confirm");
    } catch (err: unknown) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await confirmSignUp({
        username: email,
        confirmationCode,
      });
      setMode("signin");
      setError("アカウントが確認されました。サインインしてください。");
    } catch (err: unknown) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError("");

    try {
      await resendSignUpCode({ username: email });
      setError("確認コードを再送信しました");
    } catch (err: unknown) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === "signin" && "ログイン"}
            {mode === "signup" && "アカウント作成"}
            {mode === "confirm" && "アカウント確認"}
          </CardTitle>
          <CardDescription>
            {mode === "signin" && "メールアドレスとパスワードを入力してログインしてください"}
            {mode === "signup" && "新しいアカウントを作成するために必要な情報を入力してください"}
            {mode === "confirm" && "メールに送信された確認コードを入力してください"}
          </CardDescription>
        </CardHeader>
        <CardContent>

          {mode === "signin" && (
            <form onSubmit={handleSignIn}>
              <div className="flex flex-col gap-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "処理中..." : "ログイン"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                アカウントをお持ちでない方は{" "}
                <a
                  href="#"
                  className="underline underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("signup");
                  }}
                >
                  新規登録
                </a>
              </div>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="signup-email">メールアドレス</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password">パスワード</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    8文字以上、大文字・小文字・数字・記号を含む
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "処理中..." : "アカウント作成"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                既にアカウントをお持ちの方は{" "}
                <a
                  href="#"
                  className="underline underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("signin");
                  }}
                >
                  ログイン
                </a>
              </div>
            </form>
          )}

          {mode === "confirm" && (
            <form onSubmit={handleConfirmSignUp}>
              <div className="flex flex-col gap-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="text-center">
                    <span className="font-medium">{email}</span> に確認コードを送信しました
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmation-code">確認コード</Label>
                  <Input
                    id="confirmation-code"
                    type="text"
                    placeholder="123456"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "処理中..." : "確認"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  確認コードを再送信
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                <a
                  href="#"
                  className="underline underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("signin");
                  }}
                >
                  ログインに戻る
                </a>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
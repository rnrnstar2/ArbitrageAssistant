"use client";

import { useState } from "react";
import { signIn, signUp, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";

interface LoginFormProps {
  onSignIn: () => void;
}

export function LoginForm({ onSignIn }: LoginFormProps) {
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
    } catch (err: any) {
      setError(err.message || "サインインに失敗しました");
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
    } catch (err: any) {
      setError(err.message || "アカウント作成に失敗しました");
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
    } catch (err: any) {
      setError(err.message || "確認に失敗しました");
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
    } catch (err: any) {
      setError(err.message || "再送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === "signin" && "サインイン"}
            {mode === "signup" && "アカウント作成"}
            {mode === "confirm" && "アカウント確認"}
          </h2>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {mode === "signin" && (
          <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
            <div>
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? "処理中..." : "サインイン"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-indigo-600 hover:text-indigo-500"
              >
                アカウントを作成
              </button>
            </div>
          </form>
        )}

        {mode === "signup" && (
          <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
            <div>
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="パスワード（8文字以上、大文字・小文字・数字・記号を含む）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? "処理中..." : "アカウント作成"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-indigo-600 hover:text-indigo-500"
              >
                サインインに戻る
              </button>
            </div>
          </form>
        )}

        {mode === "confirm" && (
          <form className="mt-8 space-y-6" onSubmit={handleConfirmSignUp}>
            <div>
              <p className="text-center text-sm text-gray-600 mb-4">
                {email} に確認コードを送信しました
              </p>
              <label htmlFor="confirmationCode" className="sr-only">
                確認コード
              </label>
              <input
                id="confirmationCode"
                name="confirmationCode"
                type="text"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="確認コード"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? "処理中..." : "確認"}
              </button>
            </div>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="text-indigo-600 hover:text-indigo-500"
              >
                確認コードを再送信
              </button>
              <br />
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-indigo-600 hover:text-indigo-500"
              >
                サインインに戻る
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
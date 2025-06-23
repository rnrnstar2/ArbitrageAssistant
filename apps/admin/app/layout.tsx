import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/providers";
import { AuthGuard, AuthContainer } from "@repo/ui/components/auth";
import { AdminLayout } from "../components/layout/admin-layout";

export const metadata: Metadata = {
  title: {
    template: '%s | ArbitrageAssistant Admin',
    default: 'ArbitrageAssistant Admin',
  },
  description: 'Trading management system for arbitrage operations',
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} font-sans antialiased`}
      >
        <Providers>
          <AuthGuard
            fallback={
              <AuthContainer
                loginTitle="管理者ログイン"
                loginDescription="Arbitrage Assistant 管理画面にログインしてください"
                emailPlaceholder="admin@example.com"
                signUpTitle="管理者アカウント作成"
                signUpDescription="新しい管理者アカウントを作成してください"
                enableSignUp={true}
                enableForgotPassword={true}
              />
            }
          >
            <AdminLayout>
              {children}
            </AdminLayout>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}

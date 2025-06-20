import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import "../lib/amplify";
import { AuthProvider } from "@/features/auth/auth-provider";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ProtectedRoute } from "@/features/auth/protected-route";

export const metadata: Metadata = {
  title: "Arbitrage Assistant - 管理画面",
  description: "ArbitrageAssistant Hedge System 管理画面",
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
        className={`${fontSans.variable} min-h-screen font-sans antialiased`}
      >
        <AuthProvider>
          <ProtectedRoute>
            <AdminLayout>
              {children}
            </AdminLayout>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}

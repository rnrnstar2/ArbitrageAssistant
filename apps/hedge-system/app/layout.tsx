import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { NavigationLayout } from "./NavigationLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Hedge System",
  description: "AI-powered hedge fund assistant for arbitrage trading",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} min-h-screen font-sans antialiased `}
      >
        <main>
          <Providers>
            <AuthGuard>
              <NavigationLayout>{children}</NavigationLayout>
            </AuthGuard>
          </Providers>
        </main>
      </body>
    </html>
  );
}

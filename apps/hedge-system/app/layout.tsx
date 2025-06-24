import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/providers";
import { ErrorBoundary } from "../components/error-boundary";

export const metadata: Metadata = {
  title: "Hedge System",
  description: "AI-powered hedge fund assistant for arbitrage trading",
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
        className={`${fontSans.variable} min-h-screen font-sans antialiased relative`}
      >
        <main className="w-full h-full relative">
          <ErrorBoundary>
            <Providers>
              {children}
            </Providers>
          </ErrorBoundary>
        </main>
      </body>
    </html>
  );
}

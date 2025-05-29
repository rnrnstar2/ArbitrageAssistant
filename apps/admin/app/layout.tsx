import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Front Template",
  description: "モダンなNext.jsアプリケーションのテンプレート",
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
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}

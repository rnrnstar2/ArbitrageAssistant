"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import "../utils/amplify-i18n"; // i18n設定を初期化

Amplify.configure(outputs);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      {children}
    </NextThemesProvider>
  );
}

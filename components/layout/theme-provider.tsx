"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light, dark, or the device's setting (the default). Stored per browser and applied before first paint. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

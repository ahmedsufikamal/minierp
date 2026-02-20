"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

type NextThemeMode = "light" | "dark" | "system";

function toApiTheme(theme: string): "LIGHT" | "DARK" | "SYSTEM" {
  if (theme === "light") return "LIGHT";
  if (theme === "dark") return "DARK";
  return "SYSTEM";
}

interface ThemePreferenceSyncProps {
  enabled: boolean;
  initialTheme: NextThemeMode;
}

export function ThemePreferenceSync({ enabled, initialTheme }: ThemePreferenceSyncProps) {
  const { theme, setTheme } = useTheme();
  const bootstrappedRef = useRef(false);
  const persistedThemeRef = useRef<NextThemeMode>(initialTheme);

  useEffect(() => {
    persistedThemeRef.current = initialTheme;
  }, [initialTheme]);

  useEffect(() => {
    if (!enabled) return;
    if (bootstrappedRef.current) return;

    if (theme !== initialTheme) {
      setTheme(initialTheme);
    }

    bootstrappedRef.current = true;
  }, [enabled, initialTheme, setTheme, theme]);

  useEffect(() => {
    if (!enabled) return;
    if (!bootstrappedRef.current) return;
    if (!theme) return;

    const nextTheme = theme as NextThemeMode;
    if (nextTheme === persistedThemeRef.current) return;

    const abortController = new AbortController();
    persistedThemeRef.current = nextTheme;

    void fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal: abortController.signal,
      body: JSON.stringify({ uiThemePreference: toApiTheme(nextTheme) }),
    }).catch(() => {
      // Keep local preference even if network call fails; retry on next theme change.
    });

    return () => {
      abortController.abort();
    };
  }, [enabled, theme]);

  return null;
}

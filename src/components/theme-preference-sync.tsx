"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export type NextThemeMode = "light" | "dark" | "system";
const THEME_STORAGE_KEY = "minierp-ui-theme";
const VALID_THEME_MODES = new Set<NextThemeMode>(["light", "dark", "system"]);

export function toApiTheme(theme: string): "LIGHT" | "DARK" | "SYSTEM" {
  if (theme === "light") return "LIGHT";
  if (theme === "dark") return "DARK";
  return "SYSTEM";
}

export function normalizeThemeMode(theme: string | null | undefined): NextThemeMode | null {
  if (!theme) return null;
  return VALID_THEME_MODES.has(theme as NextThemeMode) ? (theme as NextThemeMode) : null;
}

export function resolveBootstrapTheme(
  storedTheme: string | null | undefined,
  initialTheme: NextThemeMode,
): NextThemeMode {
  return normalizeThemeMode(storedTheme) ?? initialTheme;
}

export function resolveSyncResult(input: {
  persistedTheme: NextThemeMode;
  pendingTheme: NextThemeMode | null;
  attemptedTheme: NextThemeMode;
  succeeded: boolean;
}): { persistedTheme: NextThemeMode; pendingTheme: NextThemeMode | null } {
  if (input.succeeded) {
    return {
      persistedTheme: input.attemptedTheme,
      pendingTheme: input.pendingTheme === input.attemptedTheme ? null : input.pendingTheme,
    };
  }

  return {
    persistedTheme: input.persistedTheme,
    pendingTheme: input.pendingTheme ?? input.attemptedTheme,
  };
}

function readStoredTheme(): NextThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

interface ThemePreferenceSyncProps {
  enabled: boolean;
  initialTheme: NextThemeMode;
}

export function ThemePreferenceSync({ enabled, initialTheme }: ThemePreferenceSyncProps) {
  const { theme, setTheme } = useTheme();
  const bootstrappedRef = useRef(false);
  const persistedThemeRef = useRef<NextThemeMode>(initialTheme);
  const pendingThemeRef = useRef<NextThemeMode | null>(null);
  const inFlightRef = useRef(false);
  const inFlightAbortControllerRef = useRef<AbortController | null>(null);
  const flushPendingSyncRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!bootstrappedRef.current) {
      persistedThemeRef.current = initialTheme;
    }
  }, [initialTheme]);

  const scheduleFlushPendingSync = useCallback(() => {
    queueMicrotask(() => flushPendingSyncRef.current());
  }, []);

  const flushPendingSync = useCallback(() => {
    if (!enabled || inFlightRef.current) return;
    const nextTheme = pendingThemeRef.current;
    if (!nextTheme) return;

    if (nextTheme === persistedThemeRef.current) {
      pendingThemeRef.current = null;
      return;
    }

    inFlightRef.current = true;
    const abortController = new AbortController();
    inFlightAbortControllerRef.current = abortController;

    void fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal: abortController.signal,
      body: JSON.stringify({ uiThemePreference: toApiTheme(nextTheme) }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Theme sync failed with status ${response.status}`);
        }

        const resolved = resolveSyncResult({
          persistedTheme: persistedThemeRef.current,
          pendingTheme: pendingThemeRef.current,
          attemptedTheme: nextTheme,
          succeeded: true,
        });
        persistedThemeRef.current = resolved.persistedTheme;
        pendingThemeRef.current = resolved.pendingTheme;
      })
      .catch(() => {
        const resolved = resolveSyncResult({
          persistedTheme: persistedThemeRef.current,
          pendingTheme: pendingThemeRef.current,
          attemptedTheme: nextTheme,
          succeeded: false,
        });
        persistedThemeRef.current = resolved.persistedTheme;
        pendingThemeRef.current = resolved.pendingTheme;
      })
      .finally(() => {
        inFlightRef.current = false;
        inFlightAbortControllerRef.current = null;
        if (
          pendingThemeRef.current &&
          pendingThemeRef.current !== persistedThemeRef.current
        ) {
          scheduleFlushPendingSync();
        }
      });
  }, [enabled, scheduleFlushPendingSync]);

  useEffect(() => {
    flushPendingSyncRef.current = flushPendingSync;
  }, [flushPendingSync]);

  useEffect(() => {
    if (bootstrappedRef.current) return;

    const storedTheme = readStoredTheme();
    const targetTheme = resolveBootstrapTheme(storedTheme, initialTheme);
    const normalizedTheme = normalizeThemeMode(theme);

    if (normalizedTheme !== targetTheme) {
      setTheme(targetTheme);
    }

    bootstrappedRef.current = true;
  }, [initialTheme, setTheme, theme]);

  useEffect(() => {
    if (!enabled) return;
    if (!bootstrappedRef.current) return;
    const nextTheme = normalizeThemeMode(theme);
    if (!nextTheme) return;

    if (nextTheme === persistedThemeRef.current) {
      if (pendingThemeRef.current === nextTheme) {
        pendingThemeRef.current = null;
      }
      return;
    }

    pendingThemeRef.current = nextTheme;
    flushPendingSync();
  }, [enabled, flushPendingSync, theme]);

  useEffect(() => {
    if (!enabled) return;

    const retryPendingSync = () => {
      if (!pendingThemeRef.current) return;
      flushPendingSync();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      retryPendingSync();
    };

    window.addEventListener("online", retryPendingSync);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("online", retryPendingSync);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      inFlightAbortControllerRef.current?.abort();
    };
  }, [enabled, flushPendingSync]);

  return null;
}

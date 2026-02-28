import { describe, expect, it } from "vitest";
import {
  normalizeThemeMode,
  resolveBootstrapStorageSeed,
  resolveBootstrapTheme,
  resolveSyncResult,
  toApiTheme,
} from "@/components/theme-preference-sync";

describe("theme preference sync helpers", () => {
  it("maps next-themes mode to API enum", () => {
    expect(toApiTheme("light")).toBe("LIGHT");
    expect(toApiTheme("dark")).toBe("DARK");
    expect(toApiTheme("system")).toBe("SYSTEM");
    expect(toApiTheme("unknown")).toBe("SYSTEM");
  });

  it("normalizes theme mode values", () => {
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("system")).toBe("system");
    expect(normalizeThemeMode("")).toBeNull();
    expect(normalizeThemeMode("auto")).toBeNull();
    expect(normalizeThemeMode(undefined)).toBeNull();
  });

  it("prefers stored local theme during bootstrap", () => {
    expect(resolveBootstrapTheme("dark", "light")).toBe("dark");
    expect(resolveBootstrapTheme("light", "system")).toBe("light");
    expect(resolveBootstrapTheme("system", "dark")).toBe("system");
    expect(resolveBootstrapTheme("invalid", "dark")).toBe("dark");
    expect(resolveBootstrapTheme(null, "system")).toBe("system");
  });

  it("only seeds storage when the server has an explicit light or dark preference", () => {
    expect(resolveBootstrapStorageSeed("dark", "light")).toBeNull();
    expect(resolveBootstrapStorageSeed(null, "light")).toBe("light");
    expect(resolveBootstrapStorageSeed(undefined, "dark")).toBe("dark");
    expect(resolveBootstrapStorageSeed(null, "system")).toBeNull();
  });

  it("keeps pending sync queued on failure and clears it on success", () => {
    const failed = resolveSyncResult({
      persistedTheme: "system",
      pendingTheme: "dark",
      attemptedTheme: "dark",
      succeeded: false,
    });
    expect(failed.persistedTheme).toBe("system");
    expect(failed.pendingTheme).toBe("dark");

    const succeeded = resolveSyncResult({
      persistedTheme: failed.persistedTheme,
      pendingTheme: failed.pendingTheme,
      attemptedTheme: "dark",
      succeeded: true,
    });
    expect(succeeded.persistedTheme).toBe("dark");
    expect(succeeded.pendingTheme).toBeNull();
  });
});

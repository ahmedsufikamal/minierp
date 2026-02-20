import crypto from "node:crypto";

const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";
const DEFAULT_AUTOMATION_WEBHOOK_TIMEOUT_MS = 5_000;
const DEFAULT_AUTOMATION_WEBHOOK_MAX_ATTEMPTS = 3;
let devStorageSigningSecret: string | null = null;
let devAutomationSigningSecret: string | null = null;
let warnedAboutDevFallback = false;
let warnedAboutAutomationSecretFallback = false;
let productionEnvValidated = false;

function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
  }
  return url.origin;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== NEXT_PRODUCTION_BUILD_PHASE;
}

export function getRequiredAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim().length > 0) {
    return normalizeOrigin(configured.trim());
  }

  if (isProductionRuntime()) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }

  return DEFAULT_APP_BASE_URL;
}

export function getStorageSigningSecret(): string {
  const configured = process.env.INVENTORY_STORAGE_SIGNING_SECRET;
  if (configured && configured.length >= 32) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new Error("INVENTORY_STORAGE_SIGNING_SECRET must be set to at least 32 characters in production");
  }

  if (!devStorageSigningSecret) {
    devStorageSigningSecret = crypto.randomBytes(32).toString("base64url");
  }

  if (!warnedAboutDevFallback) {
    warnedAboutDevFallback = true;
    console.warn("[security] INVENTORY_STORAGE_SIGNING_SECRET not set; using ephemeral development fallback secret");
  }

  return devStorageSigningSecret;
}

function assertSecret(name: string): void {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to at least 32 characters in production`);
  }
}

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

function parseAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => normalizeOrigin(entry));
}

export function assertIamSecretsConfigured(): void {
  if (!isProductionRuntime()) return;
  assertSecret("IAM_TOKEN_HASH_SECRET");
  assertSecret("IAM_ENCRYPTION_SECRET");
}

export function assertProductionSecurityEnv(): void {
  if (!isProductionRuntime() || productionEnvValidated) return;
  getRequiredAppBaseUrl();
  getStorageSigningSecret();
  getAutomationWebhookSigningSecret();
  assertIamSecretsConfigured();
  productionEnvValidated = true;
}

export function getSessionCookieDomain(): string | undefined {
  const configured = process.env.SESSION_COOKIE_DOMAIN?.trim();
  return configured ? configured : undefined;
}

export function getAutomationWebhookAllowlistOrigins(): string[] {
  return parseAllowlist(process.env.AUTOMATION_WEBHOOK_ALLOWLIST);
}

export function getAutomationWebhookTimeoutMs(): number {
  return parseBoundedInt(
    process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS,
    DEFAULT_AUTOMATION_WEBHOOK_TIMEOUT_MS,
    250,
    60_000,
  );
}

export function getAutomationWebhookMaxAttempts(): number {
  return parseBoundedInt(
    process.env.AUTOMATION_WEBHOOK_MAX_ATTEMPTS,
    DEFAULT_AUTOMATION_WEBHOOK_MAX_ATTEMPTS,
    1,
    10,
  );
}

export function getAutomationWebhookSigningSecret(): string {
  const configured = process.env.AUTOMATION_WEBHOOK_SIGNING_SECRET;
  if (configured && configured.length >= 32) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new Error("AUTOMATION_WEBHOOK_SIGNING_SECRET must be set to at least 32 characters in production");
  }

  if (!devAutomationSigningSecret) {
    devAutomationSigningSecret = crypto.randomBytes(32).toString("base64url");
  }

  if (!warnedAboutAutomationSecretFallback) {
    warnedAboutAutomationSecretFallback = true;
    console.warn("[security] AUTOMATION_WEBHOOK_SIGNING_SECRET not set; using ephemeral development fallback secret");
  }

  return devAutomationSigningSecret;
}

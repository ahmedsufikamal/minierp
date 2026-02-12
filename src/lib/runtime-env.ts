import crypto from "node:crypto";

const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";
let devStorageSigningSecret: string | null = null;
let warnedAboutDevFallback = false;
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

export function assertIamSecretsConfigured(): void {
  if (!isProductionRuntime()) return;
  assertSecret("IAM_TOKEN_HASH_SECRET");
  assertSecret("IAM_ENCRYPTION_SECRET");
}

export function assertProductionSecurityEnv(): void {
  if (!isProductionRuntime() || productionEnvValidated) return;
  getRequiredAppBaseUrl();
  getStorageSigningSecret();
  assertIamSecretsConfigured();
  productionEnvValidated = true;
}

export function getSessionCookieDomain(): string | undefined {
  const configured = process.env.SESSION_COOKIE_DOMAIN?.trim();
  return configured ? configured : undefined;
}

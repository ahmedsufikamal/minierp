import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const useDevServer = process.env.PLAYWRIGHT_USE_DEV_SERVER === "1";
const iamTokenHashSecret =
  process.env.IAM_TOKEN_HASH_SECRET ?? "e2e_hash_secret_123456789012345678901234567890";
const iamEncryptionSecret =
  process.env.IAM_ENCRYPTION_SECRET ?? "e2e_encrypt_secret_123456789012345678901234567890";
const inventoryStorageSigningSecret =
  process.env.INVENTORY_STORAGE_SIGNING_SECRET ?? "e2e_inventory_signing_secret_123456789012345678901234567890";
const automationWebhookSigningSecret =
  process.env.AUTOMATION_WEBHOOK_SIGNING_SECRET ??
  "e2e_automation_signing_secret_123456789012345678901234567890";
const rustTrustedProxySecret =
  process.env.RUST_TRUSTED_PROXY_SECRET ?? "e2e_rust_proxy_secret_123456789012345678901234567890";
const rustApiBaseUrl = process.env.RUST_API_BASE_URL ?? "http://127.0.0.1:4000";

process.env.IAM_TOKEN_HASH_SECRET = iamTokenHashSecret;
process.env.IAM_ENCRYPTION_SECRET = iamEncryptionSecret;
process.env.INVENTORY_STORAGE_SIGNING_SECRET = inventoryStorageSigningSecret;
process.env.AUTOMATION_WEBHOOK_SIGNING_SECRET = automationWebhookSigningSecret;
process.env.RUST_TRUSTED_PROXY_SECRET = rustTrustedProxySecret;
process.env.RUST_API_BASE_URL = rustApiBaseUrl;

const e2eEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
  IAM_V2_ENABLED: process.env.IAM_V2_ENABLED ?? "1",
  IAM_PROVIDER: process.env.IAM_PROVIDER ?? "local",
  IAM_TOKEN_HASH_SECRET: iamTokenHashSecret,
  IAM_ENCRYPTION_SECRET: iamEncryptionSecret,
  INVENTORY_STORAGE_SIGNING_SECRET: inventoryStorageSigningSecret,
  AUTOMATION_WEBHOOK_SIGNING_SECRET: automationWebhookSigningSecret,
  RUST_TRUSTED_PROXY_SECRET: rustTrustedProxySecret,
  RUST_API_BASE_URL: rustApiBaseUrl,
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "cargo run -p api-rust",
      env: {
        ...e2eEnv,
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/minierp",
        RUST_API_BIND: "127.0.0.1:4000",
      },
      url: "http://127.0.0.1:4000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: useDevServer
        ? "npm run dev"
        : "DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/minierp} npx next build --webpack && npm run start",
      env: e2eEnv,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

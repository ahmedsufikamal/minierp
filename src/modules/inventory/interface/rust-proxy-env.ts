import { InventoryError } from "@/modules/inventory/domain/errors";

export function resolveRustBaseUrl(requiredForPath: string): string {
  const raw = process.env.RUST_API_BASE_URL?.trim();
  if (!raw) {
    throw new InventoryError("INTERNAL_ERROR", `RUST_API_BASE_URL is required for ${requiredForPath}`);
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function resolveRustTrustedProxySecret(requiredForPath: string): string | null {
  const sharedSecret = process.env.RUST_TRUSTED_PROXY_SECRET?.trim();
  if (sharedSecret) return sharedSecret;

  if (process.env.NODE_ENV === "production") {
    throw new InventoryError("INTERNAL_ERROR", `RUST_TRUSTED_PROXY_SECRET is required for ${requiredForPath}`);
  }

  return null;
}

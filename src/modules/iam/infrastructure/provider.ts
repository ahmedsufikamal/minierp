import type { IdentityProviderAdapter } from "@/modules/iam/domain/identity-provider";
import { LocalIdentityProvider } from "@/modules/iam/infrastructure/local-identity-provider";
import { assertIamSecretsConfigured } from "@/lib/runtime-env";

let cached: IdentityProviderAdapter | null = null;

export function getIdentityProvider(): IdentityProviderAdapter {
  if (cached) return cached;

  assertIamSecretsConfigured();

  const provider = process.env.IAM_PROVIDER || "local";
  if (provider !== "local") {
    throw new Error(`Unsupported IAM provider '${provider}'`);
  }

  cached = new LocalIdentityProvider();
  return cached;
}

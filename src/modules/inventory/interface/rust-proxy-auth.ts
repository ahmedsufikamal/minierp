import { InventoryError } from "@/modules/inventory/domain/errors";

const METADATA_IDENTITY_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

function shouldUseRustServiceAuth(): boolean {
  return process.env.RUST_API_IAM_AUTH_ENABLED === "1";
}

export async function attachRustServiceAuthorization(headers: Headers, baseUrl: string): Promise<void> {
  if (!shouldUseRustServiceAuth()) {
    return;
  }

  const audience = new URL(baseUrl).origin;
  const tokenUrl = new URL(METADATA_IDENTITY_URL);
  tokenUrl.searchParams.set("audience", audience);
  tokenUrl.searchParams.set("format", "full");

  const response = await fetch(tokenUrl, {
    headers: {
      "Metadata-Flavor": "Google",
    },
    cache: "no-store",
  }).catch((error) => {
    throw new InventoryError(
      "INTERNAL_ERROR",
      "Failed to reach the metadata server for Rust service authentication",
      error instanceof Error ? { cause: error.message } : null,
    );
  });

  if (!response.ok) {
    throw new InventoryError("INTERNAL_ERROR", "Failed to mint Rust service identity token", {
      audience,
      status: response.status,
    });
  }

  const token = (await response.text()).trim();
  if (!token) {
    throw new InventoryError("INTERNAL_ERROR", "Rust service identity token was empty");
  }

  headers.set("x-serverless-authorization", `Bearer ${token}`);
}

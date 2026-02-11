import crypto from "node:crypto";

export type PresignedUpload = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  storageKey: string;
  expiresInSeconds: number;
};

export type PresignedDownload = {
  url: string;
  expiresInSeconds: number;
};

function getStorageBaseUrl(): string {
  return (
    process.env.INVENTORY_STORAGE_PUBLIC_BASE_URL ||
    process.env.S3_PUBLIC_BASE_URL ||
    "http://localhost:9000/local"
  );
}

function signedToken(storageKey: string, ttlSeconds: number): string {
  const secret = process.env.INVENTORY_STORAGE_SIGNING_SECRET || "dev-inventory-storage-secret";
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${storageKey}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${expiresAt}.${sig}`;
}

export function createUploadUrl(input: { companyId: string; fileName: string; mimeType: string }): PresignedUpload {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${input.companyId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const expiresInSeconds = 15 * 60;
  const token = signedToken(storageKey, expiresInSeconds);
  const base = getStorageBaseUrl();

  return {
    url: `${base}/${storageKey}?uploadToken=${token}`,
    method: "PUT",
    headers: {
      "content-type": input.mimeType,
    },
    storageKey,
    expiresInSeconds,
  };
}

export function createDownloadUrl(input: { storageKey: string }): PresignedDownload {
  const expiresInSeconds = 15 * 60;
  const token = signedToken(input.storageKey, expiresInSeconds);
  const base = getStorageBaseUrl();

  return {
    url: `${base}/${input.storageKey}?downloadToken=${token}`,
    expiresInSeconds,
  };
}

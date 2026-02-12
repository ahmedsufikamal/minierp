import crypto from "node:crypto";

function getSecret(name: string, minLength = 32): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`${name} must be set and at least ${minLength} chars`);
  }
  return value;
}

export function hashToken(value: string): string {
  const secret = getSecret("IAM_TOKEN_HASH_SECRET");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomNumericCode(length = 6): string {
  const digits = "0123456789";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += digits[crypto.randomInt(0, digits.length)];
  }
  return output;
}

export function deriveKey(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

export function encryptText(plainText: string): string {
  const key = deriveKey(getSecret("IAM_ENCRYPTION_SECRET"));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted payload format");
  }
  const key = deriveKey(getSecret("IAM_ENCRYPTION_SECRET"));
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(dataPart, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}

import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const sanitized = input.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const c of sanitized) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateBase32Secret(length = 32): string {
  const bytes = crypto.randomBytes(length);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");

  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }

  return out.slice(0, 52);
}

export function generateTotp(secretBase32: string, stepSeconds = 30, digits = 6, at = Date.now()): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(at / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(codeInt % 10 ** digits).padStart(digits, "0");
}

export function verifyTotp(secretBase32: string, code: string, window = 1, stepSeconds = 30): boolean {
  const now = Date.now();
  for (let i = -window; i <= window; i += 1) {
    const candidate = generateTotp(secretBase32, stepSeconds, code.length, now + i * stepSeconds * 1000);
    if (candidate === code) return true;
  }
  return false;
}

export function buildOtpAuthUri(issuer: string, accountName: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const query = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

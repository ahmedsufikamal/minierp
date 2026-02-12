import { getRequiredAppBaseUrl } from "@/lib/runtime-env";
import { IamError } from "@/modules/iam/domain/errors";

function readOriginHeader(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;

  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function getExpectedOrigins(request: Request): string[] {
  const origins = new Set<string>();

  try {
    origins.add(getRequiredAppBaseUrl());
  } catch {
    // App base URL can be omitted in local development.
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      new URL(request.url).protocol.replace(":", "") ||
      "https";
    origins.add(`${proto}://${host}`);
  }

  return [...origins];
}

export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;

  const providedOrigin = readOriginHeader(request);
  const enforceWhenMissing = process.env.NODE_ENV === "production" || process.env.IAM_REQUIRE_SAME_ORIGIN === "1";
  if (!providedOrigin) {
    if (enforceWhenMissing) {
      throw new IamError("FORBIDDEN", "Cross-origin request blocked");
    }
    return;
  }

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(providedOrigin).origin;
  } catch {
    throw new IamError("FORBIDDEN", "Cross-origin request blocked");
  }

  const expected = getExpectedOrigins(request);
  if (!expected.includes(normalizedOrigin)) {
    throw new IamError("FORBIDDEN", "Cross-origin request blocked");
  }
}


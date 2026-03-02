import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ApiKeySource = "authorization" | "x-api-key" | "query";

export class ApiKeyAuthError extends Error {
  readonly code:
    | "MISSING_API_KEY_CONFIG"
    | "UNAUTHORIZED"
    | "QUERY_TRANSPORT_DISABLED"
    | "MISSING_COMPANY_CONTEXT"
    | "INVALID_COMPANY_CONTEXT";
  readonly status: number;

  constructor(
    code:
      | "MISSING_API_KEY_CONFIG"
      | "UNAUTHORIZED"
      | "QUERY_TRANSPORT_DISABLED"
      | "MISSING_COMPANY_CONTEXT"
      | "INVALID_COMPANY_CONTEXT",
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "ApiKeyAuthError";
    this.code = code;
    this.status = status;
  }
}

export type ApiKeyAuthResult = {
  companyId: string;
  source: ApiKeySource;
  deprecatedQueryUsed: boolean;
  querySunsetDate: string;
};

const DEFAULT_QUERY_SUNSET_DATE = "2026-03-14";

function getQuerySunsetDate(): string {
  return process.env.API_KEY_QUERY_SUNSET_DATE?.trim() || DEFAULT_QUERY_SUNSET_DATE;
}

function queryTransportEnabled(now = new Date()): boolean {
  const explicit = process.env.API_KEY_QUERY_FALLBACK_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  void now;
  return false;
}

function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}

async function recordApiKeyEvent(input: {
  request: Request;
  companyId?: string;
  result: string;
  reasonCode: string;
}): Promise<void> {
  try {
    await prisma.iamLoginAttempt.create({
      data: {
        companyId: input.companyId ?? null,
        result: input.result,
        reasonCode: input.reasonCode,
        ip: getRequestIp(input.request),
        userAgent: input.request.headers.get("user-agent"),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return;
    }
  }
}

function extractProvidedKey(request: Request): { value: string; source: ApiKeySource } | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return {
      value: auth.slice(7).trim(),
      source: "authorization",
    };
  }

  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) {
    return {
      value: headerKey,
      source: "x-api-key",
    };
  }

  const queryKey = new URL(request.url).searchParams.get("apiKey")?.trim();
  if (queryKey) {
    return {
      value: queryKey,
      source: "query",
    };
  }

  return null;
}

export function hasApiKeyCredential(request: Request): boolean {
  return extractProvidedKey(request) !== null;
}

function resolveCompanyId(request: Request): string {
  const allowDevDefault = process.env.NODE_ENV !== "production" && process.env.API_ALLOW_DEFAULT_ORG_FALLBACK === "1";
  const configuredCompanyId = process.env.API_ORG_ID?.trim() || (allowDevDefault ? "default-org" : "");
  if (!configuredCompanyId) {
    throw new ApiKeyAuthError(
      "MISSING_COMPANY_CONTEXT",
      "API_ORG_ID is required for API key authentication",
      500,
    );
  }

  const requestedCompanyId = request.headers.get("x-company-id")?.trim();
  if (requestedCompanyId && requestedCompanyId !== configuredCompanyId) {
    throw new ApiKeyAuthError(
      "INVALID_COMPANY_CONTEXT",
      "x-company-id does not match the configured API_ORG_ID for this API key",
      403,
    );
  }

  return configuredCompanyId;
}

export async function authenticateApiKeyRequest(request: Request, scope: string): Promise<ApiKeyAuthResult> {
  const configuredKey = process.env.API_KEY?.trim();
  if (!configuredKey) {
    throw new ApiKeyAuthError("MISSING_API_KEY_CONFIG", "API key authentication is not configured", 500);
  }

  const provided = extractProvidedKey(request);
  if (!provided || provided.value !== configuredKey) {
    await recordApiKeyEvent({
      request,
      result: "API_KEY_AUTH_FAILED",
      reasonCode: `API_KEY_UNAUTHORIZED:${scope}`,
    });
    throw new ApiKeyAuthError("UNAUTHORIZED", "Unauthorized", 401);
  }

  if (provided.source === "query" && !queryTransportEnabled()) {
    await recordApiKeyEvent({
      request,
      result: "API_KEY_AUTH_BLOCKED",
      reasonCode: `API_KEY_QUERY_DISABLED:${scope}`,
    });
    throw new ApiKeyAuthError(
      "QUERY_TRANSPORT_DISABLED",
      "apiKey query parameter is no longer accepted; use Authorization header",
      401,
    );
  }

  const companyId = resolveCompanyId(request);
  const deprecatedQueryUsed = provided.source === "query";
  if (deprecatedQueryUsed) {
    await recordApiKeyEvent({
      request,
      companyId,
      result: "API_KEY_AUTH_DEPRECATED",
      reasonCode: `API_KEY_QUERY_DEPRECATED:${scope}`,
    });
  }

  return {
    companyId,
    source: provided.source,
    deprecatedQueryUsed,
    querySunsetDate: getQuerySunsetDate(),
  };
}

export function appendApiKeyCompatibilityHeaders(headers: Headers, auth: ApiKeyAuthResult): void {
  headers.set("X-API-Key-Transport", auth.source);

  if (!auth.deprecatedQueryUsed) return;

  headers.set("Deprecation", "true");
  const sunsetDate = Date.parse(`${auth.querySunsetDate}T23:59:59Z`);
  if (!Number.isNaN(sunsetDate)) {
    headers.set("Sunset", new Date(sunsetDate).toUTCString());
  }
  headers.set(
    "Warning",
    `299 - "Query parameter apiKey is deprecated and will be removed after ${auth.querySunsetDate}; use Authorization: Bearer <key>"`,
  );
}

export function getApiKeyCompatibilityHeaders(auth: ApiKeyAuthResult): Record<string, string> {
  const headers = new Headers();
  appendApiKeyCompatibilityHeaders(headers, auth);
  return Object.fromEntries(headers.entries());
}

import type { ApiEnvelope, ApiErrorEnvelope, ApiErrorPayload, ApiSuccessEnvelope } from "@/lib/api/contracts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export interface ApiRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | null | undefined>;
}

function toQueryString(query: ApiRequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

async function parseEnvelope<TData>(response: Response): Promise<ApiEnvelope<TData>> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<TData> | null;

  if (!payload) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Invalid API response payload",
      },
    };
  }

  return payload;
}

export async function apiRequest<TData>(path: string, options: ApiRequestOptions = {}): Promise<TData> {
  const { query, headers, body, ...rest } = options;
  const requestHeaders = new Headers(headers);
  if (body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${path}${toQueryString(query)}`, {
    credentials: "same-origin",
    headers: requestHeaders,
    body,
    ...rest,
  });

  const envelope = await parseEnvelope<TData>(response);
  if (!envelope.ok) {
    throw new ApiClientError(response.status, envelope.error);
  }

  return envelope.data;
}

export async function apiGet<TData>(path: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
  return apiRequest<TData>(path, { ...options, method: "GET" });
}

export async function apiPost<TData, TBody>(path: string, body: TBody, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
  return apiRequest<TData>(path, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<TData, TBody>(path: string, body: TBody, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
  return apiRequest<TData>(path, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<TData>(path: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
  return apiRequest<TData>(path, { ...options, method: "DELETE" });
}

export type { ApiErrorEnvelope, ApiSuccessEnvelope };

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | (string & {});

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
}

export interface ApiScope {
  tenantId?: string;
  companyId?: string;
  requestId?: string;
}

export interface ApiSuccessEnvelope<TData> {
  ok: true;
  data: TData;
  pagination?: ApiPagination;
  scope?: ApiScope;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: ApiErrorPayload;
}

export type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

export type ApiListResult<TRow> = {
  rows: TRow[];
  page: number;
  limit: number;
  total: number;
};

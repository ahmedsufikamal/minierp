export type AuthActionError = {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export function formatAuthActionError(error: AuthActionError | null | undefined): string {
  if (!error) return "";
  const base = `${error.code}: ${error.message}`;
  if (!error.requestId) return base;
  return `${base} (Request ID: ${error.requestId})`;
}

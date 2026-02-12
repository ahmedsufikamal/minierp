export function getRequestContext(request: Request): { ip: string | null; userAgent: string | null; requestId: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  const requestId = request.headers.get("x-request-id");
  return { ip: ip ?? null, userAgent: userAgent ?? null, requestId: requestId ?? null };
}

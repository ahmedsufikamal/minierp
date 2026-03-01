import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSessionToken } from "@/lib/legacy-session-token";
import { verifySessionToken } from "@/modules/iam/infrastructure/session";

const protectedRoutes = [
  "/dashboard",
  "/customers",
  "/products",
  "/quotes",
  "/invoices",
  "/bills",
  "/inventory",
  "/accounting",
  "/vendors",
  "/purchase-orders",
  "/payments",
  "/reports",
  "/settings",
  "/org",
  "/admin",
  "/trade",
];
const publicRoutes = ["/sign-in", "/sign-up", "/auth/sign-in", "/auth/sign-up", "/auth/verify", "/"];

function isIamV2Enabled(): boolean {
  return process.env.IAM_V2_ENABLED === "1";
}

function ensureRequestId(req: NextRequest): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const requestId = ensureRequestId(req);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  // API requests do not use this auth-route redirect policy, but we still
  // propagate request correlation IDs.
  if (path.startsWith("/api")) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    return withRequestId(response, requestId);
  }

  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.includes(path);

  const iamSessionToken = req.cookies.get("iam_session")?.value;
  const legacySessionToken = req.cookies.get("session")?.value;
  const hasLegacySessionCookie = Boolean(legacySessionToken);
  const hasIamSessionCookie = Boolean(iamSessionToken);

  // Presence-only IAM cookie checks are enough to allow protected-route traversal
  // into server-side auth guards, but not reliable enough for public-route bounce
  // redirects (stale cookies can cause /auth/sign-in <-> /dashboard loops).
  const isAuthenticatedForProtectedRoutes = hasLegacySessionCookie || hasIamSessionCookie;

  let hasValidSessionForPublicRouteRedirect = false;
  if (isPublicRoute && path !== "/" && path !== "/dashboard") {
    if (isIamV2Enabled()) {
      hasValidSessionForPublicRouteRedirect = hasIamSessionCookie
        ? Boolean(await verifySessionToken(iamSessionToken!))
        : false;
    } else {
      hasValidSessionForPublicRouteRedirect = hasLegacySessionCookie
        ? Boolean((await decryptSessionToken(legacySessionToken))?.userId)
        : false;
    }
  }

  if (isProtectedRoute && !isAuthenticatedForProtectedRoutes) {
    return withRequestId(NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl)), requestId);
  }

  if (isPublicRoute && hasValidSessionForPublicRouteRedirect && path !== "/" && path !== "/dashboard") {
    return withRequestId(NextResponse.redirect(new URL("/dashboard", req.nextUrl)), requestId);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return withRequestId(response, requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};

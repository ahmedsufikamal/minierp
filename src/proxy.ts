import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

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
];
const publicRoutes = ["/sign-in", "/sign-up", "/auth/sign-in", "/auth/sign-up", "/auth/verify", "/"];

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

  const legacyCookie = req.cookies.get("session")?.value;
  const legacySession = await decrypt(legacyCookie);
  const iamSessionToken = req.cookies.get("iam_session")?.value;
  const isAuthenticated = Boolean(legacySession?.userId || iamSessionToken);

  if (isProtectedRoute && !isAuthenticated) {
    return withRequestId(NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl)), requestId);
  }

  if (isPublicRoute && isAuthenticated && path !== "/" && path !== "/dashboard") {
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

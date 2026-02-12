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

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.includes(path);

  const legacyCookie = req.cookies.get("session")?.value;
  const legacySession = await decrypt(legacyCookie);
  const iamSessionToken = req.cookies.get("iam_session")?.value;
  const isAuthenticated = Boolean(legacySession?.userId || iamSessionToken);

  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl));
  }

  if (isPublicRoute && isAuthenticated && path !== "/" && path !== "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};

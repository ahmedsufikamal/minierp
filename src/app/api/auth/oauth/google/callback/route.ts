import { NextResponse } from "next/server";
import { completeOAuthSignIn } from "@/modules/iam/infrastructure/oauth-signin";
import { err } from "@/modules/iam/interface/http";
import { getRequestContext } from "@/modules/iam/interface/request-context";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return NextResponse.redirect("/auth/sign-in?error=oauth_missing_code");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const ctx = getRequestContext(request);

    await completeOAuthSignIn({
      provider: "google",
      code,
      state,
      redirectUri: `${baseUrl}/api/auth/oauth/google/callback`,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (error) {
    const response = err(error);
    return response;
  }
}

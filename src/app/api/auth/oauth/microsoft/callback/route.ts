import { NextResponse } from "next/server";
import { syncLegacyFromIamSession } from "@/lib/session";
import { getRequiredAppBaseUrl } from "@/lib/runtime-env";
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

    const baseUrl = getRequiredAppBaseUrl();
    const ctx = getRequestContext(request);

    await completeOAuthSignIn({
      provider: "microsoft",
      code,
      state,
      redirectUri: `${baseUrl}/api/auth/oauth/microsoft/callback`,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await syncLegacyFromIamSession();

    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (error) {
    const response = err(error);
    return response;
  }
}

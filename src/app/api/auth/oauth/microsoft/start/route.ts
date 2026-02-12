import { NextResponse } from "next/server";
import { getRequiredAppBaseUrl } from "@/lib/runtime-env";
import { buildOAuthAuthorizeUrl } from "@/modules/iam/infrastructure/oauth";
import { issueOAuthState } from "@/modules/iam/infrastructure/oauth-state";

export async function GET() {
  const baseUrl = getRequiredAppBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/oauth/microsoft/callback`;
  const state = await issueOAuthState();
  const url = buildOAuthAuthorizeUrl("microsoft", state, redirectUri);
  return NextResponse.redirect(url);
}

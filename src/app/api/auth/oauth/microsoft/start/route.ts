import { NextResponse } from "next/server";
import { buildOAuthAuthorizeUrl } from "@/modules/iam/infrastructure/oauth";
import { issueOAuthState } from "@/modules/iam/infrastructure/oauth-state";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/oauth/microsoft/callback`;
  const state = await issueOAuthState();
  const url = buildOAuthAuthorizeUrl("microsoft", state, redirectUri);
  return NextResponse.redirect(url);
}

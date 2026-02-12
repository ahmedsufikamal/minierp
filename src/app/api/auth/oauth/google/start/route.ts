import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getRequiredAppBaseUrl } from "@/lib/runtime-env";
import { assertAuthMethodAllowed } from "@/modules/iam/application/policy";
import { buildOAuthAuthorizeUrl } from "@/modules/iam/infrastructure/oauth";
import { issueOAuthState } from "@/modules/iam/infrastructure/oauth-state";

export async function GET() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? null;
  if (host) {
    const company = await prisma.company.findFirst({
      where: {
        OR: [{ primaryDomain: host }, { allowedDomains: { array_contains: host } as never }],
      },
      select: { id: true },
    });
    if (company) {
      await assertAuthMethodAllowed(company.id, "OAUTH_GOOGLE");
    }
  }
  const baseUrl = getRequiredAppBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/oauth/google/callback`;
  const state = await issueOAuthState();
  const url = buildOAuthAuthorizeUrl("google", state, redirectUri);
  return NextResponse.redirect(url);
}

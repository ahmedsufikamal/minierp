import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { resolvePrincipalFromCookies } from "@/modules/iam/application/principal-resolver";
import { isIamError } from "@/modules/iam/domain/errors";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { acceptInviteSchema } from "@/modules/iam/interface/schemas";

async function accept(token: string, userId: string) {
  await getIdentityProvider().acceptInvite({ token, userId });
}

function isInviteSignupBridgeEnabled(): boolean {
  const explicit = process.env.IAM_INVITE_SIGNUP_BRIDGE_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return true;
}

function safeInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    const body = await parseBody(request, acceptInviteSchema);

    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    await assertRateLimit({
      scope: "invite_accept_post",
      key: `${principal.userId}:${body.token}:${ip}`,
      maxAttempts: safeInt(process.env.IAM_INVITE_ACCEPT_RATE_LIMIT_MAX_ATTEMPTS, 20, 1, 200),
      windowSeconds: safeInt(process.env.IAM_INVITE_ACCEPT_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    await accept(body.token, principal.userId);
    return ok({ accepted: true });
  } catch (error) {
    return err(error);
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect("/org/select?error=missing_invite_token");
  }

  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    await assertRateLimit({
      scope: "invite_accept_get",
      key: `${token}:${ip}`,
      maxAttempts: safeInt(process.env.IAM_INVITE_ACCEPT_RATE_LIMIT_MAX_ATTEMPTS, 20, 1, 200),
      windowSeconds: safeInt(process.env.IAM_INVITE_ACCEPT_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    const resolved = await resolvePrincipalFromCookies();
    if (!resolved.principal) {
      const nextPath = `/api/invites/accept?token=${encodeURIComponent(token)}`;
      const provider = getIdentityProvider();
      if (!isInviteSignupBridgeEnabled()) {
        return NextResponse.redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
      }

      try {
        const invite = await provider.previewInvite(token);
        const existingUser = await prisma.user.findUnique({
          where: { email: invite.email },
          select: { id: true },
        });

        if (existingUser) {
          return NextResponse.redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
        }
        return NextResponse.redirect(`/auth/sign-up?invite=${encodeURIComponent(token)}&next=${encodeURIComponent("/org/select?accepted=1")}`);
      } catch {
        return NextResponse.redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
      }
    }

    await accept(token, resolved.principal.userId);
    return NextResponse.redirect("/org/select?accepted=1");
  } catch (error) {
    if (isIamError(error) && (error.code === "FORBIDDEN_EMAIL_MISMATCH" || error.code === "TOKEN_EXPIRED" || error.code === "TOKEN_INVALID")) {
      return NextResponse.redirect(`/org/select?error=${encodeURIComponent(error.code.toLowerCase())}`);
    }
    return NextResponse.redirect("/org/select?error=invite_accept_failed");
  }
}

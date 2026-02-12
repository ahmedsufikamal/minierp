import { getIdentityProvider } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { sendMagicLinkSchema } from "@/modules/iam/interface/schemas";
import { verifyTurnstileToken } from "@/modules/iam/infrastructure/turnstile";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";
import { getRequestContext } from "@/modules/iam/interface/request-context";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, sendMagicLinkSchema);
    const ctx = getRequestContext(request);

    await assertRateLimit({
      key: `magic-link:${body.email}`,
      scope: "magic_link_send",
      maxAttempts: 6,
      windowSeconds: 60,
    });

    await verifyTurnstileToken({ token: body.turnstileToken, ip: ctx.ip });

    await getIdentityProvider().sendMagicLink({
      email: body.email,
      redirectTo: body.redirectTo,
    });

    return ok({ sent: true });
  } catch (error) {
    return err(error);
  }
}

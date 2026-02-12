import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { sendOtpSchema } from "@/modules/iam/interface/schemas";
import { verifyTurnstileToken } from "@/modules/iam/infrastructure/turnstile";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";
import { getRequestContext } from "@/modules/iam/interface/request-context";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, sendOtpSchema);
    const principal = await requireAuth().catch(() => null);
    const ctx = getRequestContext(request);

    await assertRateLimit({
      key: `otp-send:${principal?.userId ?? "anon"}:${body.destination}`,
      scope: "otp_send",
      maxAttempts: 10,
      windowSeconds: 60,
    });

    await verifyTurnstileToken({ token: body.turnstileToken, ip: ctx.ip });

    await getIdentityProvider().sendOtp({
      destination: body.destination,
      channel: body.channel,
      purpose: body.purpose,
      userId: principal?.userId,
      companyId: principal?.activeCompanyId,
      ip: ctx.ip,
    });

    return ok({ sent: true });
  } catch (error) {
    return err(error);
  }
}

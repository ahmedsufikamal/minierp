import { getIdentityProvider } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { verifyOtpSchema } from "@/modules/iam/interface/schemas";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, verifyOtpSchema);

    await assertRateLimit({
      key: `otp-verify:${body.destination}`,
      scope: "otp_verify",
      maxAttempts: 10,
      windowSeconds: 60,
    });

    await getIdentityProvider().verifyOtp({
      destination: body.destination,
      code: body.code,
      purpose: body.purpose,
    });

    return ok({ verified: true });
  } catch (error) {
    return err(error);
  }
}

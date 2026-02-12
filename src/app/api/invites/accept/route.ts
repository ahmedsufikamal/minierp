import { NextResponse } from "next/server";
import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { acceptInviteSchema } from "@/modules/iam/interface/schemas";

async function accept(token: string, userId: string) {
  await getIdentityProvider().acceptInvite({ token, userId });
}

export async function POST(request: Request) {
  try {
    const principal = await requireAuth();
    const body = await parseBody(request, acceptInviteSchema);
    await accept(body.token, principal.userId);
    return ok({ accepted: true });
  } catch (error) {
    return err(error);
  }
}

export async function GET(request: Request) {
  try {
    const principal = await requireAuth();
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.redirect("/org/select?error=missing_invite_token");
    }

    await accept(token, principal.userId);
    return NextResponse.redirect("/org/select?accepted=1");
  } catch {
    return NextResponse.redirect("/org/select?error=invite_accept_failed");
  }
}

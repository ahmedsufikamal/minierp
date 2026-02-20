import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { accountProfileSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        uiThemePreference: true,
      },
    });

    if (!user) {
      throw new IamError("NOT_FOUND", "User not found");
    }

    return ok(user);
  } catch (error) {
    return err(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    const body = await parseBody(request, accountProfileSchema);
    const existingUser = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: {
        email: true,
        phone: true,
        pendingEmail: true,
        pendingEmailExpiresAt: true,
        uiThemePreference: true,
      },
    });
    if (!existingUser) {
      throw new IamError("NOT_FOUND", "User not found");
    }

    const nextEmail = body.email?.trim().toLowerCase();
    const hasPhoneInput = body.phone !== undefined;
    const nextPhone = body.phone === null ? null : body.phone?.trim();
    const isEmailChange = Boolean(nextEmail && nextEmail !== existingUser.email);
    const isPhoneChange = hasPhoneInput && nextPhone !== existingUser.phone;

    if (isEmailChange && nextEmail) {
      if (!body.emailOtpCode) {
        throw new IamError("VALIDATION_ERROR", "emailOtpCode is required to change email");
      }
      if (!existingUser.pendingEmail || existingUser.pendingEmail !== nextEmail) {
        throw new IamError("VALIDATION_ERROR", "Please request a fresh email-change OTP for this address");
      }
      if (!existingUser.pendingEmailExpiresAt || existingUser.pendingEmailExpiresAt <= new Date()) {
        throw new IamError("TOKEN_EXPIRED", "Email-change OTP challenge has expired");
      }
      await getIdentityProvider().verifyOtp({
        destination: nextEmail,
        code: body.emailOtpCode,
        purpose: "EMAIL_CHANGE",
      });
    }

    if (isPhoneChange && nextPhone) {
      if (!body.phoneOtpCode) {
        throw new IamError("VALIDATION_ERROR", "phoneOtpCode is required to change phone");
      }
      await getIdentityProvider().verifyOtp({
        destination: nextPhone,
        code: body.phoneOtpCode,
        purpose: "PHONE_VERIFY",
      });
    }

    try {
      const updated = await prisma.user.update({
        where: { id: principal.userId },
        data: {
          name: body.name,
          phone: hasPhoneInput ? nextPhone : undefined,
          phoneVerifiedAt: isPhoneChange ? (nextPhone ? new Date() : null) : undefined,
          avatarUrl: body.avatarUrl,
          email: isEmailChange ? nextEmail : undefined,
          emailVerifiedAt: isEmailChange ? new Date() : undefined,
          pendingEmail: isEmailChange ? null : undefined,
          pendingEmailExpiresAt: isEmailChange ? null : undefined,
          uiThemePreference: body.uiThemePreference,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarUrl: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          uiThemePreference: true,
        },
      });

      await writeIamAudit({
        action: "POLICY_UPDATED",
        companyId: principal.activeCompanyId,
        actorUserId: principal.userId,
        entityType: "User",
        entityId: principal.userId,
        after: updated,
      });

      return ok(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new IamError("CONFLICT", "Email already in use");
      }
      throw error;
    }
  } catch (error) {
    return err(error);
  }
}

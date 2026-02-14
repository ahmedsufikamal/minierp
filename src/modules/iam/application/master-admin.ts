import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { isMasterAdminEnforcementEnabled } from "@/modules/iam/application/feature-flags";

export const MASTER_ADMIN_ROLE_NAME = "OWNER";
export const MASTER_ADMIN_LABEL = "Master Admin";
const ADMIN_ROLE_NAME = "ADMIN";

export function getTenantRoleLabel(roleName: string): string {
  if (roleName === MASTER_ADMIN_ROLE_NAME) return MASTER_ADMIN_LABEL;
  return roleName;
}

export function isGovernanceRole(roleName: string): boolean {
  return roleName === MASTER_ADMIN_ROLE_NAME || roleName === ADMIN_ROLE_NAME;
}

export function assertDirectRoleChangeAllowed(input: {
  currentRole: string;
  currentStatus: string;
  nextRole: string;
}): void {
  if (!isMasterAdminEnforcementEnabled()) return;

  const isCurrentActiveMasterAdmin = input.currentRole === MASTER_ADMIN_ROLE_NAME && input.currentStatus === "ACTIVE";
  if (isCurrentActiveMasterAdmin && input.nextRole !== MASTER_ADMIN_ROLE_NAME) {
    throw new IamError("VALIDATION_ERROR", "Master Admin cannot be demoted directly. Use master-admin transfer.");
  }

  if (!isCurrentActiveMasterAdmin && input.nextRole === MASTER_ADMIN_ROLE_NAME) {
    throw new IamError("VALIDATION_ERROR", "Use master-admin transfer to assign Master Admin.");
  }
}

export function assertDirectStatusChangeAllowed(input: {
  currentRole: string;
  currentStatus: string;
  nextStatus: string;
}): void {
  if (!isMasterAdminEnforcementEnabled()) return;

  const isCurrentActiveMasterAdmin = input.currentRole === MASTER_ADMIN_ROLE_NAME && input.currentStatus === "ACTIVE";
  if (isCurrentActiveMasterAdmin && input.nextStatus !== "ACTIVE") {
    throw new IamError("VALIDATION_ERROR", "Master Admin cannot be suspended directly. Transfer first.");
  }
}

export function assertDirectMembershipRemovalAllowed(input: { currentRole: string; currentStatus: string }): void {
  if (!isMasterAdminEnforcementEnabled()) return;

  const isCurrentActiveMasterAdmin = input.currentRole === MASTER_ADMIN_ROLE_NAME && input.currentStatus === "ACTIVE";
  if (isCurrentActiveMasterAdmin) {
    throw new IamError("VALIDATION_ERROR", "Master Admin cannot be removed directly. Transfer first.");
  }
}

export async function transferMasterAdmin(input: {
  companyId: string;
  actorUserId: string;
  nextOwnerUserId: string;
}): Promise<{ previousOwnerUserId: string; nextOwnerUserId: string }> {
  const result = await prisma.$transaction(async (tx) => {
    const currentOwner = await tx.companyMembership.findFirst({
      where: {
        companyId: input.companyId,
        role: MASTER_ADMIN_ROLE_NAME,
        status: "ACTIVE",
      },
      orderBy: [{ joinedAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, userId: true, role: true, status: true },
    });
    if (!currentOwner) {
      throw new IamError("VALIDATION_ERROR", "No active Master Admin found for this organization.");
    }

    const nextOwnerMembership = await tx.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: input.nextOwnerUserId,
          companyId: input.companyId,
        },
      },
      select: { id: true, userId: true, role: true, status: true },
    });
    if (!nextOwnerMembership || nextOwnerMembership.status !== "ACTIVE") {
      throw new IamError("VALIDATION_ERROR", "Target user must be an active member of the organization.");
    }

    if (nextOwnerMembership.userId === currentOwner.userId) {
      throw new IamError("VALIDATION_ERROR", "Target user is already the Master Admin.");
    }

    const [ownerRole, adminRole] = await Promise.all([
      tx.iamRole.findUnique({
        where: {
          companyId_name: {
            companyId: input.companyId,
            name: MASTER_ADMIN_ROLE_NAME,
          },
        },
        select: { id: true },
      }),
      tx.iamRole.findUnique({
        where: {
          companyId_name: {
            companyId: input.companyId,
            name: ADMIN_ROLE_NAME,
          },
        },
        select: { id: true },
      }),
    ]);

    await tx.companyMembership.update({
      where: { id: currentOwner.id },
      data: {
        role: ADMIN_ROLE_NAME,
        roleId: adminRole?.id ?? null,
      },
    });

    await tx.companyMembership.update({
      where: { id: nextOwnerMembership.id },
      data: {
        role: MASTER_ADMIN_ROLE_NAME,
        roleId: ownerRole?.id ?? null,
        status: "ACTIVE",
      },
    });

    return {
      previousOwnerUserId: currentOwner.userId,
      nextOwnerUserId: nextOwnerMembership.userId,
    };
  });

  await writeIamAudit({
    action: "ROLE_CHANGED",
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: "CompanyMembership",
    entityId: `${result.nextOwnerUserId}:${input.companyId}`,
    metadata: {
      transfer: true,
      previousOwnerUserId: result.previousOwnerUserId,
      nextOwnerUserId: result.nextOwnerUserId,
      previousOwnerNewRole: ADMIN_ROLE_NAME,
      nextOwnerNewRole: MASTER_ADMIN_ROLE_NAME,
    },
  });

  return result;
}

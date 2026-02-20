import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { PlatformError } from "@/modules/platform/domain/errors";
import { assertCompanyBelongsToTenant } from "@/modules/platform/application/tenant-context.service";

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function toTenantKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function toCompanySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function listTenants(ctx: PlatformRequestContext) {
  try {
    if (ctx.platformRole === "SUPER_ADMIN") {
      return prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          key: true,
          name: true,
          status: true,
          plan: true,
          createdAt: true,
          companies: {
            select: { id: true, name: true, slug: true, isActive: true },
            orderBy: { name: "asc" },
          },
        },
      });
    }

    return prisma.tenant.findMany({
      where: {
        id: ctx.tenantId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        plan: true,
        createdAt: true,
        companies: {
          select: { id: true, name: true, slug: true, isActive: true },
          orderBy: { name: "asc" },
        },
      },
    });
  } catch (error) {
    if (isSchemaMismatch(error)) {
      const company = await prisma.company.findUnique({
        where: { id: ctx.companyId },
        select: { id: true, slug: true, name: true, isActive: true, createdAt: true },
      });

      if (!company) return [];

      return [
        {
          id: company.id,
          key: company.slug ?? `tenant-${company.id}`,
          name: company.name,
          status: "ACTIVE",
          plan: null,
          createdAt: company.createdAt,
          companies: [
            {
              id: company.id,
              name: company.name,
              slug: company.slug,
              isActive: company.isActive,
            },
          ],
        },
      ];
    }

    throw error;
  }
}

export async function createTenant(
  ctx: PlatformRequestContext,
  input: {
    key: string;
    name: string;
    plan?: string;
    primaryDomain?: string;
    company?: { name: string; slug?: string };
  },
) {
  if (ctx.platformRole !== "SUPER_ADMIN") {
    throw new PlatformError("FORBIDDEN", "Only platform super admins can create tenants");
  }

  const tenantKey = input.key || toTenantKey(input.name);
  const companyName = input.company?.name?.trim() || `${input.name.trim()} Primary Company`;
  const companySlug = input.company?.slug?.trim() || toCompanySlug(companyName);

  try {
    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          key: tenantKey,
          name: input.name.trim(),
          plan: input.plan?.trim() || null,
        },
      });

      const company = await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: companyName,
          slug: companySlug,
          status: "ACTIVE",
        },
      });

      if (input.primaryDomain?.trim()) {
        await tx.tenantDomain.create({
          data: {
            tenantId: tenant.id,
            domain: input.primaryDomain.trim().toLowerCase(),
            isPrimary: true,
            status: "PENDING",
          },
        });
      }

      await ensureDefaultTenantRoles(company.id);

      return {
        tenant,
        company,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Tenant key, company slug, or domain already exists");
    }
    throw error;
  }
}

export async function listTenantDomains(ctx: PlatformRequestContext, tenantId?: string) {
  const effectiveTenantId = tenantId ?? ctx.tenantId;
  if (ctx.platformRole !== "SUPER_ADMIN" && effectiveTenantId !== ctx.tenantId) {
    throw new PlatformError("FORBIDDEN", "Cannot access domains outside active tenant");
  }

  return prisma.tenantDomain.findMany({
    where: { tenantId: effectiveTenantId },
    orderBy: [{ isPrimary: "desc" }, { domain: "asc" }],
  });
}

export async function upsertTenantDomain(
  ctx: PlatformRequestContext,
  input: { tenantId?: string; domain: string; isPrimary?: boolean },
) {
  const effectiveTenantId = input.tenantId ?? ctx.tenantId;
  if (ctx.platformRole !== "SUPER_ADMIN" && effectiveTenantId !== ctx.tenantId) {
    throw new PlatformError("FORBIDDEN", "Cannot mutate domains outside active tenant");
  }

  const domain = input.domain.trim().toLowerCase();
  const normalizedPrimary = Boolean(input.isPrimary);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.tenantDomain.findUnique({
      where: { domain },
      select: { id: true, tenantId: true },
    });

    if (existing && existing.tenantId !== effectiveTenantId) {
      throw new PlatformError("CONFLICT", "Domain is already registered to another tenant");
    }

    if (normalizedPrimary) {
      await tx.tenantDomain.updateMany({
        where: { tenantId: effectiveTenantId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return tx.tenantDomain.upsert({
      where: { domain },
      create: {
        tenantId: effectiveTenantId,
        domain,
        isPrimary: normalizedPrimary,
        status: "PENDING",
      },
      update: {
        tenantId: effectiveTenantId,
        isPrimary: normalizedPrimary,
      },
    });
  });
}

export async function listRoleProfiles(ctx: PlatformRequestContext) {
  return prisma.roleProfile.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function upsertRoleProfile(
  ctx: PlatformRequestContext,
  input: { id?: string; name: string; description?: string; isDefault?: boolean },
) {
  if (input.id) {
    return prisma.roleProfile.update({
      where: { id: input.id },
      data: {
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,
      },
    });
  }

  return prisma.roleProfile.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
    },
  });
}

export async function upsertPermissionRule(
  ctx: PlatformRequestContext,
  input: {
    roleProfileId: string;
    module: string;
    resource: string;
    action: string;
    effect: "ALLOW" | "DENY";
    scopeLevel: "TENANT" | "COMPANY" | "BRANCH" | "WAREHOUSE" | "PROJECT" | "USER";
    condition?: Record<string, unknown>;
  },
) {
  const roleProfile = await prisma.roleProfile.findUnique({
    where: { id: input.roleProfileId },
    select: { id: true, tenantId: true },
  });

  if (!roleProfile || roleProfile.tenantId !== ctx.tenantId) {
    throw new PlatformError("FORBIDDEN", "Role profile is outside active tenant");
  }

  return prisma.permissionRule.upsert({
    where: {
      roleProfileId_module_resource_action_scopeLevel: {
        roleProfileId: input.roleProfileId,
        module: input.module,
        resource: input.resource,
        action: input.action,
        scopeLevel: input.scopeLevel,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      roleProfileId: input.roleProfileId,
      module: input.module,
      resource: input.resource,
      action: input.action,
      effect: input.effect,
      scopeLevel: input.scopeLevel,
      condition: (input.condition ?? null) as never,
    },
    update: {
      effect: input.effect,
      condition: (input.condition ?? null) as never,
    },
  });
}

export async function upsertRowScopeRule(
  ctx: PlatformRequestContext,
  input: {
    roleProfileId: string;
    resource: string;
    scopeLevel: "TENANT" | "COMPANY" | "BRANCH" | "WAREHOUSE" | "PROJECT" | "USER";
    selector: Record<string, unknown>;
  },
) {
  const roleProfile = await prisma.roleProfile.findUnique({
    where: { id: input.roleProfileId },
    select: { id: true, tenantId: true },
  });

  if (!roleProfile || roleProfile.tenantId !== ctx.tenantId) {
    throw new PlatformError("FORBIDDEN", "Role profile is outside active tenant");
  }

  return prisma.rowScopeRule.create({
    data: {
      tenantId: ctx.tenantId,
      roleProfileId: input.roleProfileId,
      resource: input.resource,
      scopeLevel: input.scopeLevel,
      selector: input.selector as never,
    },
  });
}

export async function attachCompanyToTenant(
  ctx: PlatformRequestContext,
  input: { companyId: string; tenantId?: string },
) {
  const targetTenantId = input.tenantId ?? ctx.tenantId;

  if (ctx.platformRole !== "SUPER_ADMIN" && targetTenantId !== ctx.tenantId) {
    throw new PlatformError("FORBIDDEN", "Cannot attach company to another tenant");
  }

  await prisma.company.update({
    where: { id: input.companyId },
    data: { tenantId: targetTenantId },
  });

  await assertCompanyBelongsToTenant(input.companyId, targetTenantId);

  return { companyId: input.companyId, tenantId: targetTenantId };
}

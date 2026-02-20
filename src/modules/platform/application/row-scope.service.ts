import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext, RowScopeInput } from "@/modules/platform/domain/types";

type ParsedSelector = {
  companyIds?: string[];
  branchIds?: string[];
  warehouseIds?: string[];
  projectIds?: string[];
};

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export function parseSelector(selector: unknown): ParsedSelector {
  if (!selector || typeof selector !== "object") return {};
  const source = selector as Record<string, unknown>;

  const parseList = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const out = value.map((entry) => String(entry)).filter(Boolean);
    return out.length > 0 ? out : undefined;
  };

  return {
    companyIds: parseList(source.companyIds),
    branchIds: parseList(source.branchIds),
    warehouseIds: parseList(source.warehouseIds),
    projectIds: parseList(source.projectIds),
  };
}

async function loadSelectors(ctx: PlatformRequestContext, resource: string): Promise<ParsedSelector[]> {
  try {
    const memberships = await prisma.tenantMembership.findMany({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        status: "ACTIVE",
        roleProfileId: { not: null },
      },
      select: { roleProfileId: true },
    });

    const roleProfileIds = memberships
      .map((membership) => membership.roleProfileId)
      .filter((id): id is string => Boolean(id));

    if (roleProfileIds.length === 0) return [];

    const rules = await prisma.rowScopeRule.findMany({
      where: {
        tenantId: ctx.tenantId,
        roleProfileId: { in: roleProfileIds },
        resource,
      },
      select: { selector: true },
    });

    return rules.map((rule) => parseSelector(rule.selector));
  } catch (error) {
    if (isSchemaMismatch(error)) return [];
    throw error;
  }
}

export async function buildRowScopeWhere(
  ctx: PlatformRequestContext,
  resource: string,
  input: {
    companyField?: string;
    tenantField?: string;
    branchField?: string;
    warehouseField?: string;
    projectField?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const companyField = input.companyField ?? "companyId";
  const tenantField = input.tenantField ?? "tenantId";
  const where: Record<string, unknown> = { [tenantField]: ctx.tenantId };

  if (ctx.platformRole !== "SUPER_ADMIN") {
    where[companyField] = ctx.companyId;
  }

  const selectors = await loadSelectors(ctx, resource);
  if (selectors.length === 0) {
    return where;
  }

  const merged: ParsedSelector = {
    companyIds: [...new Set(selectors.flatMap((selector) => selector.companyIds ?? []))],
    branchIds: [...new Set(selectors.flatMap((selector) => selector.branchIds ?? []))],
    warehouseIds: [...new Set(selectors.flatMap((selector) => selector.warehouseIds ?? []))],
    projectIds: [...new Set(selectors.flatMap((selector) => selector.projectIds ?? []))],
  };

  if (merged.companyIds && merged.companyIds.length > 0) {
    where[companyField] = { in: merged.companyIds };
  }

  if (input.branchField && merged.branchIds && merged.branchIds.length > 0) {
    where[input.branchField] = { in: merged.branchIds };
  }

  if (input.warehouseField && merged.warehouseIds && merged.warehouseIds.length > 0) {
    where[input.warehouseField] = { in: merged.warehouseIds };
  }

  if (input.projectField && merged.projectIds && merged.projectIds.length > 0) {
    where[input.projectField] = { in: merged.projectIds };
  }

  return where;
}

export async function assertRowScope(
  ctx: PlatformRequestContext,
  resource: string,
  input: RowScopeInput,
): Promise<void> {
  if (ctx.platformRole === "SUPER_ADMIN") return;

  if (input.tenantId && input.tenantId !== ctx.tenantId) {
    throw new PlatformError("FORBIDDEN", `Cross-tenant access denied for resource ${resource}`);
  }

  if (input.companyId && input.companyId !== ctx.companyId) {
    const selectors = await loadSelectors(ctx, resource);
    const allowed = selectors.flatMap((selector) => selector.companyIds ?? []);
    if (!allowed.includes(input.companyId)) {
      throw new PlatformError("FORBIDDEN", `Cross-company access denied for resource ${resource}`);
    }
  }

  const selectors = await loadSelectors(ctx, resource);
  if (selectors.length === 0) {
    return;
  }

  const allowedBranches = selectors.flatMap((selector) => selector.branchIds ?? []);
  const allowedWarehouses = selectors.flatMap((selector) => selector.warehouseIds ?? []);
  const allowedProjects = selectors.flatMap((selector) => selector.projectIds ?? []);

  if (input.branchId && allowedBranches.length > 0 && !allowedBranches.includes(input.branchId)) {
    throw new PlatformError("FORBIDDEN", "Branch scope violation");
  }

  if (input.warehouseId && allowedWarehouses.length > 0 && !allowedWarehouses.includes(input.warehouseId)) {
    throw new PlatformError("FORBIDDEN", "Warehouse scope violation");
  }

  if (input.projectId && allowedProjects.length > 0 && !allowedProjects.includes(input.projectId)) {
    throw new PlatformError("FORBIDDEN", "Project scope violation");
  }
}

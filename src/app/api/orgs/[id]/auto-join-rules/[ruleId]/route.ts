import { getIdentityProvider, requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { autoJoinRuleSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.settings");
    await requireStepUp();
    const { id, ruleId } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant auto-join rule update blocked");
    }

    const before = await getIdentityProvider().listAutoJoinRules(id).then((rules) => rules.find((r) => r.id === ruleId) ?? null);
    const body = await parseBody(request, autoJoinRuleSchema);
    const rule = await getIdentityProvider().upsertAutoJoinRule({
      companyId: id,
      ruleId,
      ruleType: body.ruleType,
      config: body.config,
      isEnabled: body.isEnabled,
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "IamAutoJoinRule",
      entityId: rule.id,
      before: before
        ? {
            ruleType: before.ruleType,
            config: before.config,
            isEnabled: before.isEnabled,
          }
        : null,
      after: rule,
    });

    return ok(rule);
  } catch (error) {
    return err(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.settings");
    await requireStepUp();
    const { id, ruleId } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant auto-join rule deletion blocked");
    }

    const before = await getIdentityProvider().listAutoJoinRules(id).then((rules) => rules.find((r) => r.id === ruleId) ?? null);
    await getIdentityProvider().deleteAutoJoinRule({ companyId: id, ruleId });
    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "IamAutoJoinRule",
      entityId: ruleId,
      before: before
        ? {
            ruleType: before.ruleType,
            config: before.config,
            isEnabled: before.isEnabled,
          }
        : null,
      after: { deleted: true },
    });
    return ok({ deleted: true });
  } catch (error) {
    return err(error);
  }
}

import { getIdentityProvider, requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { autoJoinRuleSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requirePermission("admin.settings");
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant auto-join rules access blocked");
    }

    const rules = await getIdentityProvider().listAutoJoinRules(id);
    return ok(rules);
  } catch (error) {
    return err(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.settings");
    await requireStepUp();
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant auto-join rules update blocked");
    }
    const body = await parseBody(request, autoJoinRuleSchema);

    const rule = await getIdentityProvider().upsertAutoJoinRule({
      companyId: id,
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
      after: rule,
    });

    return ok(rule, { status: 201 });
  } catch (error) {
    return err(error);
  }
}

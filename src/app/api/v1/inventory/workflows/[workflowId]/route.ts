import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function DELETE(request: Request, props: { params: Promise<{ workflowId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { workflowId } = await props.params;
    await prisma.inventoryWorkflowDefinition.updateMany({
      where: {
        id: workflowId,
        companyId: ctx.companyId,
      },
      data: {
        isActive: false,
        updatedBy: ctx.userId,
      },
    });
    return jsonOk({ archived: true });
  });
}

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("admin.roles");
    const { id } = await params;
    void id;

    const permissions = await prisma.iamPermission.findMany({
      orderBy: [{ module: "asc" }, { key: "asc" }],
      select: {
        id: true,
        key: true,
        module: true,
        description: true,
        isSystem: true,
      },
    });

    return ok(permissions);
  } catch (error) {
    return err(error);
  }
}

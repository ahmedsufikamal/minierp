import { z } from "zod";
import { requirePlatformAdmin } from "@/modules/iam";
import { err, ok, parseSearch } from "@/modules/iam/interface/http";
import { listAdminUsers } from "@/modules/iam/application/user-admin.service";

const searchSchema = z.object({
  query: z.string().optional().default(""),
  platformRole: z.enum(["ALL", "SUPER_ADMIN", "SUPPORT", "NONE"]).optional().default("ALL"),
  status: z.enum(["ALL", "ACTIVE", "INVITED", "SUSPENDED", "DISABLED"]).optional().default("ALL"),
  companyId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const params = parseSearch(request, searchSchema);
    const data = await listAdminUsers(params);
    return ok(data);
  } catch (error) {
    return err(error);
  }
}

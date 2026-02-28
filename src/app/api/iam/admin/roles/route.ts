import { z } from "zod";
import { requirePlatformAdmin } from "@/modules/iam";
import { err, ok, parseSearch } from "@/modules/iam/interface/http";
import { listCompanyRoles } from "@/modules/iam/application/user-admin.service";

const searchSchema = z.object({
  companyId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const params = parseSearch(request, searchSchema);
    const data = await listCompanyRoles(params.companyId);
    return ok(data);
  } catch (error) {
    return err(error);
  }
}

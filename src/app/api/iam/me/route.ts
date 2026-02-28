import { requireAuth } from "@/modules/iam";
import { err, ok } from "@/modules/iam/interface/http";
import { getCurrentUserProfile } from "@/modules/iam/application/user-self.service";

export async function GET() {
  try {
    const principal = await requireAuth();
    const profile = await getCurrentUserProfile(principal);
    return ok(profile);
  } catch (error) {
    return err(error);
  }
}

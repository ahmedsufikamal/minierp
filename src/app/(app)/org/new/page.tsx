import { createOrgAction } from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAuthPage, requirePlatformAdminPage } from "@/modules/iam";
import { isSelfServeOrgCreationEnabled } from "@/modules/iam/application/feature-flags";

export default async function NewOrgPage() {
  if (isSelfServeOrgCreationEnabled()) {
    await requireAuthPage("/org/new");
  } else {
    await requirePlatformAdminPage("/org/new");
  }

  const submitCreateOrg = async (formData: FormData) => {
    "use server";
    await createOrgAction(formData);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create organization</h1>
        <p className="text-sm text-muted-foreground">Provision a new tenant and bootstrap its roles and policies.</p>
      </div>

      <form action={submitCreateOrg} className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">Organization name</label>
          <Input id="name" name="name" placeholder="Acme Corp" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="slug">Slug (optional)</label>
          <Input id="slug" name="slug" placeholder="acme-corp" />
        </div>
        <Button type="submit">Create organization</Button>
      </form>
    </div>
  );
}

import { requireAuthPage } from "@/modules/iam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UserSettingsApiPage() {
  await requireAuthPage("/settings/user/api");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Settings / User / API Access</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">API Access</h1>
        <p className="text-sm text-muted-foreground">Integration tokens and service credentials.</p>
      </div>
      <Card className="rounded-3xl border border-border shadow-sm">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">Token issuance remains delegated to the integrations surface in this pass.</p>
          <Button asChild variant="outline"><Link href="/integrations/api-tokens">Open API Tokens</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { requireAuthPage } from "@/modules/iam";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const connectionCards = [
  { title: "Google", description: "Third-party authentication placeholder." },
  { title: "Microsoft", description: "Enterprise connection placeholder." },
  { title: "Webhook Profiles", description: "Future outbound hooks and sync connectors." },
  { title: "SSO", description: "Federated login summary and status." },
] as const;

export default async function UserSettingsConnectionsPage() {
  await requireAuthPage("/settings/user/connections");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Settings / User / Connections</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Connections</h1>
        <p className="text-sm text-muted-foreground">External identity providers and connected services.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {connectionCards.map((card) => (
          <Card key={card.title} className="rounded-3xl border border-border shadow-sm">
            <CardContent className="space-y-2 p-5">
              <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

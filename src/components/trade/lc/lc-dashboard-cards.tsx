"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function LCDashboardCards({
  kpis,
}: {
  kpis: {
    openLcs: number;
    expiringSoon: number;
    discrepant: number;
    outstandingAmount: number;
  };
}) {
  const cards = [
    { label: "Open LCs", value: kpis.openLcs },
    { label: "Expiring Soon", value: kpis.expiringSoon },
    { label: "Discrepant", value: kpis.discrepant },
    { label: "Outstanding Amount", value: formatAmount(kpis.outstandingAmount) },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

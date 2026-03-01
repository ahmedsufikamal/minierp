"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TimelineItem = {
  id: string;
  eventType: string;
  message: string;
  actorUserId?: string | null;
  createdAt: string | Date;
};

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function LCTimeline({ rows }: { rows: TimelineItem[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{row.eventType.replaceAll("_", " ")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{row.message}</p>
            <p className="text-muted-foreground">
              {row.actorUserId ?? "System"} · {formatDate(row.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

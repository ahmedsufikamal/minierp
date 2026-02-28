"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type SessionTableItem = {
  id: string;
  maskedId: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  isCurrent?: boolean;
};

interface SessionsTableProps {
  sessions: SessionTableItem[];
  emptyLabel?: string;
  revokePendingId?: string | null;
  onRevoke?: (id: string) => void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function SessionsTable({ sessions, emptyLabel = "No active sessions.", revokePendingId, onRevoke }: SessionsTableProps) {
  if (!sessions.length) {
    return <div className="rounded-3xl border border-dashed border-border bg-[hsl(var(--surface-2))] px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{session.maskedId}</span>
                  {session.isCurrent ? <Badge variant="info">Current</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{session.userAgent || "Unknown device"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{session.ip || "Unknown IP"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatTimestamp(session.createdAt)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatTimestamp(session.lastSeenAt)}</TableCell>
              <TableCell className="text-right">
                {onRevoke ? (
                  <Button type="button" variant="outline" size="sm" disabled={revokePendingId === session.id} onClick={() => onRevoke(session.id)}>
                    {revokePendingId === session.id ? "Revoking..." : "Revoke"}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

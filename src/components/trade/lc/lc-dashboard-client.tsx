"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { LCDashboardCards } from "@/components/trade/lc/lc-dashboard-cards";
import { LCTable } from "@/components/trade/lc/lc-table";
import { LCStatusBadge } from "@/components/trade/lc/lc-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardResponse = {
  kpis: {
    openLcs: number;
    expiringSoon: number;
    discrepant: number;
    outstandingAmount: number;
  };
  expiringSoon: Array<{
    id?: string;
    displayLcNo: string;
    beneficiaryName: string;
    expiryDate: string;
    status: string;
  }>;
  documentsPending: Array<{
    id?: string;
    lcNo: string;
    supplier: string;
    shipmentRef?: string | null;
    status: string;
  }>;
  maturityUpcoming: Array<{
    id?: string;
    displayLcNo: string;
    beneficiaryName: string;
    maturityDate?: string | null;
    status: string;
  }>;
};

export function LCDashboardClient() {
  const dashboard = useQuery({
    queryKey: queryKeys.detail("trade", "lc-dashboard", "singleton"),
    queryFn: () => apiGet<DashboardResponse>("/api/v1/trade/lc/dashboard"),
  });

  const data = dashboard.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/trade/lc/new">New LC</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/trade/lc/register">LC Register</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/trade/lc/reports">Reports</Link>
        </Button>
      </div>

      <LCDashboardCards
        kpis={
          data?.kpis ?? {
            openLcs: 0,
            expiringSoon: 0,
            discrepant: 0,
            outstandingAmount: 0,
          }
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiring Next 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <LCTable
              rows={data?.expiringSoon ?? []}
              emptyLabel={dashboard.isLoading ? "Loading..." : "No expiring LCs."}
              columns={[
                { key: "displayLcNo", label: "LC", render: (row) => row.displayLcNo },
                { key: "beneficiaryName", label: "Supplier", render: (row) => row.beneficiaryName },
                { key: "expiryDate", label: "Expiry", render: (row) => new Date(row.expiryDate).toLocaleDateString() },
                { key: "status", label: "Status", render: (row) => <LCStatusBadge status={row.status} /> },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <LCTable
              rows={data?.documentsPending ?? []}
              emptyLabel={dashboard.isLoading ? "Loading..." : "No pending document sets."}
              columns={[
                { key: "lcNo", label: "LC", render: (row) => row.lcNo },
                { key: "supplier", label: "Supplier", render: (row) => row.supplier },
                { key: "shipmentRef", label: "Shipment", render: (row) => row.shipmentRef ?? "—" },
                { key: "status", label: "Status", render: (row) => <LCStatusBadge status={row.status} /> },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maturity Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <LCTable
              rows={data?.maturityUpcoming ?? []}
              emptyLabel={dashboard.isLoading ? "Loading..." : "No upcoming maturity."}
              columns={[
                { key: "displayLcNo", label: "LC", render: (row) => row.displayLcNo },
                { key: "beneficiaryName", label: "Supplier", render: (row) => row.beneficiaryName },
                { key: "maturityDate", label: "Maturity", render: (row) => row.maturityDate ? new Date(row.maturityDate).toLocaleDateString() : "—" },
                { key: "status", label: "Status", render: (row) => <LCStatusBadge status={row.status} /> },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

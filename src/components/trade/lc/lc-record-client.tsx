"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, ApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { RecordPageHeader } from "@/components/records/page-header";
import { RecordLayout } from "@/components/records/record-layout";
import { InspectorPanel } from "@/components/records/inspector-panel";
import { LCChargesTable } from "@/components/trade/lc/lc-charges-table";
import { LCConfirmDialog } from "@/components/trade/lc/lc-confirm-dialog";
import { LCDiscrepancyPanel } from "@/components/trade/lc/lc-discrepancy-panel";
import { LCDocChecklist } from "@/components/trade/lc/lc-doc-checklist";
import { LCForm } from "@/components/trade/lc/lc-form";
import { LCPaymentsTable } from "@/components/trade/lc/lc-payments-table";
import { LCStatusBadge } from "@/components/trade/lc/lc-status-badge";
import { lcRecordTabs } from "@/components/trade/lc/lc-tabs";
import { LCTable } from "@/components/trade/lc/lc-table";
import { LCTimeline } from "@/components/trade/lc/lc-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DetailResponse = {
  lc: Record<string, any>;
  actions: Record<string, boolean>;
  timeline: Array<Record<string, any>>;
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function LCRecordClient({ lcId }: { lcId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [actionDialog, setActionDialog] = useState<{
    action: "submit" | "approve" | "issue" | "cancel" | "close";
    title: string;
    description: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocsetId, setSelectedDocsetId] = useState<string>("");
  const [amendReason, setAmendReason] = useState("");
  const [amendJson, setAmendJson] = useState('{"remarks":"Updated via amendment"}');
  const [docsetShipmentRef, setDocsetShipmentRef] = useState("");
  const [discCode, setDiscCode] = useState("");
  const [discTitle, setDiscTitle] = useState("");
  const [discDescription, setDiscDescription] = useState("");
  const [chargeTypeCode, setChargeTypeCode] = useState("OTHER");
  const [chargeAmount, setChargeAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  const detail = useQuery({
    queryKey: queryKeys.detail("trade", "lc", lcId),
    queryFn: () => apiGet<DetailResponse>(`/api/v1/trade/lc/${lcId}`),
  });

  const lc = detail.data?.lc;
  const actions = detail.data?.actions ?? {};

  const formOptions = useQuery({
    queryKey: queryKeys.detail("trade", "lc-form-options", "singleton"),
    queryFn: () => apiGet<Record<string, any>>("/api/v1/trade/lc/form-options"),
    enabled: Boolean(actions.canEdit),
  });

  const amendments = useQuery({
    queryKey: queryKeys.list("trade", "lc-amendments", { lcId }),
    queryFn: () => apiGet<Record<string, any>>(`/api/v1/trade/lc/${lcId}/amendments`),
    enabled: activeTab === "amendments",
  });

  const docsets = useQuery({
    queryKey: queryKeys.list("trade", "lc-docsets", { lcId }),
    queryFn: () => apiGet<Record<string, any>>(`/api/v1/trade/lc/${lcId}/docsets`),
    enabled: activeTab === "documents",
  });

  const discrepancies = useQuery({
    queryKey: queryKeys.list("trade", "lc-discrepancies", { lcId }),
    queryFn: () => apiGet<Record<string, any>>(`/api/v1/trade/lc/${lcId}/discrepancies`),
    enabled: activeTab === "discrepancies",
  });

  const charges = useQuery({
    queryKey: queryKeys.list("trade", "lc-charges", { lcId }),
    queryFn: () => apiGet<Record<string, any>>(`/api/v1/trade/lc/${lcId}/charges`),
    enabled: activeTab === "charges-payments",
  });

  const payments = useQuery({
    queryKey: queryKeys.list("trade", "lc-payments", { lcId }),
    queryFn: () => apiGet<Record<string, any>>(`/api/v1/trade/lc/${lcId}/payments`),
    enabled: activeTab === "charges-payments",
  });

  useEffect(() => {
    if (!selectedDocsetId && docsets.data?.rows?.[0]?.id) {
      setSelectedDocsetId(docsets.data.rows[0].id as string);
    }
  }, [docsets.data, selectedDocsetId]);

  const docsetDetail = useQuery({
    queryKey: queryKeys.detail("trade", "lc-docset", selectedDocsetId || "none"),
    queryFn: () => apiGet<Record<string, any>>(`/api/v1/trade/lc/docsets/${selectedDocsetId}`),
    enabled: activeTab === "documents" && Boolean(selectedDocsetId),
  });

  async function refreshAll() {
    await Promise.all([
      detail.refetch(),
      amendments.refetch(),
      docsets.refetch(),
      discrepancies.refetch(),
      charges.refetch(),
      payments.refetch(),
      docsetDetail.refetch(),
    ]);
    await queryClient.invalidateQueries({ queryKey: queryKeys.module("trade") });
  }

  async function runAction(action: string) {
    if (!lc) return;
    setError(null);
    try {
      await apiPost(`/api/v1/trade/lc/${lcId}/${action}`, { version: lc.version });
      await refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to run action");
      }
    }
  }

  async function saveDraft(payload: Record<string, unknown>) {
    if (!lc) return;
    setError(null);
    try {
      await apiPatch(`/api/v1/trade/lc/${lcId}`, {
        ...payload,
        version: lc.version,
      });
      await refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save draft");
      }
    }
  }

  async function createAmendment() {
    setError(null);
    try {
      await apiPost(`/api/v1/trade/lc/${lcId}/amendments`, {
        amendmentDate: new Date().toISOString(),
        reason: amendReason,
        changesJson: JSON.parse(amendJson),
      });
      setAmendReason("");
      await amendments.refetch();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  async function createDocset() {
    setError(null);
    try {
      await apiPost(`/api/v1/trade/lc/${lcId}/docsets`, {
        shipmentRef: docsetShipmentRef || undefined,
      });
      setDocsetShipmentRef("");
      await docsets.refetch();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create document set");
      }
    }
  }

  async function createDiscrepancy() {
    setError(null);
    try {
      await apiPost(`/api/v1/trade/lc/${lcId}/discrepancies`, {
        code: discCode,
        title: discTitle,
        description: discDescription,
        severity: "MEDIUM",
      });
      setDiscCode("");
      setDiscTitle("");
      setDiscDescription("");
      await refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create discrepancy");
      }
    }
  }

  async function createCharge() {
    setError(null);
    try {
      await apiPost(`/api/v1/trade/lc/${lcId}/charges`, {
        chargeTypeCode,
        amount: Number(chargeAmount),
        currency: lc?.currency ?? "USD",
        chargedBy: "BANK",
        chargeDate: new Date().toISOString(),
      });
      setChargeAmount("");
      await charges.refetch();
      await detail.refetch();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create charge");
      }
    }
  }

  async function createPayment() {
    setError(null);
    try {
      await apiPost(`/api/v1/trade/lc/${lcId}/payments`, {
        paymentType: "SETTLEMENT",
        amount: Number(paymentAmount),
        currency: lc?.currency ?? "USD",
        method: "BANK_TRANSFER",
        status: "INITIATED",
        paymentDate: new Date().toISOString(),
      });
      setPaymentAmount("");
      await payments.refetch();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create payment");
      }
    }
  }

  const headerActions = (
    <>
      {actions.canSubmit ? <Button type="button" variant="outline" onClick={() => setActionDialog({ action: "submit", title: "Submit LC", description: "Move this draft LC to REQUESTED." })}>Submit</Button> : null}
      {actions.canApprove ? <Button type="button" variant="outline" onClick={() => setActionDialog({ action: "approve", title: "Approve LC", description: "Approve this requested LC under dual control." })}>Approve</Button> : null}
      {actions.canIssue ? <Button type="button" onClick={() => setActionDialog({ action: "issue", title: "Issue LC", description: "Issue this approved LC and allocate the final LC number." })}>Issue</Button> : null}
      {actions.canCancel ? <Button type="button" variant="outline" onClick={() => setActionDialog({ action: "cancel", title: "Cancel LC", description: "Cancel this draft/requested/approved LC." })}>Cancel</Button> : null}
      {actions.canClose ? <Button type="button" variant="outline" onClick={() => setActionDialog({ action: "close", title: "Close LC", description: "Close this fully settled LC." })}>Close</Button> : null}
    </>
  );

  const detailsContent = actions.canEdit ? (
    <LCForm
      options={formOptions.data ?? {}}
      initialValue={lc ?? {}}
      pending={detail.isFetching}
      error={error}
      onSubmit={saveDraft}
    />
  ) : (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ["Beneficiary", lc?.beneficiaryName],
        ["Issuing Bank", lc?.issuingBankName],
        ["Amount", lc ? formatCurrency(Number(lc.lcAmount ?? 0), lc.currency) : "—"],
        ["Outstanding", lc ? formatCurrency(Number(lc.outstandingAmount ?? 0), lc.currency) : "—"],
        ["Expiry", lc?.expiryDate ? new Date(lc.expiryDate).toLocaleDateString() : "—"],
        ["Latest Shipment", lc?.latestShipmentDate ? new Date(lc.latestShipmentDate).toLocaleDateString() : "—"],
      ].map(([label, value]) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>{value ?? "—"}</CardContent>
        </Card>
      ))}
    </div>
  );

  const amendmentsRows = (amendments.data?.rows ?? []) as Array<any>;
  const documentsRows = (docsets.data?.rows ?? []) as Array<any>;
  const discrepancyRows = (discrepancies.data?.rows ?? []) as Array<any>;
  const chargeRows = (charges.data?.rows ?? []) as Array<any>;
  const paymentRows = (payments.data?.rows ?? []) as Array<any>;

  const tabMain = activeTab === "details"
    ? detailsContent
    : activeTab === "amendments"
      ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Amendment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={amendReason} onChange={(e) => setAmendReason(e.target.value)} placeholder="Reason" />
                <textarea
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={amendJson}
                  onChange={(e) => setAmendJson(e.target.value)}
                />
                <Button type="button" onClick={() => void createAmendment()} disabled={!amendReason}>
                  Add Amendment
                </Button>
              </CardContent>
            </Card>
            <LCTable
              rows={amendmentsRows}
              emptyLabel={amendments.isLoading ? "Loading..." : "No amendments."}
              columns={[
                { key: "amendmentNo", label: "No", render: (row) => row.amendmentNo },
                { key: "amendmentDate", label: "Date", render: (row) => new Date(row.amendmentDate).toLocaleDateString() },
                { key: "reason", label: "Reason", render: (row) => row.reason },
                { key: "status", label: "Status", render: (row) => <LCStatusBadge status={row.status} /> },
              ]}
            />
          </div>
        )
      : activeTab === "documents"
        ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Document Sets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Input value={docsetShipmentRef} onChange={(e) => setDocsetShipmentRef(e.target.value)} placeholder="Shipment reference" className="max-w-sm" />
                    <Button type="button" onClick={() => void createDocset()}>Create Doc Set</Button>
                    {selectedDocsetId ? (
                      <>
                        <Button type="button" variant="outline" onClick={() => void apiPost(`/api/v1/trade/lc/docsets/${selectedDocsetId}/verify`, {}).then(() => refreshAll())}>
                          Verify
                        </Button>
                        <Button type="button" variant="outline" onClick={() => void apiPost(`/api/v1/trade/lc/docsets/${selectedDocsetId}/mark-discrepant`, {}).then(() => refreshAll())}>
                          Mark Discrepant
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <LCTable
                    rows={documentsRows}
                    emptyLabel={docsets.isLoading ? "Loading..." : "No document sets."}
                    onRowClick={(row) => row.id && setSelectedDocsetId(row.id)}
                    columns={[
                      { key: "shipmentRef", label: "Shipment", render: (row) => row.shipmentRef ?? "—" },
                      { key: "status", label: "Status", render: (row) => <LCStatusBadge status={row.status} /> },
                      { key: "requiredCount", label: "Required", render: (row) => row.requiredCount },
                      { key: "receivedCount", label: "Received", render: (row) => row.receivedCount },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <LCDocChecklist rows={(docsetDetail.data?.documentLines ?? []) as Array<any>} />
                </CardContent>
              </Card>
            </div>
          )
        : activeTab === "discrepancies"
          ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Log Discrepancy</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Input value={discCode} onChange={(e) => setDiscCode(e.target.value)} placeholder="Code" />
                    <Input value={discTitle} onChange={(e) => setDiscTitle(e.target.value)} placeholder="Title" />
                    <textarea
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={discDescription}
                      onChange={(e) => setDiscDescription(e.target.value)}
                      placeholder="Description"
                    />
                    <Button type="button" onClick={() => void createDiscrepancy()} disabled={!discCode || !discTitle || !discDescription}>
                      Add Discrepancy
                    </Button>
                  </CardContent>
                </Card>
                <LCDiscrepancyPanel rows={discrepancyRows} />
              </div>
            )
          : activeTab === "charges-payments"
            ? (
                <div className="grid gap-5 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Charges</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <Input value={chargeTypeCode} onChange={(e) => setChargeTypeCode(e.target.value)} placeholder="Charge type" />
                        <Input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Amount" />
                        <Button type="button" onClick={() => void createCharge()} disabled={!chargeAmount}>
                          Add
                        </Button>
                      </div>
                      <LCChargesTable rows={chargeRows} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Payments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <Input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Settlement amount" />
                        <Button type="button" onClick={() => void createPayment()} disabled={!paymentAmount}>
                          Add
                        </Button>
                      </div>
                      <LCPaymentsTable rows={paymentRows} />
                    </CardContent>
                  </Card>
                </div>
              )
            : <LCTimeline rows={(detail.data?.timeline ?? []) as Array<any>} />;

  const inspector = (
    <InspectorPanel
      title={lc?.displayLcNo ?? "LC"}
      subtitle={lc ? `${lc.beneficiaryName} · ${lc.issuingBankName}` : "Loading..."}
      initials="LC"
      quickActions={[
        { label: "Open Register", disabled: false },
        { label: "Open Reports", disabled: false },
        { label: "Review Documents", disabled: !selectedDocsetId },
      ]}
      meta={[
        { label: "Applicant", value: lc?.applicantPartyId ?? "—" },
        { label: "Beneficiary", value: lc?.beneficiaryName ?? "—" },
        { label: "Expiry", value: lc?.expiryDate ? new Date(lc.expiryDate).toLocaleDateString() : "—" },
        { label: "Created By", value: lc?.createdBy ?? "—" },
        { label: "Updated By", value: lc?.updatedBy ?? "—" },
      ]}
    />
  );

  return (
    <div className="space-y-5">
      <RecordPageHeader
        breadcrumbs={
          <span>
            <Link href="/trade/lc" className="hover:underline">Trade Finance</Link> /{" "}
            <Link href="/trade/lc/register" className="hover:underline">LC</Link> / {lc?.displayLcNo ?? "Loading"}
          </span>
        }
        title={lc?.displayLcNo ?? "Loading LC"}
        subtitle={lc ? `${lc.beneficiaryName} · ${lc.issuingBankName}` : "Loading..."}
        status={lc ? { label: lc.status.replaceAll("_", " ") } : undefined}
        actions={headerActions}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <RecordLayout
        tabs={lcRecordTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        main={tabMain}
        inspector={inspector}
      />

      <LCConfirmDialog
        open={Boolean(actionDialog)}
        onOpenChange={(open) => !open && setActionDialog(null)}
        title={actionDialog?.title ?? ""}
        description={actionDialog?.description ?? ""}
        confirmLabel="Confirm"
        onConfirm={async () => {
          if (actionDialog) {
            await runAction(actionDialog.action);
          }
          setActionDialog(null);
        }}
      />
    </div>
  );
}

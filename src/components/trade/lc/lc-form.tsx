"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FormOptions = {
  vendors?: Array<{ id: string; name: string }>;
  banks?: Array<{ id: string; name: string }>;
  incoterms?: Array<{ code: string; name: string }>;
  documentTypes?: Array<{ id: string; code: string; name: string }>;
  currencies?: Array<{ code: string; name: string }>;
  purchaseOrders?: Array<{ id: string; number: string; vendorName?: string }>;
};

export type LcFormValue = {
  beneficiaryVendorId?: string;
  issuingBankId?: string;
  advisingBankId?: string | null;
  confirmingBankId?: string | null;
  currency?: string;
  lcAmount?: number;
  latestShipmentDate?: string | null;
  expiryDate?: string | null;
  placeOfExpiry?: string | null;
  shipmentFrom?: string | null;
  shipmentTo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  incotermCode?: string | null;
  remarks?: string | null;
  termsText?: string | null;
  poLinks?: Array<{
    purchaseOrderId: string;
    coveredAmount: number;
    coveredCurrency: string;
  }>;
};

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function LCForm({
  options,
  initialValue,
  readOnly = false,
  submitLabel = "Save Draft",
  secondaryLabel,
  pending = false,
  error,
  onSubmit,
  onSecondarySubmit,
}: {
  options: FormOptions;
  initialValue?: LcFormValue;
  readOnly?: boolean;
  submitLabel?: string;
  secondaryLabel?: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void> | void;
  onSecondarySubmit?: (payload: Record<string, unknown>) => Promise<void> | void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [issuingBankId, setIssuingBankId] = useState("");
  const [advisingBankId, setAdvisingBankId] = useState("");
  const [confirmingBankId, setConfirmingBankId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [latestShipmentDate, setLatestShipmentDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [placeOfExpiry, setPlaceOfExpiry] = useState("");
  const [shipmentFrom, setShipmentFrom] = useState("");
  const [shipmentTo, setShipmentTo] = useState("");
  const [portOfLoading, setPortOfLoading] = useState("");
  const [portOfDischarge, setPortOfDischarge] = useState("");
  const [incotermCode, setIncotermCode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [termsText, setTermsText] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [coveredAmount, setCoveredAmount] = useState("");
  const [coveredCurrency, setCoveredCurrency] = useState("USD");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setVendorId(initialValue?.beneficiaryVendorId ?? "");
      setIssuingBankId(initialValue?.issuingBankId ?? "");
      setAdvisingBankId(initialValue?.advisingBankId ?? "");
      setConfirmingBankId(initialValue?.confirmingBankId ?? "");
      setCurrency(initialValue?.currency ?? "USD");
      setAmount(initialValue?.lcAmount ? String(initialValue.lcAmount) : "");
      setLatestShipmentDate(dateInputValue(initialValue?.latestShipmentDate));
      setExpiryDate(dateInputValue(initialValue?.expiryDate));
      setPlaceOfExpiry(initialValue?.placeOfExpiry ?? "");
      setShipmentFrom(initialValue?.shipmentFrom ?? "");
      setShipmentTo(initialValue?.shipmentTo ?? "");
      setPortOfLoading(initialValue?.portOfLoading ?? "");
      setPortOfDischarge(initialValue?.portOfDischarge ?? "");
      setIncotermCode(initialValue?.incotermCode ?? "");
      setRemarks(initialValue?.remarks ?? "");
      setTermsText(initialValue?.termsText ?? "");
      setPurchaseOrderId(initialValue?.poLinks?.[0]?.purchaseOrderId ?? "");
      setCoveredAmount(
        initialValue?.poLinks?.[0]?.coveredAmount
          ? String(initialValue.poLinks[0].coveredAmount)
          : "",
      );
      setCoveredCurrency(initialValue?.poLinks?.[0]?.coveredCurrency ?? initialValue?.currency ?? "USD");
    });
    return () => {
      cancelled = true;
    };
  }, [initialValue]);

  const defaultDocs = useMemo(
    () => (options.documentTypes ?? []).filter((item) => item).map((item) => item.name),
    [options.documentTypes],
  );

  function buildPayload() {
    return {
      lcType: "IMPORT",
      beneficiaryVendorId: vendorId,
      issuingBankId,
      advisingBankId: advisingBankId || undefined,
      confirmingBankId: confirmingBankId || undefined,
      currency,
      lcAmount: amount ? Number(amount) : 0,
      latestShipmentDate: latestShipmentDate || undefined,
      expiryDate: expiryDate || undefined,
      placeOfExpiry: placeOfExpiry || undefined,
      shipmentFrom: shipmentFrom || undefined,
      shipmentTo: shipmentTo || undefined,
      portOfLoading: portOfLoading || undefined,
      portOfDischarge: portOfDischarge || undefined,
      incotermCode: incotermCode || undefined,
      remarks: remarks || undefined,
      termsText: termsText || undefined,
      linkedPurchaseOrders:
        purchaseOrderId && coveredAmount
          ? [
              {
                purchaseOrderId,
                coveredAmount: Number(coveredAmount),
                coveredCurrency,
              },
            ]
          : [],
    };
  }

  const selectClassName =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";

  const textareaClassName =
    "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Counterparty and Banks</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vendorId">Beneficiary</Label>
              <select id="vendorId" className={selectClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={readOnly || pending}>
                <option value="">Select supplier</option>
                {(options.vendors ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issuingBankId">Issuing Bank</Label>
              <select id="issuingBankId" className={selectClassName} value={issuingBankId} onChange={(e) => setIssuingBankId(e.target.value)} disabled={readOnly || pending}>
                <option value="">Select bank</option>
                {(options.banks ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="advisingBankId">Advising Bank</Label>
              <select id="advisingBankId" className={selectClassName} value={advisingBankId} onChange={(e) => setAdvisingBankId(e.target.value)} disabled={readOnly || pending}>
                <option value="">Optional</option>
                {(options.banks ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmingBankId">Confirming Bank</Label>
              <select id="confirmingBankId" className={selectClassName} value={confirmingBankId} onChange={(e) => setConfirmingBankId(e.target.value)} disabled={readOnly || pending}>
                <option value="">Optional</option>
                {(options.banks ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Amount and Terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <select id="currency" className={selectClassName} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={readOnly || pending}>
                  {(options.currencies ?? []).length === 0 ? <option value="USD">USD</option> : null}
                  {(options.currencies ?? []).map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">LC Amount</Label>
                <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={readOnly || pending} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="incoterm">Incoterm</Label>
              <select id="incoterm" className={selectClassName} value={incotermCode} onChange={(e) => setIncotermCode(e.target.value)} disabled={readOnly || pending}>
                <option value="">Optional</option>
                {(options.incoterms ?? []).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="termsText">Terms</Label>
              <textarea id="termsText" className={textareaClassName} value={termsText} onChange={(e) => setTermsText(e.target.value)} disabled={readOnly || pending} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment and Expiry</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="latestShipmentDate">Latest Shipment Date</Label>
                <Input id="latestShipmentDate" type="date" value={latestShipmentDate} onChange={(e) => setLatestShipmentDate(e.target.value)} disabled={readOnly || pending} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={readOnly || pending} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="placeOfExpiry">Place of Expiry</Label>
              <Input id="placeOfExpiry" value={placeOfExpiry} onChange={(e) => setPlaceOfExpiry(e.target.value)} disabled={readOnly || pending} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="shipmentFrom">Shipment From</Label>
                <Input id="shipmentFrom" value={shipmentFrom} onChange={(e) => setShipmentFrom(e.target.value)} disabled={readOnly || pending} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shipmentTo">Shipment To</Label>
                <Input id="shipmentTo" value={shipmentTo} onChange={(e) => setShipmentTo(e.target.value)} disabled={readOnly || pending} />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="portOfLoading">Port of Loading</Label>
                <Input id="portOfLoading" value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} disabled={readOnly || pending} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                <Input id="portOfDischarge" value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} disabled={readOnly || pending} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked PO and Checklist</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="purchaseOrderId">Linked Purchase Order</Label>
              <select id="purchaseOrderId" className={selectClassName} value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} disabled={readOnly || pending}>
                <option value="">Optional</option>
                {(options.purchaseOrders ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.number} {option.vendorName ? `· ${option.vendorName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="coveredAmount">Covered Amount</Label>
                <Input id="coveredAmount" value={coveredAmount} onChange={(e) => setCoveredAmount(e.target.value)} disabled={readOnly || pending || !purchaseOrderId} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coveredCurrency">Covered Currency</Label>
                <Input id="coveredCurrency" value={coveredCurrency} onChange={(e) => setCoveredCurrency(e.target.value)} disabled={readOnly || pending || !purchaseOrderId} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remarks">Remarks</Label>
              <textarea id="remarks" className={textareaClassName} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={readOnly || pending} />
            </div>
            <div className="rounded-2xl border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Default Required Documents
              </p>
              <ul className="space-y-1 text-sm">
                {defaultDocs.length === 0 ? <li className="text-muted-foreground">No document templates loaded.</li> : null}
                {defaultDocs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onSubmit(buildPayload())} disabled={readOnly || pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
        {secondaryLabel && onSecondarySubmit ? (
          <Button type="button" variant="outline" onClick={() => void onSecondarySubmit(buildPayload())} disabled={readOnly || pending}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

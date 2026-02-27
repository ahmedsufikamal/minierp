"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type SettingsTab =
  | "defaults"
  | "stock-validations"
  | "stock-reservation"
  | "serial-batch-item"
  | "stock-planning"
  | "stock-closing";

type StockSettingsDto = {
  item_naming_by: "ITEM_CODE" | "NAMING_SERIES";
  default_warehouse_id: string | null;
  default_stock_uom_id: string | null;
  default_valuation_method: "FIFO" | "MOVING_AVERAGE" | "STANDARD";
  auto_insert_item_price_if_missing: boolean;
  update_existing_price_list_rate: boolean;
  allow_edit_stock_uom_qty_sales_docs: boolean;
  allow_edit_stock_uom_qty_purchase_docs: boolean;
  over_delivery_receipt_allowance_pct: number;
  over_transfer_allowance_pct: number;
  over_picking_allowance_pct: number;
  allow_negative_stock: boolean;
  show_barcode_field_in_stock_transactions: boolean;
  convert_item_description_to_clean_html: boolean;
  allow_internal_transfers_at_arms_length_price: boolean;
  qi_action_if_not_submitted: "STOP" | "WARN" | "ALLOW";
  qi_action_if_rejected: "STOP" | "WARN" | "ALLOW";
  enable_stock_reservation: boolean;
  allow_partial_reservation: boolean;
  auto_reserve_stock_for_sales_order_on_purchase: boolean;
  auto_reserve_serial_and_batch_nos: boolean;
  auto_create_serial_and_batch_bundle_for_outward: boolean;
  pick_serial_batch_based_on: "FIFO" | "LIFO" | "EXPIRY";
  disable_serial_no_and_batch_selector: boolean;
  have_default_naming_series_for_batch_id: boolean;
  use_serial_batch_fields: boolean;
  do_not_update_serial_batch_on_creation_of_auto_bundle: boolean;
  allow_existing_serial_no_to_be_received_again: boolean;
  set_bundle_naming_based_on_naming_series: boolean;
  raise_material_request_when_stock_reaches_reorder_level: boolean;
  notify_by_email_on_creation_of_automatic_material_request: boolean;
  allow_material_transfer_from_delivery_note_to_sales_invoice: boolean;
  allow_material_transfer_from_purchase_receipt_to_purchase_invoice: boolean;
  freeze_stocks_older_than_days: number;
  version: number;
  updated_at: string;
};

type Envelope =
  | { ok: true; data: StockSettingsDto }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "defaults", label: "Defaults" },
  { id: "stock-validations", label: "Stock Validations" },
  { id: "stock-reservation", label: "Stock Reservation" },
  { id: "serial-batch-item", label: "Serial & Batch Item" },
  { id: "stock-planning", label: "Stock Planning" },
  { id: "stock-closing", label: "Stock Closing" },
];

function pct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function freezeDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizePayload(input: StockSettingsDto): StockSettingsDto {
  return {
    ...input,
    default_warehouse_id: input.default_warehouse_id?.trim() ? input.default_warehouse_id.trim() : null,
    default_stock_uom_id: input.default_stock_uom_id?.trim() ? input.default_stock_uom_id.trim() : null,
    over_delivery_receipt_allowance_pct: pct(input.over_delivery_receipt_allowance_pct),
    over_transfer_allowance_pct: pct(input.over_transfer_allowance_pct),
    over_picking_allowance_pct: pct(input.over_picking_allowance_pct),
    freeze_stocks_older_than_days: freezeDays(input.freeze_stocks_older_than_days),
  };
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function Toggle({
  name,
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  name: keyof StockSettingsDto;
  label: string;
  description?: string;
  value: boolean;
  disabled: boolean;
  onChange: (name: keyof StockSettingsDto, value: boolean) => void;
}) {
  return (
    <label className={cn("surface-2 block p-3", disabled && "opacity-80")}>
      <span className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value}
          disabled={disabled}
          onChange={(event) => onChange(name, event.target.checked)}
        />
        {label}
      </span>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
      />
    </label>
  );
}

export function InventorySettingsClient({ canEdit }: { canEdit: boolean }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("defaults");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<StockSettingsDto | null>(null);
  const [draft, setDraft] = useState<StockSettingsDto | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/stock/settings", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Envelope;
        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Failed to load stock settings" : body.error?.message || "Failed to load stock settings");
        }
        return body.data;
      })
      .then((data) => {
        if (!alive) return;
        const normalized = normalizePayload(data);
        setSaved(normalized);
        setDraft(normalized);
      })
      .catch((loadError: unknown) => {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load stock settings");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [saved, draft]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      if (!window.confirm("You have unsaved stock settings changes. Leave without saving?")) {
        event.preventDefault();
      }
    };
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [dirty]);

  const setField = <T extends keyof StockSettingsDto>(field: T, value: StockSettingsDto[T]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const save = async () => {
    if (!draft || !saved || !canEdit) return;
    setSaving(true);
    setError(null);
    const normalized = normalizePayload(draft);
    const payload = { ...normalized, version: saved.version };

    const response = await fetch("/api/stock/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "if-match": String(saved.version),
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => ({}))) as Envelope;
    if (!response.ok || !body.ok) {
      const message = body.ok ? "Failed to save stock settings" : body.error?.message || "Failed to save stock settings";
      setError(message);
      toast.error(message);
      setSaving(false);
      return;
    }

    const next = normalizePayload(body.data);
    setSaved(next);
    setDraft(next);
    setSaving(false);
    toast.success("Stock settings updated");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="surface-1 h-10 animate-pulse" />
        <div className="surface-1 h-56 animate-pulse" />
      </div>
    );
  }

  if (!draft) {
    return <ErrorText message={error || "Unable to load stock settings"} />;
  }

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <div className="state-warning rounded-md border px-3 py-2 text-sm">
          Read-only mode: you do not have permission to update Stock Settings.
        </div>
      ) : null}

      <div className="surface-1 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <ErrorText message={error} />

      {activeTab === "defaults" ? (
        <section className="surface-1 grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Item naming by</span>
            <select
              value={draft.item_naming_by}
              disabled={!canEdit}
              onChange={(event) => setField("item_naming_by", event.target.value as StockSettingsDto["item_naming_by"])}
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            >
              <option value="ITEM_CODE">ITEM_CODE</option>
              <option value="NAMING_SERIES">NAMING_SERIES</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Default valuation method</span>
            <select
              value={draft.default_valuation_method}
              disabled={!canEdit}
              onChange={(event) =>
                setField("default_valuation_method", event.target.value as StockSettingsDto["default_valuation_method"])
              }
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            >
              <option value="FIFO">FIFO</option>
              <option value="MOVING_AVERAGE">MOVING_AVERAGE</option>
              <option value="STANDARD">STANDARD</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Default warehouse ID</span>
            <input
              value={draft.default_warehouse_id ?? ""}
              disabled={!canEdit}
              onChange={(event) => setField("default_warehouse_id", event.target.value || null)}
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Default stock UOM ID</span>
            <input
              value={draft.default_stock_uom_id ?? ""}
              disabled={!canEdit}
              onChange={(event) => setField("default_stock_uom_id", event.target.value || null)}
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            />
          </label>
          <Toggle
            name="auto_insert_item_price_if_missing"
            label="Auto insert item price if missing"
            value={draft.auto_insert_item_price_if_missing}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="update_existing_price_list_rate"
            label="Update existing price list rate"
            value={draft.update_existing_price_list_rate}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_edit_stock_uom_qty_sales_docs"
            label="Allow edit stock UOM qty in sales docs"
            value={draft.allow_edit_stock_uom_qty_sales_docs}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_edit_stock_uom_qty_purchase_docs"
            label="Allow edit stock UOM qty in purchase docs"
            value={draft.allow_edit_stock_uom_qty_purchase_docs}
            disabled={!canEdit}
            onChange={setField}
          />
        </section>
      ) : null}

      {activeTab === "stock-validations" ? (
        <section className="surface-1 grid gap-3 p-4 sm:grid-cols-2">
          <NumberInput
            label="Over delivery/receipt allowance (%)"
            value={draft.over_delivery_receipt_allowance_pct}
            min={0}
            max={100}
            disabled={!canEdit}
            onChange={(value) => setField("over_delivery_receipt_allowance_pct", pct(value))}
          />
          <NumberInput
            label="Over transfer allowance (%)"
            value={draft.over_transfer_allowance_pct}
            min={0}
            max={100}
            disabled={!canEdit}
            onChange={(value) => setField("over_transfer_allowance_pct", pct(value))}
          />
          <NumberInput
            label="Over picking allowance (%)"
            value={draft.over_picking_allowance_pct}
            min={0}
            max={100}
            disabled={!canEdit}
            onChange={(value) => setField("over_picking_allowance_pct", pct(value))}
          />
          <div />
          <Toggle
            name="allow_negative_stock"
            label="Allow negative stock"
            value={draft.allow_negative_stock}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="show_barcode_field_in_stock_transactions"
            label="Show barcode field in stock transactions"
            value={draft.show_barcode_field_in_stock_transactions}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="convert_item_description_to_clean_html"
            label="Convert item description to clean HTML"
            value={draft.convert_item_description_to_clean_html}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_internal_transfers_at_arms_length_price"
            label="Allow internal transfers at arms length price"
            value={draft.allow_internal_transfers_at_arms_length_price}
            disabled={!canEdit}
            onChange={setField}
          />
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">QI action if not submitted</span>
            <select
              value={draft.qi_action_if_not_submitted}
              disabled={!canEdit}
              onChange={(event) =>
                setField("qi_action_if_not_submitted", event.target.value as StockSettingsDto["qi_action_if_not_submitted"])
              }
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            >
              <option value="STOP">STOP</option>
              <option value="WARN">WARN</option>
              <option value="ALLOW">ALLOW</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">QI action if rejected</span>
            <select
              value={draft.qi_action_if_rejected}
              disabled={!canEdit}
              onChange={(event) =>
                setField("qi_action_if_rejected", event.target.value as StockSettingsDto["qi_action_if_rejected"])
              }
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            >
              <option value="STOP">STOP</option>
              <option value="WARN">WARN</option>
              <option value="ALLOW">ALLOW</option>
            </select>
          </label>
        </section>
      ) : null}

      {activeTab === "stock-reservation" ? (
        <section className="surface-1 grid gap-3 p-4 sm:grid-cols-2">
          <Toggle
            name="enable_stock_reservation"
            label="Enable stock reservation"
            value={draft.enable_stock_reservation}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_partial_reservation"
            label="Allow partial reservation"
            value={draft.allow_partial_reservation}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="auto_reserve_stock_for_sales_order_on_purchase"
            label="Auto reserve stock for sales order on purchase"
            value={draft.auto_reserve_stock_for_sales_order_on_purchase}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="auto_reserve_serial_and_batch_nos"
            label="Auto reserve serial and batch numbers"
            value={draft.auto_reserve_serial_and_batch_nos}
            disabled={!canEdit}
            onChange={setField}
          />
        </section>
      ) : null}

      {activeTab === "serial-batch-item" ? (
        <section className="surface-1 grid gap-3 p-4 sm:grid-cols-2">
          <Toggle
            name="auto_create_serial_and_batch_bundle_for_outward"
            label="Auto create serial & batch bundle for outward"
            value={draft.auto_create_serial_and_batch_bundle_for_outward}
            disabled={!canEdit}
            onChange={setField}
          />
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Pick serial/batch based on</span>
            <select
              value={draft.pick_serial_batch_based_on}
              disabled={!canEdit}
              onChange={(event) =>
                setField("pick_serial_batch_based_on", event.target.value as StockSettingsDto["pick_serial_batch_based_on"])
              }
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 text-sm"
            >
              <option value="FIFO">FIFO</option>
              <option value="LIFO">LIFO</option>
              <option value="EXPIRY">EXPIRY</option>
            </select>
          </label>
          <Toggle
            name="disable_serial_no_and_batch_selector"
            label="Disable serial no. and batch selector"
            value={draft.disable_serial_no_and_batch_selector}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="have_default_naming_series_for_batch_id"
            label="Have default naming series for batch ID"
            value={draft.have_default_naming_series_for_batch_id}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="use_serial_batch_fields"
            label="Use serial & batch fields"
            value={draft.use_serial_batch_fields}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="do_not_update_serial_batch_on_creation_of_auto_bundle"
            label="Do not update serial/batch on auto bundle creation"
            value={draft.do_not_update_serial_batch_on_creation_of_auto_bundle}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_existing_serial_no_to_be_received_again"
            label="Allow existing serial no. to be received again"
            description="Use carefully. This can introduce duplicate serial history if controls are weak."
            value={draft.allow_existing_serial_no_to_be_received_again}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="set_bundle_naming_based_on_naming_series"
            label="Set bundle naming based on naming series"
            value={draft.set_bundle_naming_based_on_naming_series}
            disabled={!canEdit}
            onChange={setField}
          />
        </section>
      ) : null}

      {activeTab === "stock-planning" ? (
        <section className="surface-1 grid gap-3 p-4 sm:grid-cols-2">
          <Toggle
            name="raise_material_request_when_stock_reaches_reorder_level"
            label="Raise material request at reorder level"
            value={draft.raise_material_request_when_stock_reaches_reorder_level}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="notify_by_email_on_creation_of_automatic_material_request"
            label="Email on automatic material request"
            value={draft.notify_by_email_on_creation_of_automatic_material_request}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_material_transfer_from_delivery_note_to_sales_invoice"
            label="Allow transfer: Delivery Note -> Sales Invoice"
            value={draft.allow_material_transfer_from_delivery_note_to_sales_invoice}
            disabled={!canEdit}
            onChange={setField}
          />
          <Toggle
            name="allow_material_transfer_from_purchase_receipt_to_purchase_invoice"
            label="Allow transfer: Purchase Receipt -> Purchase Invoice"
            value={draft.allow_material_transfer_from_purchase_receipt_to_purchase_invoice}
            disabled={!canEdit}
            onChange={setField}
          />
        </section>
      ) : null}

      {activeTab === "stock-closing" ? (
        <section className="surface-1 grid gap-3 p-4 sm:grid-cols-2">
          <NumberInput
            label="Freeze stocks older than days"
            value={draft.freeze_stocks_older_than_days}
            min={0}
            disabled={!canEdit}
            onChange={(value) => setField("freeze_stocks_older_than_days", freezeDays(value))}
          />
          <div className="surface-2 p-3 text-xs text-muted-foreground">
            Backdated stock document edits, submissions, and postings older than this threshold are blocked.
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Version: {draft.version} {draft.updated_at ? `· Updated ${new Date(draft.updated_at).toLocaleString()}` : ""}
        </p>
        <Button type="button" onClick={save} disabled={!canEdit || !dirty || saving}>
          {saving ? "Saving..." : "Save Stock Settings"}
        </Button>
      </div>
    </div>
  );
}

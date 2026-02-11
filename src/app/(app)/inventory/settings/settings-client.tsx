"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Field = {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  showInList: boolean;
  isActive: boolean;
};

type Workflow = {
  id: string;
  documentType: string;
  name: string;
  version: number;
  isActive: boolean;
  config: unknown;
};

type LabelTemplate = {
  id: string;
  name: string;
  paperType: string;
  isDefault: boolean;
};

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function InventorySettingsClient({
  fields,
  workflows,
  labelTemplates,
}: {
  fields: Field[];
  workflows: Workflow[];
  labelTemplates: LabelTemplate[];
}) {
  const [tab, setTab] = useState<"fields" | "workflow" | "labels">("fields");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveField = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/v1/inventory/custom-fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: String(form.get("entityType") || "ITEM"),
        key: String(form.get("key") || ""),
        label: String(form.get("label") || ""),
        fieldType: String(form.get("fieldType") || "TEXT"),
        required: form.get("required") === "on",
        showInList: form.get("showInList") === "on",
        isActive: true,
        config: form.get("options")
          ? { options: String(form.get("options")).split(",").map((v) => v.trim()).filter(Boolean) }
          : {},
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !body.ok) {
      setMessage(body.error?.message || "Failed to create custom field");
      setBusy(false);
      return;
    }

    window.location.reload();
  };

  const saveWorkflow = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    let config: unknown;
    try {
      config = JSON.parse(String(form.get("config") || "{}"));
    } catch {
      setBusy(false);
      setMessage("Invalid workflow JSON config");
      return;
    }

    const response = await fetch("/api/v1/inventory/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentType: String(form.get("documentType") || "TRANSFER"),
        name: String(form.get("name") || ""),
        isActive: true,
        config,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !body.ok) {
      setMessage(body.error?.message || "Failed to save workflow");
      setBusy(false);
      return;
    }

    window.location.reload();
  };

  const saveTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    let config: unknown;
    try {
      config = JSON.parse(String(form.get("config") || "{}"));
    } catch {
      setBusy(false);
      setMessage("Invalid label template JSON config");
      return;
    }

    const response = await fetch("/api/v1/inventory/label-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") || ""),
        paperType: String(form.get("paperType") || "A4"),
        isDefault: form.get("isDefault") === "on",
        widthMm: Number(form.get("widthMm") || 0) || null,
        heightMm: Number(form.get("heightMm") || 0) || null,
        config,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !body.ok) {
      setMessage(body.error?.message || "Failed to save label template");
      setBusy(false);
      return;
    }

    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === "fields" ? "default" : "outline"} size="sm" onClick={() => setTab("fields")}>
          Custom Fields
        </Button>
        <Button variant={tab === "workflow" ? "default" : "outline"} size="sm" onClick={() => setTab("workflow")}>
          Workflows
        </Button>
        <Button variant={tab === "labels" ? "default" : "outline"} size="sm" onClick={() => setTab("labels")}>
          Label Templates
        </Button>
      </div>

      {message && <p className="text-sm text-destructive">{message}</p>}

      {tab === "fields" && (
        <div className="space-y-3">
          <form onSubmit={saveField} className="surface-1 grid gap-2 p-4 sm:grid-cols-6">
            <select name="entityType" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
              <option value="ITEM">ITEM</option>
              <option value="WAREHOUSE">WAREHOUSE</option>
              <option value="LOCATION">LOCATION</option>
              <option value="DOCUMENT">DOCUMENT</option>
              <option value="DOCUMENT_LINE">DOCUMENT_LINE</option>
            </select>
            <input name="key" required placeholder="field_key" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <input name="label" required placeholder="Field Label" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <select name="fieldType" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
              <option value="TEXT">TEXT</option>
              <option value="TEXTAREA">TEXTAREA</option>
              <option value="NUMBER">NUMBER</option>
              <option value="CURRENCY">CURRENCY</option>
              <option value="BOOLEAN">BOOLEAN</option>
              <option value="DATE">DATE</option>
              <option value="DATETIME">DATETIME</option>
              <option value="SELECT">SELECT</option>
              <option value="MULTISELECT">MULTISELECT</option>
              <option value="BARCODE">BARCODE</option>
              <option value="JSON">JSON</option>
            </select>
            <input name="options" placeholder="a,b,c options" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" name="required" /> Required</label>
              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" name="showInList" /> Show in list</label>
            </div>
            <Button type="submit" className="sm:col-span-6" disabled={busy}>{busy ? "Saving..." : "Create Field"}</Button>
          </form>

          <section className="surface-1 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Required</th>
                    <th className="px-3 py-2">List</th>
                    <th className="px-3 py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.id} className="border-t border-border">
                      <td className="px-3 py-2">{field.entityType}</td>
                      <td className="px-3 py-2 font-mono text-xs">{field.key}</td>
                      <td className="px-3 py-2">{field.label}</td>
                      <td className="px-3 py-2">{field.fieldType}</td>
                      <td className="px-3 py-2">{field.required ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{field.showInList ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{field.isActive ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "workflow" && (
        <div className="space-y-3">
          <form onSubmit={saveWorkflow} className="surface-1 grid gap-2 p-4 sm:grid-cols-2">
            <input name="name" placeholder="Workflow name" required className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <select name="documentType" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="ISSUE">ISSUE</option>
              <option value="COUNT">COUNT</option>
            </select>
            <textarea
              name="config"
              rows={12}
              defaultValue={prettyJson({
                initialStatus: "DRAFT",
                terminalStatuses: ["POSTED", "CANCELLED", "REJECTED"],
                transitions: [
                  { action: "SUBMIT", from: ["DRAFT"], to: "SUBMITTED", requiredPermissions: ["inventory.document.write"] },
                  { action: "APPROVE", from: ["SUBMITTED"], to: "APPROVED", requiredPermissions: ["inventory.document.approve"] },
                  { action: "POST", from: ["APPROVED"], to: "POSTED", requiredPermissions: ["inventory.document.post"] },
                  { action: "REJECT", from: ["SUBMITTED"], to: "REJECTED", requiredPermissions: ["inventory.document.approve"] },
                  { action: "CANCEL", from: ["DRAFT", "SUBMITTED", "APPROVED"], to: "CANCELLED", requiredPermissions: ["inventory.document.write"] },
                ],
              })}
              className="focus-ring sm:col-span-2 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 py-1.5 font-mono text-xs"
            />
            <Button type="submit" className="sm:col-span-2" disabled={busy}>{busy ? "Saving..." : "Save Workflow"}</Button>
          </form>

          <section className="surface-1 p-4">
            <h3 className="mb-2 text-sm font-semibold">Workflow Versions</h3>
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium">{workflow.name} ({workflow.documentType}) v{workflow.version}</div>
                  <div className="text-muted-foreground">{workflow.isActive ? "Active" : "Archived"}</div>
                </div>
              ))}
              {workflows.length === 0 && <p className="text-sm text-muted-foreground">No workflow definitions yet.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === "labels" && (
        <div className="space-y-3">
          <form onSubmit={saveTemplate} className="surface-1 grid gap-2 p-4 sm:grid-cols-2">
            <input name="name" placeholder="Template name" required className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <select name="paperType" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
              <option value="A4">A4</option>
              <option value="THERMAL">THERMAL</option>
            </select>
            <input name="widthMm" type="number" placeholder="Width mm (optional)" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <input name="heightMm" type="number" placeholder="Height mm (optional)" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
            <textarea
              name="config"
              rows={8}
              defaultValue={prettyJson({
                columns: 3,
                rows: 8,
                include: ["sku", "name", "barcode", "customFields"],
                barcodeType: "code128",
                qrField: "sku",
                logo: false,
              })}
              className="focus-ring sm:col-span-2 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 py-1.5 font-mono text-xs"
            />
            <label className="inline-flex items-center gap-2 text-sm"><input name="isDefault" type="checkbox" /> Default template</label>
            <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Template"}</Button>
          </form>

          <section className="surface-1 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Paper</th>
                  <th className="px-3 py-2">Default</th>
                </tr>
              </thead>
              <tbody>
                {labelTemplates.map((template) => (
                  <tr key={template.id} className="border-t border-border">
                    <td className="px-3 py-2">{template.name}</td>
                    <td className="px-3 py-2">{template.paperType}</td>
                    <td className="px-3 py-2">{template.isDefault ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {labelTemplates.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted-foreground">No label templates configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

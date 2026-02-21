"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Brand = { id: string; name: string };
type FieldDef = {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  defaultValue: unknown;
  config: Record<string, unknown> | null;
};

function coerceCustomFieldValue(field: FieldDef, raw: string): unknown {
  if (!raw) return null;
  if (field.fieldType === "NUMBER" || field.fieldType === "CURRENCY") {
    return Number(raw);
  }
  if (field.fieldType === "BOOLEAN") {
    return raw === "true";
  }
  if (field.fieldType === "MULTISELECT") {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return raw;
}

export function NewInventoryItemForm({ brands, customFields }: { brands: Brand[]; customFields: FieldDef[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialCustom = useMemo(() => {
    const fields: Record<string, unknown> = {};
    for (const field of customFields) {
      fields[field.key] = field.defaultValue ?? "";
    }
    return fields;
  }, [customFields]);

  const [customValues, setCustomValues] = useState<Record<string, unknown>>(initialCustom);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
      brandId: String(form.get("brandId") || ""),
      uom: String(form.get("uom") || "pcs"),
      unitCostMinor: Number(form.get("unitCostMinor") || 0),
      priceCents: Number(form.get("priceCents") || 0),
      lowStockThreshold: Number(form.get("lowStockThreshold") || 0),
      isActive: true,
      identifiers: [],
      customFields: customValues,
    };

    const response = await fetch("/api/v1/inventory/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: { message?: string };
      data?: { id?: string };
    };

    if (!response.ok || !data.ok) {
      setError(data.error?.message || "Failed to create item");
      setSubmitting(false);
      return;
    }

    router.push(`/inventory/items/${data.data?.id}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="surface-1 p-4">
        <h2 className="mb-3 text-sm font-semibold">Base Fields</h2>
        <p className="mb-3 text-xs text-muted-foreground">SKU is generated automatically from company numbering.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Name
            <input name="name" required className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2" />
          </label>

          <label className="text-sm sm:col-span-2">
            Description
            <textarea name="description" rows={3} className="focus-ring mt-1 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 py-1.5" />
          </label>

          <label className="text-sm">
            Brand
            <select name="brandId" required className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2">
              <option value="">Select brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            UOM
            <input name="uom" defaultValue="pcs" className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2" />
          </label>

          <label className="text-sm">
            Unit Cost (Minor)
            <input name="unitCostMinor" type="number" defaultValue={0} className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2" />
          </label>

          <label className="text-sm">
            Price (Cents)
            <input name="priceCents" type="number" defaultValue={0} className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2" />
          </label>

          <label className="text-sm">
            Low Stock Threshold
            <input name="lowStockThreshold" type="number" defaultValue={0} className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2" />
          </label>
        </div>
      </div>

      <div className="surface-1 p-4">
        <h2 className="mb-3 text-sm font-semibold">Custom Fields</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {customFields.length === 0 && <p className="text-sm text-muted-foreground">No custom fields configured.</p>}

          {customFields.map((field) => {
            const options = (field.config?.options as string[] | undefined) ?? [];
            return (
              <label key={field.key} className="text-sm">
                {field.label}
                {field.required ? " *" : ""}
                {field.fieldType === "BOOLEAN" ? (
                  <select
                    className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
                    defaultValue={field.defaultValue == null ? "" : String(field.defaultValue)}
                    onChange={(event) => {
                      setCustomValues((current) => ({
                        ...current,
                        [field.key]: coerceCustomFieldValue(field, event.target.value),
                      }));
                    }}
                  >
                    <option value="">Select</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : field.fieldType === "SELECT" && options.length > 0 ? (
                  <select
                    className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
                    defaultValue={field.defaultValue == null ? "" : String(field.defaultValue)}
                    onChange={(event) => {
                      setCustomValues((current) => ({
                        ...current,
                        [field.key]: coerceCustomFieldValue(field, event.target.value),
                      }));
                    }}
                  >
                    <option value="">Select</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.fieldType === "TEXTAREA" ? (
                  <textarea
                    rows={3}
                    defaultValue={field.defaultValue == null ? "" : String(field.defaultValue)}
                    className="focus-ring mt-1 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 py-1.5"
                    onChange={(event) => {
                      setCustomValues((current) => ({
                        ...current,
                        [field.key]: coerceCustomFieldValue(field, event.target.value),
                      }));
                    }}
                  />
                ) : (
                  <input
                    defaultValue={field.defaultValue == null ? "" : String(field.defaultValue)}
                    className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
                    onChange={(event) => {
                      setCustomValues((current) => ({
                        ...current,
                        [field.key]: coerceCustomFieldValue(field, event.target.value),
                      }));
                    }}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Item"}
        </Button>
      </div>
    </form>
  );
}

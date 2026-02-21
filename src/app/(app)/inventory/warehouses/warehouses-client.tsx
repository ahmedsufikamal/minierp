"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentWarehouse: { id: string; code: string; name: string } | null;
  address: Record<string, unknown> | null;
  isActive: boolean;
  locations: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
};

export function WarehousesClient({ rows }: { rows: Warehouse[] }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreateWarehouse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const address = {
      line1: String(form.get("addressLine1") || "").trim(),
      line2: String(form.get("addressLine2") || "").trim(),
      city: String(form.get("addressCity") || "").trim(),
      state: String(form.get("addressState") || "").trim(),
      postalCode: String(form.get("addressPostalCode") || "").trim(),
      country: String(form.get("addressCountry") || "").trim(),
    };
    const addressPayload = Object.fromEntries(
      Object.entries(address).filter(([, value]) => Boolean(value)),
    );

    const response = await fetch("/api/v1/inventory/warehouses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: String(form.get("code") || ""),
        name: String(form.get("name") || ""),
        parentWarehouseId: String(form.get("parentWarehouseId") || "") || null,
        address: Object.keys(addressPayload).length > 0 ? addressPayload : null,
        description: String(form.get("description") || ""),
        isActive: true,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
    if (!response.ok || !body.ok) {
      setError(body.error?.message || "Failed to create warehouse");
      setCreating(false);
      return;
    }

    window.location.reload();
  };

  const onCreateLocation = async (warehouseId: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await fetch("/api/v1/inventory/locations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        warehouseId,
        code: String(form.get("code") || ""),
        name: String(form.get("name") || ""),
        isActive: true,
      }),
    });

    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onCreateWarehouse} className="surface-1 grid gap-2 p-4 sm:grid-cols-3">
        <input name="code" required placeholder="Code" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="name" required placeholder="Name" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <select
          name="parentWarehouseId"
          defaultValue=""
          className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
        >
          <option value="">No parent</option>
          {rows.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </select>
        <input name="description" placeholder="Description" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="addressLine1" placeholder="Address line 1" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="addressLine2" placeholder="Address line 2" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="addressCity" placeholder="City" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="addressState" placeholder="State" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="addressPostalCode" placeholder="Postal code" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <input name="addressCountry" placeholder="Country" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
        <Button type="submit" className="sm:col-span-3" disabled={creating}>{creating ? "Creating..." : "Add Warehouse"}</Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {rows.map((warehouse) => (
          <section key={warehouse.id} className="surface-1 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{warehouse.code} - {warehouse.name}</h2>
                <p className="text-sm text-muted-foreground">{warehouse.description || "No description"}</p>
                {warehouse.parentWarehouse && (
                  <p className="text-xs text-muted-foreground">
                    Parent: {warehouse.parentWarehouse.code} - {warehouse.parentWarehouse.name}
                  </p>
                )}
                {warehouse.address && (
                  <p className="text-xs text-muted-foreground">
                    Address: {[
                      warehouse.address.line1,
                      warehouse.address.line2,
                      warehouse.address.city,
                      warehouse.address.state,
                      warehouse.address.postalCode,
                      warehouse.address.country,
                    ]
                      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                      .join(", ")}
                  </p>
                )}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/inventory/warehouses/${warehouse.id}`}>Open</Link>
              </Button>
            </div>

            <div className="mt-3 overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Code</th>
                    <th className="px-2 py-1.5">Name</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouse.locations.map((location) => (
                    <tr key={location.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{location.code}</td>
                      <td className="px-2 py-1.5">{location.name}</td>
                      <td className="px-2 py-1.5">{location.isActive ? "Active" : "Archived"}</td>
                    </tr>
                  ))}
                  {warehouse.locations.length === 0 && (
                    <tr>
                      <td className="px-2 py-3 text-muted-foreground" colSpan={3}>No locations yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form onSubmit={(event) => onCreateLocation(warehouse.id, event)} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input name="code" required placeholder="Location Code" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
              <input name="name" required placeholder="Location Name" className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm" />
              <Button type="submit">Add Location</Button>
            </form>
          </section>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No warehouses yet.</p>}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Plus, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Item = { id: string; sku: string; name: string; uom: string; unitCostMinor: number | null };
type Warehouse = { id: string; code: string; name: string };

type Line = {
  key: string;
  itemId: string;
  quantity: number;
  unitCostMinor: number;
};

type CameraBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): CameraBarcodeDetector;
    };
  }
}

function makeLine(item?: Item): Line {
  return {
    key: crypto.randomUUID(),
    itemId: item?.id ?? "",
    quantity: 1,
    unitCostMinor: item?.unitCostMinor ?? 0,
  };
}

export function InventoryDocumentEditor({
  items,
  warehouses,
}: {
  items: Item[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") || "TRANSFER").toUpperCase();
  const itemFromQuery = searchParams.get("itemId");

  const preselectedItem = useMemo(() => items.find((item) => item.id === itemFromQuery), [items, itemFromQuery]);

  const [documentType, setDocumentType] = useState(initialType);
  const [number, setNumber] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lines, setLines] = useState<Line[]>([makeLine(preselectedItem)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const addLineFromItem = (item: Item) => {
    setLines((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        return current.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, makeLine(item)];
    });
  };

  const scanByCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const response = await fetch(`/api/v1/inventory/items/search?code=${encodeURIComponent(trimmed)}`);
    const body = (await response.json()) as {
      ok?: boolean;
      data?: { id: string; sku: string; name: string; unitCostMinor: number | null };
    };

    if (response.ok && body.ok && body.data) {
      const item = items.find((entry) => entry.id === body.data!.id);
      if (item) {
        addLineFromItem(item);
        setScanCode("");
      }
    }
  };

  const scanFromCameraImage = async (file: File) => {
    if (!window.BarcodeDetector) {
      setError("BarcodeDetector API not supported in this browser. Use scanner input.");
      return;
    }

    setScanning(true);
    try {
      const detector = new window.BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code"],
      });
      const bitmap = await createImageBitmap(file);
      const results = await detector.detect(bitmap);
      const value = results[0]?.rawValue;
      if (!value) {
        setError("No barcode/QR code detected in image.");
        return;
      }
      await scanByCode(value);
    } finally {
      setScanning(false);
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const payload = {
      documentType,
      number: number || `DOC-${Date.now()}`,
      notes,
      sourceWarehouseId: sourceWarehouseId || null,
      destinationWarehouseId: destinationWarehouseId || null,
      lines: lines
        .filter((line) => line.itemId)
        .map((line) => ({
          itemId: line.itemId,
          quantity: Number(line.quantity),
          unitCostMinor: Number(line.unitCostMinor),
          currency: "BDT",
        })),
    };

    const response = await fetch("/api/v1/inventory/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as {
      ok?: boolean;
      data?: { id?: string };
      error?: { message?: string };
    };

    if (!response.ok || !body.ok) {
      setError(body.error?.message || "Failed to create document");
      setSubmitting(false);
      return;
    }

    router.push(`/inventory/documents/${body.data?.id}`);
  };

  return (
    <div className="space-y-4">
      <section className="surface-1 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            Document Type
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
            >
              <option value="RECEIPT">RECEIPT</option>
              <option value="ISSUE">ISSUE</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="COUNT">COUNT</option>
            </select>
          </label>

          <label className="text-sm">
            Number
            <input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
              placeholder="DOC-0001"
            />
          </label>

          <label className="text-sm">
            Source Warehouse
            <select
              value={sourceWarehouseId}
              onChange={(event) => setSourceWarehouseId(event.target.value)}
              className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
            >
              <option value="">None</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Destination Warehouse
            <select
              value={destinationWarehouseId}
              onChange={(event) => setDestinationWarehouseId(event.target.value)}
              className="focus-ring mt-1 h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
            >
              <option value="">None</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-sm">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="focus-ring mt-1 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 py-1.5"
          />
        </label>
      </section>

      <section className="surface-1 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void scanByCode(scanCode);
                }
              }}
              className="focus-ring h-9 min-w-[260px] rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
              placeholder="Scan barcode/QR (keyboard scanner)"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void scanByCode(scanCode)}>
              <ScanLine className="mr-1 h-4 w-4" /> Scan
            </Button>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Camera className="h-4 w-4" />
            Camera scan
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void scanFromCameraImage(file);
              }}
            />
          </label>
          {scanning && <span className="text-xs text-muted-foreground">Detecting...</span>}
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Qty</th>
                <th className="px-2 py-1.5">Unit Cost</th>
                <th className="px-2 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <select
                      value={line.itemId}
                      onChange={(event) => {
                        const item = items.find((entry) => entry.id === event.target.value);
                        updateLine(line.key, {
                          itemId: event.target.value,
                          unitCostMinor: item?.unitCostMinor ?? 0,
                        });
                      }}
                      className="focus-ring h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
                    >
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} - {item.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value || 0) })}
                      className="focus-ring h-9 w-28 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      value={line.unitCostMinor}
                      onChange={(event) => updateLine(line.key, { unitCostMinor: Number(event.target.value || 0) })}
                      className="focus-ring h-9 w-36 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLines((current) => [...current, makeLine()])}>
          <Plus className="mr-1 h-4 w-4" /> Add Line
        </Button>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? "Saving..." : "Create Document"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { previewExcelImport, executeExcelImport } from "../import-actions";
import type { ImportPreview } from "@/application/inventory/dtos";
import { formatMoney } from "@/lib/utils";

export default function InventoryImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [brandOverride, setBrandOverride] = useState("");
  const [mode, setMode] = useState<"OPENING_ONLY" | "HISTORY_APPROX">("OPENING_ONLY");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }
    
    setFile(selectedFile);
    setPreview(null);
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (brandOverride) {
        formData.append("brandOverride", brandOverride);
      }
      formData.append("mode", mode);
      
      const result = await previewExcelImport(formData);
      
      if (result.ok && result.data) {
        setPreview(result.data);
        if (result.data.alreadyImported) {
          toast.warning("This file was already imported. Use 'Force Re-import' to import again.");
        }
      } else {
        toast.error(result.error || "Failed to preview file");
        setFile(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview file");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handlePreview = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (brandOverride) {
        formData.append("brandOverride", brandOverride);
      }
      formData.append("mode", mode);
      
      const result = await previewExcelImport(formData);
      
      if (result.ok && result.data) {
        setPreview(result.data);
      } else {
        toast.error(result.error || "Failed to preview file");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (force = false) => {
    if (!file) return;
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (brandOverride) {
        formData.append("brandOverride", brandOverride);
      }
      formData.append("mode", mode);
      if (force) {
        formData.append("forceReimport", "true");
      }
      
      const result = await executeExcelImport(formData);
      
      if (result.ok) {
        toast.success("Import completed successfully!");
        router.push("/inventory/items");
        router.refresh();
      } else {
        toast.error(result.error || "Import failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Inventory"
        subtitle="Upload Excel file to import inventory data from SIEMENS Stock format."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border p-5">
            <div className="font-medium mb-4">Upload Excel File</div>
            
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-[hsl(var(--border-strong))]"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                    }}
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div className="font-medium">Drop Excel file here</div>
                  <div className="text-sm text-muted-foreground">or click to browse</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Supports .xlsx and .xls files
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Import Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "OPENING_ONLY" | "HISTORY_APPROX")}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="OPENING_ONLY">Opening balances only</option>
                  <option value="HISTORY_APPROX">History approximation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Brand Override (Optional)
                </label>
                <input
                  type="text"
                  value={brandOverride}
                  onChange={(e) => setBrandOverride(e.target.value)}
                  placeholder="e.g., SIEMENS"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && file) {
                      e.preventDefault();
                      handlePreview();
                    }
                  }}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Override brand for all imported items. Leave empty to use file data or default to SIEMENS.
                </div>
              </div>

              {file && (
                <Button
                  onClick={handlePreview}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Previewing...
                    </>
                  ) : (
                    "Preview Import"
                  )}
                </Button>
              )}
            </div>
          </div>

          {preview && (
            <div className="rounded-2xl border p-5 bg-[hsl(var(--surface-elevated))]">
              <div className="font-medium mb-3">Import Summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{preview.summary.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Qty:</span>
                  <span className="font-medium">{preview.summary.totalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Value:</span>
                  <span className="font-medium">
                    {formatMoney(Math.round(preview.summary.totalValue * 100), "BDT")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brands:</span>
                  <span className="font-medium">{preview.summary.brands.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Locations:</span>
                  <span className="font-medium">{preview.summary.locations.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {preview && (
            <>
              {preview.errors.length > 0 && (
                <div className="state-error rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-[hsl(var(--state-error-fg))]" />
                    <div className="flex-1">
                      <div className="mb-1 font-medium">Errors</div>
                      <ul className="space-y-1 text-sm">
                        {preview.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="state-warning rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-[hsl(var(--state-warning-fg))]" />
                    <div className="flex-1">
                      <div className="mb-1 font-medium">Warnings</div>
                      <ul className="space-y-1 text-sm">
                        {preview.warnings.map((warn, i) => (
                          <li key={i}>• {warn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {preview.alreadyImported && (
                <div className="state-info rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-[hsl(var(--state-info-fg))]" />
                    <div className="flex-1">
                      <div className="mb-1 font-medium">
                        File Already Imported
                      </div>
                      <div className="text-sm">
                        This file was previously imported. Use &quot;Force Re-import&quot; to import again.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <div className="font-medium">Preview ({preview.rows.length} items)</div>
                    <div className="text-sm text-muted-foreground">
                      Review the data before importing
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleImport(false)}
                      disabled={importing || preview.alreadyImported}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                    {preview.alreadyImported && (
                      <Button
                        onClick={() => handleImport(true)}
                        disabled={importing}
                      >
                        {importing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          "Force Re-import"
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-muted-foreground bg-[hsl(var(--surface-elevated))] sticky top-0">
                      <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                        <th>MLFB</th>
                        <th>Brand</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Category</th>
                        <th>Locations</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-3 font-mono text-xs">{row.mlfb}</td>
                          <td className="px-4 py-3">{row.brand}</td>
                          <td className="px-4 py-3">{row.inventoryQty.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {formatMoney(Math.round(row.rateInBDT * 100), "BDT")}
                          </td>
                          <td className="px-4 py-3">
                            {row.category && (
                              <div>
                                {row.category}
                                {row.subCategory && (
                                  <span className="text-muted-foreground"> / {row.subCategory}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.locations.length > 0 ? (
                              <div className="space-y-1">
                                {row.locations.map((loc, j) => (
                                  <div key={j} className="text-xs">
                                    {loc.location}: {loc.qty}
                                    {loc.warning && (
                                      <span className="ml-1 text-[hsl(var(--state-warning-fg))]" title={loc.warning}>
                                        ⚠
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.errors.length > 0 ? (
                              <span className="text-xs text-[hsl(var(--state-error-fg))]">Errors</span>
                            ) : row.warnings.length > 0 ? (
                              <span className="text-xs text-[hsl(var(--state-warning-fg))]">Warnings</span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!preview && file && loading && (
            <div className="rounded-2xl border p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <div className="mt-4 text-muted-foreground">Parsing Excel file...</div>
            </div>
          )}

          {!preview && !file && (
            <div className="rounded-2xl border p-8 text-center text-muted-foreground">
              Select an Excel file to preview the import data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
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
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-400" />
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-slate-600">
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
                  <Upload className="h-12 w-12 mx-auto text-slate-400" />
                  <div className="font-medium">Drop Excel file here</div>
                  <div className="text-sm text-slate-600">or click to browse</div>
                  <div className="text-xs text-slate-500 mt-2">
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
                <div className="text-xs text-slate-500 mt-1">
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
            <div className="rounded-2xl border p-5 bg-slate-50">
              <div className="font-medium mb-3">Import Summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Items:</span>
                  <span className="font-medium">{preview.summary.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Qty:</span>
                  <span className="font-medium">{preview.summary.totalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Value:</span>
                  <span className="font-medium">
                    {formatMoney(Math.round(preview.summary.totalValue * 100), "BDT")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Brands:</span>
                  <span className="font-medium">{preview.summary.brands.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Locations:</span>
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
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-red-900 mb-1">Errors</div>
                      <ul className="text-sm text-red-700 space-y-1">
                        {preview.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-amber-900 mb-1">Warnings</div>
                      <ul className="text-sm text-amber-700 space-y-1">
                        {preview.warnings.map((warn, i) => (
                          <li key={i}>• {warn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {preview.alreadyImported && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-blue-900 mb-1">
                        File Already Imported
                      </div>
                      <div className="text-sm text-blue-700">
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
                    <div className="text-sm text-slate-600">
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
                    <thead className="text-left text-slate-600 bg-slate-50 sticky top-0">
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
                                  <span className="text-slate-500"> / {row.subCategory}</span>
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
                                      <span className="text-amber-600 ml-1" title={loc.warning}>
                                        ⚠
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.errors.length > 0 ? (
                              <span className="text-red-600 text-xs">Errors</span>
                            ) : row.warnings.length > 0 ? (
                              <span className="text-amber-600 text-xs">Warnings</span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
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
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-slate-400" />
              <div className="mt-4 text-slate-600">Parsing Excel file...</div>
            </div>
          )}

          {!preview && !file && (
            <div className="rounded-2xl border p-8 text-center text-slate-600">
              Select an Excel file to preview the import data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

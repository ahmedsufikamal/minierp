"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { commitBrandImport, previewBrandImport } from "./import-actions";
import type {
  BrandImportCommitResult,
  BrandImportPreview,
} from "@/modules/inventory/application/brand-import.service";

const PREVIEW_PAGE_SIZE = 10;

type Step = "upload" | "preview" | "result";

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  const toneClassName =
    tone === "success"
      ? "border-[hsl(var(--state-success-border))] bg-[hsl(var(--state-success-bg))]"
      : tone === "warning"
        ? "border-[hsl(var(--state-warning-border))] bg-[hsl(var(--state-warning-bg))]"
        : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]";

  return (
    <div className={`rounded-2xl border p-4 ${toneClassName}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function BrandImportDialog({ templateHref }: { templateHref: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BrandImportPreview | null>(null);
  const [result, setResult] = useState<BrandImportCommitResult | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPending, setPreviewPending] = useState(false);
  const [commitPending, setCommitPending] = useState(false);

  const previewRows = preview?.rows ?? [];
  const acceptedRowCount = preview?.acceptedRows.length ?? 0;
  const previewPageCount = Math.max(1, Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE));
  const previewPageStart = (previewPage - 1) * PREVIEW_PAGE_SIZE;
  const previewPageRows = previewRows.slice(previewPageStart, previewPageStart + PREVIEW_PAGE_SIZE);
  const previewSkippedRows = previewRows.filter((row) => row.status === "SKIPPED" && row.reason);

  const totalRowsProcessed = preview?.summary.totalRows ?? 0;
  const successfulImports = result?.successfulImports ?? 0;
  const skippedRows = (preview?.summary.skippedRows ?? 0) + (result?.skippedRows ?? 0);
  const failedRows = result?.failedRows ?? [];

  function resetState() {
    setStep("upload");
    setFile(null);
    setError(null);
    setPreview(null);
    setResult(null);
    setPreviewPage(1);
    setPreviewPending(false);
    setCommitPending(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  }

  function handleFileSelection(selectedFile: File | null) {
    setFile(selectedFile);
    setError(null);
    setPreview(null);
    setResult(null);
    setPreviewPage(1);
    if (selectedFile) {
      setStep("upload");
    }
  }

  async function handlePreview() {
    if (!file) {
      setError("Select an Excel file before previewing.");
      return;
    }

    setPreviewPending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await previewBrandImport(formData);

      if (!response.ok) {
        setError(response.error);
        toast.error(response.error);
        return;
      }

      setPreview(response.data);
      setResult(null);
      setPreviewPage(1);
      setStep("preview");
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "Failed to preview the brand import.";
      setError(message);
      toast.error(message);
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;

    setCommitPending(true);
    setError(null);

    try {
      const response = await commitBrandImport(preview.acceptedRows);

      if (!response.ok) {
        setError(response.error);
        toast.error(response.error);
        return;
      }

      setResult(response.data);
      setStep("result");
      toast.success(`Imported ${response.data.successfulImports} brand${response.data.successfulImports === 1 ? "" : "s"}.`);
    } catch (commitError) {
      const message = commitError instanceof Error ? commitError.message : "Failed to import brands.";
      setError(message);
      toast.error(message);
    } finally {
      setCommitPending(false);
    }
  }

  function handleDone() {
    router.refresh();
    handleOpenChange(false);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Import Brands
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Brands</DialogTitle>
            <DialogDescription>
              Upload an Excel workbook, review the parsed brands, and import valid rows in bulk.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant={step === "upload" ? "info" : "outline"}>1. Upload</Badge>
              <Badge variant={step === "preview" ? "info" : "outline"}>2. Preview</Badge>
              <Badge variant={step === "result" ? "info" : "outline"}>3. Result</Badge>
            </div>

            {step === "upload" ? (
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-8 text-center transition-colors hover:border-[hsl(var(--ring)/0.65)]"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const selectedFile = event.dataTransfer.files?.[0] ?? null;
                      handleFileSelection(selectedFile);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                    />

                    {file ? (
                      <div className="space-y-3">
                        <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFileSelection(null);
                          }}
                        >
                          Change File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div className="font-medium">Choose an Excel file</div>
                        <div className="text-sm text-muted-foreground">
                          Drag and drop, or click to browse. Supports `.xlsx` and `.xls`.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-[hsl(var(--surface-1))] p-4 text-sm">
                    <div className="font-medium">Expected format</div>
                    <p className="mt-2 text-muted-foreground">
                      Use one row per brand and include a required <span className="font-medium text-foreground">Brand Name</span> column.
                      Duplicate or blank rows will be skipped during import.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border bg-[hsl(var(--surface-1))] p-5">
                  <div className="space-y-1">
                    <Label htmlFor="brand-import-file">Selected file</Label>
                    <Input
                      id="brand-import-file"
                      value={file?.name ?? ""}
                      placeholder="No file selected"
                      readOnly
                    />
                  </div>

                  <Button asChild type="button" variant="outline" className="w-full">
                    <a href={templateHref}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Sample Template
                    </a>
                  </Button>

                  {error ? (
                    <div className="state-error rounded-2xl p-4 text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-[hsl(var(--state-error-fg))]" />
                        <div>{error}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === "preview" && preview ? (
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <SummaryCard label="Total rows" value={preview.summary.totalRows} />
                  <SummaryCard label="Ready to import" value={preview.summary.validRows} tone="success" />
                  <SummaryCard label="Skipped rows" value={preview.summary.skippedRows} tone="warning" />
                  <SummaryCard
                    label="Existing duplicates"
                    value={preview.summary.duplicateExistingRows}
                    tone="warning"
                  />
                </div>

                {error ? (
                  <div className="state-error rounded-2xl p-4 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-5 w-5 text-[hsl(var(--state-error-fg))]" />
                      <div>{error}</div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                    <div>
                      <div className="font-medium">Preview rows</div>
                      <div className="text-sm text-muted-foreground">
                        File: {preview.fileName}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Page {previewPage} of {previewPageCount}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[hsl(var(--surface-2))] text-left text-muted-foreground">
                        <tr className="[&>th]:border-b [&>th]:px-4 [&>th]:py-3">
                          <th className="w-[90px]">Row</th>
                          <th>Brand Name</th>
                          <th className="w-[120px]">Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewPageRows.map((row) => (
                          <tr key={row.rowNumber} className="border-b last:border-0">
                            <td className="px-4 py-3 font-mono text-xs">{row.rowNumber}</td>
                            <td className="px-4 py-3">{row.brandName || "—"}</td>
                            <td className="px-4 py-3">
                              <Badge variant={row.status === "VALID" ? "success" : "warning"}>
                                {row.status === "VALID" ? "Valid" : "Skipped"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{row.reason ?? "Ready to import"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {previewPageRows.length === 0 ? 0 : previewPageStart + 1}-
                      {Math.min(previewPageStart + previewPageRows.length, previewRows.length)} of {previewRows.length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                        disabled={previewPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}
                        disabled={previewPage === previewPageCount}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === "result" && preview && result ? (
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <SummaryCard label="Total rows processed" value={totalRowsProcessed} />
                  <SummaryCard label="Successful imports" value={successfulImports} tone="success" />
                  <SummaryCard label="Skipped rows" value={skippedRows} tone="warning" />
                  <SummaryCard label="Failed rows" value={failedRows.length} tone={failedRows.length > 0 ? "warning" : "default"} />
                </div>

                <div className="rounded-2xl border p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[hsl(var(--success))]" />
                    <div>
                      <div className="font-medium">Brand import complete</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Valid rows were imported, and rows with validation issues were skipped safely.
                      </p>
                    </div>
                  </div>
                </div>

                {previewSkippedRows.length > 0 ? (
                  <div className="rounded-2xl border">
                    <div className="border-b p-4">
                      <div className="font-medium">Skipped rows</div>
                      <div className="text-sm text-muted-foreground">
                        These rows were excluded before import because they were invalid or duplicated.
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[hsl(var(--surface-2))] text-left text-muted-foreground">
                          <tr className="[&>th]:border-b [&>th]:px-4 [&>th]:py-3">
                            <th className="w-[90px]">Row</th>
                            <th>Brand Name</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewSkippedRows.map((row) => (
                            <tr key={`skipped-${row.rowNumber}`} className="border-b last:border-0">
                              <td className="px-4 py-3 font-mono text-xs">{row.rowNumber}</td>
                              <td className="px-4 py-3">{row.brandName || "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {failedRows.length > 0 ? (
                  <div className="rounded-2xl border">
                    <div className="border-b p-4">
                      <div className="font-medium">Failed rows</div>
                      <div className="text-sm text-muted-foreground">
                        These rows hit an unexpected server-side failure during creation.
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[hsl(var(--surface-2))] text-left text-muted-foreground">
                          <tr className="[&>th]:border-b [&>th]:px-4 [&>th]:py-3">
                            <th className="w-[90px]">Row</th>
                            <th>Brand Name</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedRows.map((row) => (
                            <tr key={`failed-${row.rowNumber}-${row.brandName}`} className="border-b last:border-0">
                              <td className="px-4 py-3 font-mono text-xs">{row.rowNumber}</td>
                              <td className="px-4 py-3">{row.brandName}</td>
                              <td className="px-4 py-3 text-muted-foreground">{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            {step === "upload" ? (
              <>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handlePreview} disabled={!file || previewPending}>
                  {previewPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Previewing...
                    </>
                  ) : (
                    "Preview Data"
                  )}
                </Button>
              </>
            ) : null}

            {step === "preview" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setResult(null);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCommit}
                  disabled={commitPending || acceptedRowCount === 0}
                >
                  {commitPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import Valid Rows (${acceptedRowCount})`
                  )}
                </Button>
              </>
            ) : null}

            {step === "result" ? (
              <Button type="button" onClick={handleDone}>
                Done
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

export function DocumentAttachmentPanel({ docId, initial }: { docId: string; initial: Attachment[] }) {
  const [attachments, setAttachments] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const createRes = await fetch("/api/v1/inventory/attachments/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType: "DOCUMENT",
          entityId: docId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });

      const createBody = (await createRes.json()) as {
        ok?: boolean;
        data?: {
          attachment: { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: string };
          upload: { url: string; method: "PUT"; headers: Record<string, string>; storageKey: string };
        };
      };

      if (!createRes.ok || !createBody.ok || !createBody.data) return;

      await fetch(createBody.data.upload.url, {
        method: createBody.data.upload.method,
        headers: createBody.data.upload.headers,
        body: file,
      });

      await fetch("/api/v1/inventory/attachments/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attachmentId: createBody.data.attachment.id,
          storageKey: createBody.data.upload.storageKey,
        }),
      });

      setAttachments((current) => [
        {
          id: createBody.data!.attachment.id,
          fileName: createBody.data!.attachment.fileName,
          mimeType: createBody.data!.attachment.mimeType,
          sizeBytes: createBody.data!.attachment.sizeBytes,
          uploadedAt: createBody.data!.attachment.uploadedAt,
        },
        ...current,
      ]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDownload = async (attachmentId: string) => {
    const response = await fetch(`/api/v1/inventory/attachments/${attachmentId}/download-url`);
    const body = (await response.json()) as {
      ok?: boolean;
      data?: { download: { url: string } };
    };

    if (response.ok && body.ok && body.data?.download.url) {
      window.open(body.data.download.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="surface-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Attachments</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
        }}
      />

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => onDownload(attachment.id)}
            className="focus-ring flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-[hsl(var(--surface-2))]"
          >
            <span className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              {attachment.fileName}
            </span>
            <span className="text-xs text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(1)} KB</span>
          </button>
        ))}
        {attachments.length === 0 && <p className="text-sm text-muted-foreground">No attachments yet.</p>}
      </div>
    </div>
  );
}

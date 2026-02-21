"use client";

import { useEffect, useState } from "react";
import { Paperclip, Share2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { InventorySettingsClient } from "@/app/(app)/inventory/settings/settings-client";

type StockSettingsCommentDto = {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
};

type StockSettingsActivityDto = {
  id: string;
  type: string;
  message: string;
  actor_user_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

export function StockSettingsShellClient({ canEdit }: { canEdit: boolean }) {
  const [comments, setComments] = useState<StockSettingsCommentDto[]>([]);
  const [activity, setActivity] = useState<StockSettingsActivityDto[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [commentRes, activityRes] = await Promise.all([
      fetch("/api/stock/settings/comments", { cache: "no-store" }),
      fetch("/api/stock/settings/activity", { cache: "no-store" }),
    ]);
    const commentBody = (await commentRes.json().catch(() => null)) as
      | Envelope<{ rows: StockSettingsCommentDto[] }>
      | null;
    const activityBody = (await activityRes.json().catch(() => null)) as
      | Envelope<{ rows: StockSettingsActivityDto[] }>
      | null;
    setComments(commentRes.ok && commentBody?.ok ? commentBody.data.rows : []);
    setActivity(activityRes.ok && activityBody?.ok ? activityBody.data.rows : []);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const response = await fetch("/api/stock/settings/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comment: text }),
    });
    const body = (await response.json().catch(() => null)) as
      | Envelope<StockSettingsCommentDto>
      | null;
    if (!response.ok || !body?.ok) {
      toast.error(body && !body.ok ? (body.error?.message ?? "Failed to add comment") : "Failed to add comment");
      setSubmitting(false);
      return;
    }
    setCommentDraft("");
    setComments((prev) => [body.data, ...prev]);
    setActivity((prev) => [
      {
        id: `comment:${body.data.id}`,
        type: "COMMENT_ADDED",
        message: body.data.comment,
        actor_user_id: body.data.user_id,
        created_at: body.data.created_at,
      },
      ...prev,
    ]);
    setSubmitting(false);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="surface-1 h-fit p-3">
        <h2 className="text-sm font-semibold">Meta</h2>
        <div className="mt-3 space-y-2">
          <button type="button" className="flex w-full items-center gap-2 rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">
            <UserRoundPlus className="h-4 w-4 text-muted-foreground" />
            Assigned To
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Attachments
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            Share
          </button>
        </div>
      </aside>

      <div>
        <InventorySettingsClient canEdit={canEdit} />
      </div>

      <aside className="space-y-4">
        <section className="surface-1 p-3">
          <h2 className="mb-2 text-sm font-semibold">Comments</h2>
          <textarea
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="Write a comment..."
            className="focus-ring min-h-[90px] w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={submitting || commentDraft.trim().length === 0}
            onClick={submitComment}
            className="mt-2 h-9 rounded-md border border-primary bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Add Comment"}
          </button>
          <div className="mt-3 space-y-2">
            {loading ? <p className="text-xs text-muted-foreground">Loading comments...</p> : null}
            {!loading && comments.length === 0 ? <p className="text-xs text-muted-foreground">No comments yet.</p> : null}
            {comments.map((comment) => (
              <article key={comment.id} className="rounded-md border border-border bg-[hsl(var(--surface-2))] p-2">
                <p className="text-xs text-muted-foreground">
                  {comment.user_id} · {new Date(comment.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-sm">{comment.comment}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-1 p-3">
          <h2 className="mb-2 text-sm font-semibold">Activity</h2>
          <div className="space-y-2">
            {loading ? <p className="text-xs text-muted-foreground">Loading activity...</p> : null}
            {!loading && activity.length === 0 ? <p className="text-xs text-muted-foreground">No activity yet.</p> : null}
            {activity.map((entry) => (
              <article key={entry.id} className="rounded-md border border-border bg-[hsl(var(--surface-2))] p-2">
                <p className="text-xs text-muted-foreground">
                  {entry.type} · {new Date(entry.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-sm">{entry.message}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

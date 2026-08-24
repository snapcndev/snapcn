"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import type { ShowcaseItem } from "@/lib/server/showcase";
import { isHostedVideo, PLATFORM_LABELS } from "@/lib/showcase/platform";

/** Pending-submission moderation list: approve/reject each via the API. */
export function AdminList({ items }: { items: ShowcaseItem[] }) {
  const [pending, setPending] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);

  async function moderate(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch(`/api/showcase/${id}/moderate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Failed — please try again.");
        return;
      }
      setPending((prev) => prev.filter((x) => x.id !== id));
      toast.success(action === "approve" ? "Approved." : "Rejected.");
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (pending.length === 0) {
    return (
      <p className="mt-8 text-muted-foreground">
        Nothing waiting for review. 🎉
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {pending.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            {/* Approving a video you cannot watch is not review. A hosted entry
                plays right here; a link entry stays a link out. */}
            {isHostedVideo(item.postUrl) ? (
              <>
                {/* biome-ignore lint/a11y/useMediaCaption: user-submitted video, no transcript to ship */}
                <video
                  src={item.postUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="mb-3 aspect-video w-full max-w-sm bg-muted object-contain"
                />
                <p className="font-medium text-foreground">{item.title}</p>
              </>
            ) : (
              <>
                <a
                  href={item.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground hover:underline"
                >
                  {item.title}
                </a>
                <p className="truncate text-sm text-muted-foreground">
                  {PLATFORM_LABELS[item.platform]} · {item.postUrl}
                </p>
              </>
            )}
            {item.description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              by {item.authorName ?? "Unknown"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy === item.id}
              onClick={() => moderate(item.id, "reject")}
            >
              Reject
            </Button>
            <Button
              size="sm"
              disabled={busy === item.id}
              onClick={() => moderate(item.id, "approve")}
            >
              Approve
            </Button>
          </div>
        </div>
      ))}
      <Toaster />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTrackEvent } from "@/lib/analytics";
import type { Clip } from "@/lib/video-editor/types";

/**
 * Server-side MP4 export for the timeline: POST the clips to `/api/render`, poll
 * the job to completion, and trigger a browser download. Mirrors the `/stars`
 * `use-mp4-export` flow (same job API), just with a `clips` payload.
 */

type JobState = {
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  downloadUrl?: string;
  error?: string;
};

const POLL_MS = 800;

export function useEditorExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const trackEvent = useTrackEvent();

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * Unmount cancels the export, not just its timer.
   *
   * `stop` clears a *pending* timeout, which is enough only while the loop is
   * asleep. A fetch already in flight resolves after cleanup has run, and the
   * continuation then calls `setProgress` on a dead component and schedules a
   * fresh timeout — so the poll loop resurrects itself and runs forever. The
   * flag is what that continuation checks, and nothing was ever setting it.
   *
   * `download` resets it to false at the start of each export, so a remount can
   * still export.
   */
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stop();
    };
  }, [stop]);

  const download = useCallback(
    async (
      clips: Clip[],
      {
        removeWatermark = false,
        font = "Geist",
        audio = null,
        onDone,
        onDownloaded,
      }: {
        removeWatermark?: boolean;
        font?: string;
        audio?: {
          uploadId: string | null;
          volume: number;
          trimStart: number;
        } | null;
        /**
         * Take the finished render instead of downloading it. Given the jobId,
         * which names the MP4 still sitting in the server's work dir — see the
         * done branch below.
         */
        onDone?: (jobId: string) => Promise<void> | void;
        /**
         * Fired only when the file actually reached the user's disk.
         *
         * Not merged into `onDone`, which is the opposite case — the showcase
         * claims the render *instead of* downloading it — and not fired on the
         * showcase path, because "your video is downloading" is not true there.
         */
        onDownloaded?: () => void;
      } = {},
    ) => {
      if (clips.length === 0) {
        toast.error("Add at least one clip before exporting.");
        return;
      }

      // Only when the upload genuinely failed. A soundtrack that uploaded fine
      // is in the export, so warning unconditionally — which is what this used
      // to do — was telling people their audio was missing when it was not.
      if (audio && !audio.uploadId) {
        toast.warning("Your soundtrack won't be in this export.", {
          description: "The upload didn't finish. Re-add the file and retry.",
        });
      }
      cancelledRef.current = false;
      setExporting(true);
      setProgress(0);

      // Click → downloaded file, measured here rather than on the server,
      // because the queue wait and the poll interval are part of what the user
      // actually sits through.
      const startedAt = Date.now();
      trackEvent("editor_export_started", { clip_count: clips.length });

      try {
        const res = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // A request, not an instruction: `/api/render` only honours it for a
          // signed-in caller. Sent regardless so the server owns the decision.
          body: JSON.stringify({
            type: "video-timeline",
            clips,
            removeWatermark,
            font,
            audio: audio?.uploadId
              ? {
                  id: audio.uploadId,
                  volume: audio.volume,
                  trimStart: audio.trimStart,
                }
              : null,
          }),
        });
        // 402 is the quota wall, and it is the one failure that is not a
        // failure: nothing broke, the person simply ran out. It gets its own
        // error type so the catch below can offer the way past it instead of
        // reporting a bug that does not exist.
        if (res.status === 402) throw new QuotaError(await readError(res));
        if (!res.ok) throw new Error(await readError(res));
        const { jobId } = (await res.json()) as { jobId: string };

        await new Promise<void>((resolve, reject) => {
          const tick = async () => {
            if (cancelledRef.current) return resolve();
            try {
              const r = await fetch(`/api/render/${jobId}`);
              if (!r.ok) throw new Error("Lost track of the render job");
              const job = (await r.json()) as JobState;
              if (cancelledRef.current) return resolve();
              setProgress(job.progress ?? 0);
              if (job.status === "done" && job.downloadUrl) {
                // `onDone` takes the render *instead of* downloading it: the
                // download route deletes the MP4 as it streams, so a showcase
                // submission has to claim the file rather than consume it.
                // It owns its own errors — a failed submit must not be
                // reported as a failed render.
                if (onDone) {
                  await onDone(jobId);
                } else {
                  triggerDownload(job.downloadUrl);
                  onDownloaded?.();
                }
                trackEvent("editor_export_succeeded", {
                  clip_count: clips.length,
                  duration_ms: Date.now() - startedAt,
                });
                return resolve();
              }
              if (job.status === "error") {
                return reject(new Error(job.error || "Render failed"));
              }
              pollRef.current = setTimeout(tick, POLL_MS);
            } catch (err) {
              reject(err);
            }
          };
          void tick();
        });
      } catch (err) {
        if (err instanceof QuotaError && !cancelledRef.current) {
          // Not a sales moment. The free row allows fifty exports a month, so
          // reaching this is either a very good day or a script — and the one
          // real person who hits it should get a way to keep working, not a
          // checkout button. The upgrade offer lives on the watermark, which
          // every export passes through, rather than on a wall almost nobody
          // reaches.
          toast.warning("Export limit reached", {
            description: err.message,
            duration: 12_000,
          });
        } else if (!cancelledRef.current) {
          console.error("[video-editor] export failed:", err);
          // A failed export is a bug report we would otherwise never get — the
          // user reads the toast and closes the tab.
          trackEvent("editor_export_failed", {
            clip_count: clips.length,
            reason: err instanceof Error ? err.message : String(err),
          });
          toast.error("Export failed", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        stop();
        setExporting(false);
      }
    },
    [stop, trackEvent],
  );

  return { exporting, progress, download };
}

/**
 * "You are out of exports", as a type rather than a string match.
 *
 * The alternative is sniffing the message text in the catch, which breaks the
 * first time the server rewords its own copy — and the server owns that copy,
 * deliberately, because it is the only side that knows the numbers.
 */
class QuotaError extends Error {}

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // non-JSON
  }
  if (res.status === 429) return "Too many requests. Please wait and retry.";
  return `Render request failed (${res.status})`;
}
